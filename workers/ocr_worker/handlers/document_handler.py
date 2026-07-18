"""通用文档 OCR 结果处理。"""

from __future__ import annotations

from typing import Any


def build_document_result(
    raw_text: str,
    ocr_confidence: float,
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    confidence = "high" if ocr_confidence >= 80 else "medium" if ocr_confidence >= 50 else "low"
    result_warnings = list(warnings or [])
    if not raw_text:
        result_warnings.append("OCR 文本为空")
        confidence = "low"
    return {
        "fields": {},
        "confidence": confidence,
        "warnings": result_warnings,
        "raw_text": raw_text,
    }
