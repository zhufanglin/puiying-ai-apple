from __future__ import annotations

from typing import Any


class DocumentHandler:
    def process(self, text: str, ocr_confidence: float) -> dict[str, Any]:
        warnings = [] if text.strip() else ["没有识别到可用文字。"]
        if ocr_confidence < 0.70:
            warnings.append("OCR 信心偏低，需要人工复核。")
        return {
            "fields": {"text": text.strip()},
            "confidence": "low" if warnings else "medium",
            "warnings": warnings,
            "raw_text": text,
        }

