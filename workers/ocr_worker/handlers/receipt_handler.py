"""收据 OCR 处理器 — 对应 receipt_extract_zh_hk.md Prompt

流程:
    获取 OCR 原始文本 → 正则/AI 提取字段 → 结构化 JSON

输出格式（严格按文档 §4 Prompt 文件 2 定义）:
    {
        "fields": {
            "amount": 0.0,
            "currency": "HKD",
            "date": "YYYY-MM-DD",
            "payer": "...",
            "purpose": "..."
        },
        "confidence": "low|medium|high",
        "warnings": [],
        "raw_text": "..."
    }
"""

import re
from typing import Optional


# ================================================================
# 正则模式 — 香港收据常见格式
# ================================================================

_PATTERNS = {
    "amount": [
        r"HK\$\s*([\d,]+\.?\d*)",
        r"HKD\s*\$?\s*([\d,]+\.?\d*)",
        r"港幣\s*\$?\s*([\d,]+\.?\d*)",
        r"金額[：:\s]*\$?\s*([\d,]+\.?\d*)",
        r"金額[：:\s]*HK\$\s*([\d,]+\.?\d*)",
        r"總額[：:\s]*\$?\s*([\d,]+\.?\d*)",
        r"合計[：:\s]*\$?\s*([\d,]+\.?\d*)",
        r"\$([\d,]+\.?\d*)",
    ],
    "date": [
        r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
        r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)",
        r"(\d{1,2})\/(\d{1,2})\/(\d{4})",
        r"日期[：:\s]*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
    ],
    "payer": [
        r"付款人[：:\s]*(.+)",
        r"經手人[：:\s]*(.+)",
        r"繳款人[：:\s]*(.+)",
        r"Payer[：:\s]*(.+)",
    ],
    "purpose": [
        r"用途[：:\s]*(.+)",
        r"項目[：:\s]*(.+)",
        r"事項[：:\s]*(.+)",
        r"Purpose[：:\s]*(.+)",
        r"備註[：:\s]*(.+)",
    ],
}


def _extract(text: str, patterns: list[str]) -> Optional[str]:
    """从文本中提取第一个匹配"""
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            if m.lastindex and m.lastindex >= 3:
                groups = m.groups()
                if len(groups) == 3 and all(g and g.isdigit() for g in groups[:3] if g):
                    y, mo, d = groups[0], groups[1], groups[2]
                    return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
            return m.group(1).strip() if m.lastindex else m.group(0).strip()
    return None


def _parse_amount(raw: Optional[str]) -> Optional[float]:
    if not raw:
        return None
    cleaned = raw.replace(",", "").replace("，", "").replace(" ", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


async def handle_receipt_ocr(job_id: int) -> dict:
    """处理收据 OCR 任务

    完整流程（严格按 receipt_extract_zh_hk.md）:
    1. 查数据库获取 OCR 原始文本
    2. 正则提取字段
    3. 计算置信度 + 生成警告
    4. 返回结构化 JSON
    """
    from sqlalchemy import select
    from app.db.session import SessionLocal
    from app.modules.ocr.models import OCRJob

    async with SessionLocal() as db:
        result = await db.execute(select(OCRJob).where(OCRJob.id == job_id))
        job = result.scalar_one_or_none()
        if not job or not job.result_text:
            return {
                "fields": {"amount": None, "currency": "HKD", "date": "", "payer": "", "purpose": ""},
                "confidence": "low",
                "warnings": ["OCR 文本为空"],
                "raw_text": "",
            }

        raw_text = job.result_text

        # 提取字段
        amount_raw = _extract(raw_text, _PATTERNS["amount"])
        date_raw = _extract(raw_text, _PATTERNS["date"])
        payer_raw = _extract(raw_text, _PATTERNS["payer"])
        purpose_raw = _extract(raw_text, _PATTERNS["purpose"])

        amount = _parse_amount(amount_raw)
        date_val = date_raw or ""
        payer = (payer_raw or "").strip()
        purpose = (purpose_raw or "").strip()

        # 置信度
        filled = sum([amount is not None, bool(date_val), bool(payer), bool(purpose)])
        if filled >= 3:
            confidence = "high"
        elif filled >= 2:
            confidence = "medium"
        else:
            confidence = "low"

        # 警告 — 文档要求: 金额不确定时返回 null; 手写字识别不出时 warnings 说明
        warnings = []
        if amount is None:
            warnings.append("未能识别金额，请手动填写")
        if not date_val:
            warnings.append("未能识别日期")
        if not payer:
            warnings.append("未能识别付款人")
        if not purpose:
            warnings.append("未能识别用途")
        if confidence == "low":
            warnings.append("OCR 识别信心较低，建议仔细核对所有字段 — 手写字可能识别不准")

        return {
            "fields": {
                "amount": amount,
                "currency": "HKD",
                "date": date_val,
                "payer": payer,
                "purpose": purpose,
            },
            "confidence": confidence,
            "warnings": warnings,
            "raw_text": raw_text,
        }
