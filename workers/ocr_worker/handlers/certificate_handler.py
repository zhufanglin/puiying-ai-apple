"""证书/奖状 OCR 结构化处理器。"""

from __future__ import annotations

import re
from typing import Any


def extract_certificate_fields(raw_text: str, ocr_confidence: float) -> dict[str, Any]:
    award_name = ""
    for pattern in [r"獎項[：:\s]*(.+)", r"奖项[：:\s]*(.+)", r"獎狀[：:\s]*(.+)"]:
        match = re.search(pattern, raw_text)
        if match:
            award_name = match.group(1).strip()
            break

    categories = {
        "學業": ["學業", "学业", "成績", "成绩", "學術", "学术", "academic"],
        "品行": ["品行", "德育", "操行", "conduct"],
        "服務": ["服務", "服务", "義工", "义工", "service", "volunteer"],
        "體育": ["體育", "体育", "運動", "运动", "sport", "athletic"],
    }
    category = ""
    for candidate, keywords in categories.items():
        if any(keyword.lower() in raw_text.lower() for keyword in keywords):
            category = candidate
            break

    warnings: list[str] = []
    if not award_name:
        warnings.append("未能识别奖项名称")
    if not category:
        warnings.append("未能识别奖项类别")
    if ocr_confidence < 70:
        warnings.append("OCR 平均信心低于 70，请人工复核")

    confidence = "medium" if award_name and category and ocr_confidence >= 70 else "low"
    return {
        "fields": {
            "award_name": award_name,
            "category": category,
            "recipients": [],
        },
        "confidence": confidence,
        "warnings": warnings,
        "raw_text": raw_text,
    }
