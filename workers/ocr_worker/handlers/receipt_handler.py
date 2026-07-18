"""收据 OCR 文本结构化处理器。"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any


class ReceiptHandler:
    """按 receipt_extract_zh_hk.md 约束提取字段，不确定时不编造。"""

    def process(self, text: str, ocr_confidence: float) -> dict[str, Any]:
        amount = self._amount(text)
        parsed_date = self._date(text)
        payer = self._after_label(text, ["付款人", "經手人", "经手人", "繳款人", "缴款人"])
        purpose = self._after_label(text, ["用途", "項目", "项目", "摘要", "備註", "备注"])

        warnings: list[str] = []
        if amount is None:
            warnings.append("金额无法可靠识别，必须对照原图人工填写")
        if parsed_date is None:
            warnings.append("日期无法可靠识别或日月次序不明确")
        if not payer:
            warnings.append("未能识别付款人")
        if not purpose:
            warnings.append("未能识别用途")
        if ocr_confidence < 70:
            warnings.append("OCR 平均信心低于 70，请人工复核")

        filled = sum([amount is not None, parsed_date is not None, bool(payer), bool(purpose)])
        if filled >= 3 and ocr_confidence >= 80:
            confidence = "high"
        elif filled >= 2 and ocr_confidence >= 50:
            confidence = "medium"
        else:
            confidence = "low"

        return {
            "fields": {
                "amount": amount,
                "currency": "HKD",
                "date": parsed_date or "",
                "payer": payer or "",
                "purpose": purpose or "",
            },
            "confidence": confidence,
            "warnings": warnings,
            "raw_text": text,
        }

    @staticmethod
    def _amount(text: str) -> float | None:
        patterns = [
            r"(?:HK\$|HKD|港幣|港币)\s*\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
            r"(?:金額|金额|總額|总额|合計|合计)[：:\s]*\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
            r"\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.I)
            if match:
                try:
                    return float(match.group(1).replace(",", ""))
                except ValueError:
                    return None
        return None

    @staticmethod
    def _date(text: str) -> str | None:
        year_first = re.search(r"(?<!\d)(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)(?!\d)", text)
        if year_first:
            values = (int(year_first.group(1)), int(year_first.group(2)), int(year_first.group(3)))
        else:
            day_first = re.search(r"(?<!\d)([0-3]?\d)[-/]([01]?\d)[-/](\d{4})(?!\d)", text)
            if not day_first:
                chinese = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", text)
                if not chinese:
                    return None
                values = (int(chinese.group(1)), int(chinese.group(2)), int(chinese.group(3)))
            else:
                values = (int(day_first.group(3)), int(day_first.group(2)), int(day_first.group(1)))
        try:
            return datetime(*values).date().isoformat()
        except ValueError:
            return None

    @staticmethod
    def _after_label(text: str, labels: list[str]) -> str | None:
        for label in labels:
            match = re.search(rf"{re.escape(label)}[：:\s]*([^\n；;]{{1,80}})", text, re.I)
            if match:
                return match.group(1).strip()
        return None


def extract_receipt_fields(text: str, ocr_confidence: float) -> dict[str, Any]:
    return ReceiptHandler().process(text, ocr_confidence)
