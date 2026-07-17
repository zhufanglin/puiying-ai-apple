from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from .prompt_loader import load_prompt


class ReceiptHandler:
    prompt_name = "receipt_extract_zh_hk"

    def process(self, text: str, ocr_confidence: float) -> dict[str, Any]:
        warnings: list[str] = []
        amount = self._amount(text)
        parsed_date = self._date(text)
        if amount is None:
            warnings.append("金额无法可靠识别，必须对照原图人工填写。")
        if parsed_date is None:
            warnings.append("日期无法可靠识别或日月次序不明确。")
        if ocr_confidence < 0.70:
            warnings.append("OCR 平均信心低于 0.70。")
        confidence = "low" if warnings else "high" if ocr_confidence >= 0.85 else "medium"
        return {
            "fields": {
                "amount": amount,
                "currency": "HKD" if re.search(r"HK\$|HKD|港幣|港币", text, re.I) else None,
                "date": parsed_date,
                "payer": self._after_label(text, ["付款人", "繳款人", "缴款人", "收到"]),
                "purpose": self._after_label(text, ["用途", "摘要", "活動費", "活动费"]),
            },
            "confidence": confidence,
            "warnings": warnings,
            "raw_text": text,
            "prompt": {"name": self.prompt_name, "content": load_prompt(self.prompt_name)},
        }

    @staticmethod
    def _amount(text: str) -> float | None:
        match = re.search(r"(?:HK\$|HKD|港幣|港币)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})|[0-9]+\.\d{1,2})", text, re.I)
        if not match:
            return None
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            return None

    @staticmethod
    def _date(text: str) -> str | None:
        match = re.search(r"(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?!\d)", text)
        if not match:
            return None
        try:
            return datetime(int(match.group(3)), int(match.group(2)), int(match.group(1))).date().isoformat()
        except ValueError:
            return None

    @staticmethod
    def _after_label(text: str, labels: list[str]) -> str | None:
        for label in labels:
            match = re.search(rf"{re.escape(label)}[：:\s]*([^\n；;]{{1,40}})", text)
            if match:
                return match.group(1).strip()
        return None

