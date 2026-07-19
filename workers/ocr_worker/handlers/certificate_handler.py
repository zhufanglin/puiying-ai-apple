"""证书 OCR 处理器 — 对应 award_extract_zh_hk.md Prompt

用于奖状/证书类文档的结构化提取。

输出格式（文档 §4 Prompt 文件 1）:
    {
        "fields": {
            "award_name": "...",
            "category": "學業 / 品行 / 服務 / 體育",
            "recipients": [{"student_no": "...", "name": "...", "score": 0, "ranking": 0}]
        },
        "confidence": "low|medium|high",
        "warnings": [],
        "raw_text": "..."
    }

要求: 不确定时 confidence 返回 low；不要编造学生姓名。
"""

import re
from typing import Optional


async def handle_certificate_ocr(job_id: int) -> dict:
    """处理证书 OCR 任务"""
    from sqlalchemy import select
    from app.db.session import SessionLocal
    from app.modules.ocr.models import OCRJob

    async with SessionLocal() as db:
        result = await db.execute(select(OCRJob).where(OCRJob.id == job_id))
        job = result.scalar_one_or_none()

        if not job or not job.result_text:
            return {
                "fields": {"award_name": "", "category": "", "recipients": []},
                "confidence": "low",
                "warnings": ["OCR 文本为空"],
                "raw_text": "",
            }

        raw_text = job.result_text

        # 提取奖项名称
        award_name = ""
        award_patterns = [
            r"獎項[：:\s]*(.+)",
            r"獎狀[：:\s]*(.+)",
            r"獲獎[：:\s]*(.+)",
        ]
        for pat in award_patterns:
            m = re.search(pat, raw_text)
            if m:
                award_name = m.group(1).strip()
                break

        # 推断类别
        categories = {
            "學業": ["學業", "成績", "學術", "academic"],
            "品行": ["品行", "德育", "操行", "conduct"],
            "服務": ["服務", "義工", "志願", "service", "volunteer"],
            "體育": ["體育", "運動", "田徑", "sport", "athletic"],
        }
        category = ""
        for cat, keywords in categories.items():
            if any(k in raw_text for k in keywords):
                category = cat
                break

        warnings = []
        if not award_name:
            warnings.append("未能识别奖项名称")
        if not category:
            warnings.append("未能识别奖项类别")

        return {
            "fields": {
                "award_name": award_name,
                "category": category or "學業",
                "recipients": [],
            },
            "confidence": "medium" if award_name else "low",
            "warnings": warnings,
            "raw_text": raw_text,
        }
