from __future__ import annotations

import re
from typing import Any

from .prompt_loader import load_prompt


class CertificateHandler:
    prompt_name = "student_certificate_zh_hk"

    def process(self, text: str, ocr_confidence: float) -> dict[str, Any]:
        student_no = self._match(text, r"(?:學號|学号|Student\s*No\.?)[：:\s]*([A-Z0-9-]+)")
        class_name = self._match(text, r"(?:班別|班级|班級|Class)[：:\s]*([A-Z0-9-]+)")
        warnings = []
        if not student_no: warnings.append("未识别到学号。")
        if not class_name: warnings.append("未识别到班级。")
        if ocr_confidence < 0.70: warnings.append("OCR 信心偏低。")
        return {
            "fields": {"student_no": student_no, "class_name": class_name, "content_candidate": text.strip() or None},
            "confidence": "low" if warnings else "medium",
            "warnings": warnings,
            "raw_text": text,
            "prompt": {"name": self.prompt_name, "content": load_prompt(self.prompt_name)},
        }

    @staticmethod
    def _match(text: str, pattern: str) -> str | None:
        match = re.search(pattern, text, re.I)
        return match.group(1).strip() if match else None

