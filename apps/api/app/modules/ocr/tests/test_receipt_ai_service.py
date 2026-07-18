from __future__ import annotations

import json
import unittest

from app.modules.ocr.receipt_ai_service import (
    AIReceiptError,
    DEEPSEEK_CHAT_URL,
    structure_receipt_with_ai,
)
from app.modules.ocr.schemas import OCRLineInput, ReceiptAIStructureRequest


def model_response(payload: dict) -> dict:
    return {
        "choices": [{
            "message": {
                "content": json.dumps(payload, ensure_ascii=False),
            }
        }]
    }


class ReceiptAIServiceTest(unittest.IsolatedAsyncioTestCase):
    async def test_calls_deepseek_json_mode_without_key_in_payload(self) -> None:
        source = "日期：16/7/2026\n付款人：陳先生\n用途：活動費\nHK$1,200.00"
        request = ReceiptAIStructureRequest(
            model="deepseek-v4-flash",
            ocr_text=source,
            ocr_confidence=92,
            lines=[OCRLineInput(line_no=1, text="日期：16/7/2026", confidence=92)],
        )
        secret = "unit-test-deepseek-key"

        async def transport(url, headers, payload, timeout):
            self.assertEqual(url, DEEPSEEK_CHAT_URL)
            self.assertEqual(headers["Authorization"], f"Bearer {secret}")
            self.assertNotIn(secret, json.dumps(payload, ensure_ascii=False))
            self.assertEqual(payload["response_format"], {"type": "json_object"})
            self.assertEqual(payload["thinking"], {"type": "disabled"})
            self.assertIn('"ocr_confidence": 0.92', payload["messages"][1]["content"])
            self.assertEqual(timeout, 45.0)
            return model_response({
                "fields": {
                    "amount": 1200,
                    "currency": "HKD",
                    "date": "2026-07-16",
                    "payer": "陳先生",
                    "purpose": "活動費",
                },
                "confidence": "high",
                "warnings": [],
                "raw_text": source,
            })

        result = await structure_receipt_with_ai(
            request,
            secret,
            transport=transport,
        )

        self.assertEqual(result.fields.amount, 1200)
        self.assertEqual(result.fields.payer, "陳先生")
        self.assertEqual(result.confidence, "high")
        self.assertNotIn(secret, result.model_dump_json())

    async def test_receipt_number_is_never_accepted_as_amount(self) -> None:
        source = "收據\nN°\n8865431\n日期：\n2025年6月15日\n今收到\n張三"
        request = ReceiptAIStructureRequest(
            model="deepseek-v4-pro",
            ocr_text=source,
            ocr_confidence=93,
            lines=[
                OCRLineInput(line_no=index, text=text, confidence=93)
                for index, text in enumerate(source.splitlines(), start=1)
            ],
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": {
                    "amount": 8865431,
                    "currency": "HKD",
                    "date": "2025-06-15",
                    "payer": "張三",
                    "purpose": None,
                },
                "confidence": "high",
                "warnings": [],
                "raw_text": source,
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertIsNone(result.fields.amount)
        self.assertIsNone(result.fields.currency)
        self.assertEqual(result.fields.date, "2025-06-15")
        self.assertEqual(result.fields.payer, "張三")
        self.assertEqual(result.confidence, "low")
        self.assertTrue(any("金额" in warning for warning in result.warnings))

    async def test_hallucinated_text_fields_are_cleared(self) -> None:
        source = "日期：2026年7月16日\nHK$100.00"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=90,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": {
                    "amount": 100,
                    "currency": "HKD",
                    "date": "2026-07-16",
                    "payer": "不存在的人",
                    "purpose": "不存在的用途",
                },
                "confidence": "high",
                "warnings": [],
                "raw_text": "被模型改写",
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertIsNone(result.fields.payer)
        self.assertIsNone(result.fields.purpose)
        self.assertEqual(result.raw_text, source)
        self.assertEqual(result.confidence, "low")
        self.assertTrue(any("OCR 原文" in warning for warning in result.warnings))

    async def test_invalid_model_json_is_reported_safely(self) -> None:
        request = ReceiptAIStructureRequest(
            ocr_text="日期：2026年7月16日",
            ocr_confidence=90,
        )

        async def transport(url, headers, payload, timeout):
            return {"choices": [{"message": {"content": "not-json"}}]}

        with self.assertRaisesRegex(AIReceiptError, "JSON 规范") as caught:
            await structure_receipt_with_ai(
                request,
                "unit-test-secret-key",
                transport=transport,
            )
        self.assertNotIn("unit-test-secret-key", str(caught.exception))

    async def test_short_key_is_rejected_without_echoing_it(self) -> None:
        request = ReceiptAIStructureRequest(
            ocr_text="收據",
            ocr_confidence=50,
        )
        with self.assertRaisesRegex(AIReceiptError, "有效") as caught:
            await structure_receipt_with_ai(request, "short")
        self.assertNotIn("short", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
