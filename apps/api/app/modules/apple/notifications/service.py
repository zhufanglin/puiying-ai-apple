"""Business logic for notice content generation and WhatsApp delivery."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.apple.notifications import repository
from app.modules.apple.students.student_service import StudentService
from services.whatsapp_client import WhatsAppClient

logger = logging.getLogger(__name__)

PROMPT_DIR = Path(__file__).resolve().parents[1] / "prompts"

DEEPSEEK_API_KEY = os.getenv("AI_API_KEY", os.getenv("DEEPSEEK_API_KEY", ""))
DEEPSEEK_API_URL = os.getenv("AI_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_MODEL = os.getenv("AI_MODEL", "deepseek-chat")
DEEPSEEK_MAX_RETRIES = 3


def _load_prompt(name: str) -> str:
    path = PROMPT_DIR / f"{name}.md" if not str(name).endswith(".md") else PROMPT_DIR / name
    if not path.is_file():
        raise FileNotFoundError(f"Prompt 不存在：{path}")
    return path.read_text(encoding="utf-8")


def _strip_json_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        text = text[first_newline + 1:] if first_newline != -1 else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def render_template_content(
    zh_template: str,
    en_template: str | None,
    placeholders: dict[str, Any],
) -> dict[str, str]:
    """Fallback: simple placeholder replacement when AI is unavailable."""
    content_zh = zh_template
    content_en = en_template or ""

    for key, value in placeholders.items():
        placeholder = "{{" + key + "}}"
        content_zh = content_zh.replace(placeholder, str(value))
        content_en = content_en.replace(placeholder, str(value))

    return {"content_zh": content_zh, "content_en": content_en}


async def _call_deepseek(system_prompt: str, user_input: str) -> dict[str, Any]:
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DeepSeek API Key 未配置（請設定 AI_API_KEY 或 DEEPSEEK_API_KEY 環境變數）")

    last_error: Exception | None = None
    for attempt in range(1, DEEPSEEK_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    DEEPSEEK_API_URL,
                    headers={
                        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": DEEPSEEK_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_input},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 2048,
                    },
                )
                response.raise_for_status()
                data = response.json()

            raw = data["choices"][0]["message"]["content"]
            parsed = json.loads(_strip_json_fence(raw))

            fields = parsed.get("fields", {})
            content_zh = fields.get("content_zh", "")
            content_en = fields.get("content_en", "")

            if not content_zh or not content_en:
                raise ValueError(f"DeepSeek 返回空白內容（content_zh={bool(content_zh)} content_en={bool(content_en)}）")

            logger.info(
                "DeepSeek 通告生成成功 (attempt=%d confidence=%s)",
                attempt,
                parsed.get("confidence", "unknown"),
            )
            return parsed

        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
            logger.warning("DeepSeek 回應格式異常 (attempt=%d/%d)：%s", attempt, DEEPSEEK_MAX_RETRIES, exc)
            if attempt < DEEPSEEK_MAX_RETRIES:
                continue
        except Exception as exc:
            last_error = exc
            logger.warning("DeepSeek API 呼叫失敗 (attempt=%d/%d)：%s", attempt, DEEPSEEK_MAX_RETRIES, exc)
            if attempt < DEEPSEEK_MAX_RETRIES:
                continue

    raise RuntimeError(f"DeepSeek 三次嘗試均失敗，最後錯誤：{last_error}")


async def generate_notice_content(
    template_id: int,
    placeholders: dict[str, Any],
    db: AsyncSession,
) -> dict[str, str]:
    """Generate bilingual notice content using DeepSeek AI.

    Falls back to simple placeholder replacement if AI is unavailable.
    Signature and return type unchanged from original.
    """
    template = await repository.get_template(db, template_id)
    if not template:
        return {"error": "template not found"}

    user_input = json.dumps(placeholders, ensure_ascii=False)

    try:
        system_prompt = _load_prompt("notice_bilingual_zh_hk")
        ai_result = await _call_deepseek(system_prompt, user_input)
        fields = ai_result.get("fields", {})
        return {
            "content_zh": fields.get("content_zh", ""),
            "content_en": fields.get("content_en", ""),
        }
    except Exception as exc:
        logger.warning("DeepSeek AI 生成失敗，降級為模板佔位符替換：%s", exc)
        return render_template_content(
            template.zh_content_template,
            template.en_content_template,
            placeholders,
        )


def _find_cjk_font() -> str:
    """Find a CJK-capable TTF font on the system. Returns path or empty string."""
    candidates = [
        # Windows
        "C:/Windows/Fonts/simsunb.ttf",
        "C:/Windows/Fonts/msjh.ttf",
        "C:/Windows/Fonts/kaiu.ttf",
        # Linux
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return ""


def export_notification_pdf(
    title_zh: str,
    title_en: str,
    content_zh: str,
    content_en: str,
    output_dir: str,
    filename: str,
) -> str:
    """Generate a bilingual notice PDF. Returns the absolute path of the saved file."""
    from fpdf import FPDF

    font_path = _find_cjk_font()
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)

    # ----- Chinese page -----
    pdf.add_page()
    if font_path:
        pdf.add_font("cjk", "", font_path, uni=True)
        pdf.add_font("cjk", "B", font_path, uni=True)
        cjk_available = True
    else:
        cjk_available = False

    # Header bar
    pdf.set_fill_color(35, 103, 95)
    pdf.rect(0, 0, 210, 12, "F")
    pdf.set_y(3)
    pdf.set_font("cjk" if cjk_available else "Helvetica", "B", 10)
    pdf.set_text_color(255, 255, 255)
    header_zh = "培英中學 通告" if cjk_available else "Pui Ying Secondary School - Notice"
    pdf.cell(0, 6, header_zh, align="C")
    pdf.ln(10)

    # Chinese title
    pdf.set_text_color(35, 103, 95)
    pdf.set_font("cjk" if cjk_available else "Helvetica", "B", 16)
    pdf.multi_cell(0, 8, title_zh if cjk_available else f"[ZH] {title_zh}")
    pdf.ln(4)

    # Chinese content
    pdf.set_text_color(51, 51, 51)
    pdf.set_font("cjk" if cjk_available else "Courier", "", 11)
    for paragraph in content_zh.split("\n"):
        paragraph = paragraph.strip()
        if paragraph:
            pdf.multi_cell(0, 6.5, paragraph)
        else:
            pdf.ln(3)

    # Footer
    pdf.set_y(-15)
    pdf.set_font("cjk" if cjk_available else "Helvetica", "", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 8, "1 / 2", align="C")

    # ----- English page -----
    pdf.add_page()
    pdf.set_fill_color(35, 103, 95)
    pdf.rect(0, 0, 210, 12, "F")
    pdf.set_y(3)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 6, "Pui Ying Secondary School - Notice", align="C")
    pdf.ln(10)

    # English title
    pdf.set_text_color(35, 103, 95)
    pdf.set_font("Helvetica", "B", 16)
    pdf.multi_cell(0, 8, title_en)
    pdf.ln(4)

    # English content
    pdf.set_text_color(51, 51, 51)
    pdf.set_font("Helvetica", "", 11)
    for paragraph in content_en.split("\n"):
        paragraph = paragraph.strip()
        if paragraph:
            pdf.multi_cell(0, 6.5, paragraph)
        else:
            pdf.ln(3)

    # Footer
    pdf.set_y(-15)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 8, "2 / 2", align="C")

    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, filename)
    pdf.output(filepath)
    return os.path.abspath(filepath)


async def send_notification_to_parents(
    notification_id: int,
    db: AsyncSession,
) -> dict[str, Any]:
    notification = await repository.get_notification(db, notification_id)
    if not notification:
        return {"error": "notification not found"}

    try:
        classes = json.loads(notification.target_classes) if notification.target_classes else []
    except json.JSONDecodeError:
        return {"error": "invalid target classes"}

    if not classes:
        return {"error": "no target classes"}

    all_parents: list[dict[str, str | None]] = []
    students = StudentService()
    for class_name in classes:
        all_parents.extend(students.list_parent_phones(str(class_name)))

    if not all_parents:
        return {"error": "no parent phones found"}

    client = WhatsAppClient()
    success_count = 0
    fail_count = 0
    message = f"{notification.title_zh}\n\n{notification.content_zh}"

    for parent in all_parents:
        phone = str(parent["phone"])
        result = client.send_text(phone, message)
        await repository.create_log(db, {
            "notification_id": notification_id,
            "parent_phone": phone,
            "student_name": str(parent["student_name"]),
            "message_status": "sent" if result.get("status") == "sent" else "failed",
            "error_msg": result.get("error"),
            "status_updated_at": datetime.now(timezone.utc),
        })

        if result.get("status") == "sent":
            success_count += 1
        else:
            fail_count += 1

    status = "sent" if fail_count == 0 else "partial" if success_count else "failed"
    await repository.update_notification(db, notification, {
        "status": status,
        "sent_at": datetime.now(timezone.utc),
    })

    return {
        "total": len(all_parents),
        "success": success_count,
        "failed": fail_count,
        "status": status,
    }
