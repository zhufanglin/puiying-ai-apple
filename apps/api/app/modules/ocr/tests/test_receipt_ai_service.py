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

    async def test_server_supplies_raw_text_and_ignores_model_extras(self) -> None:
        source = "日期：2026年7月16日\n付款人：陳先生\n用途：活動費\nHK$100.00"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=95,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": {
                    "amount": 100,
                    "currency": "HKD",
                    "date": "2026-07-16",
                    "payer": "陳先生",
                    "purpose": "活動費",
                    "unexpected": "ignored",
                },
                "confidence": "high",
                "warnings": [],
                "unexpected_top_level": "ignored",
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertEqual(result.raw_text, source)
        self.assertEqual(result.fields.amount, 100)
        self.assertEqual(result.confidence, "high")

    async def test_normalizes_common_model_variants(self) -> None:
        source = "日期：16/7/2026\n付款人：陳先生\n用途：活動費\n港幣 HK$1,200.00"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=92,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "result": {
                    "fields": {
                        "amount": "HK$1,200.00",
                        "currency": "港幣",
                        "date": "16/7/2026",
                        "payer": "  陳先生  ",
                        "purpose": "活動費",
                    },
                    "confidence": "HIGH",
                    "warnings": "模型已完成字段提取",
                    "raw_text": "模型不应控制原文",
                }
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertEqual(result.fields.amount, 1200)
        self.assertEqual(result.fields.currency, "HKD")
        self.assertEqual(result.fields.date, "2026-07-16")
        self.assertEqual(result.fields.payer, "陳先生")
        self.assertEqual(result.confidence, "high")
        self.assertEqual(result.raw_text, source)
        self.assertIn("模型已完成字段提取", result.warnings)

    async def test_ambiguous_date_and_bare_dollar_do_not_auto_confirm(self) -> None:
        source = "日期：06/07/2026\n$100.00"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=95,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": {
                    "amount": "100.00",
                    "currency": "HKD",
                    "date": "2026-07-06",
                    "payer": None,
                    "purpose": None,
                },
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertEqual(result.fields.amount, 100)
        self.assertIsNone(result.fields.currency)
        self.assertIsNone(result.fields.date)
        self.assertEqual(result.confidence, "low")

    async def test_untrusted_amount_and_text_types_are_cleared(self) -> None:
        source = "日期：2026-07-16\nHK$1,000.00"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=95,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": {
                    "amount": "1e3",
                    "currency": "HKD",
                    "date": "2026-07-16",
                    "payer": {"name": "陳先生"},
                    "purpose": ["活動費"],
                },
                "confidence": "HIGH|LOW",
                "warnings": [],
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertIsNone(result.fields.amount)
        self.assertIsNone(result.fields.payer)
        self.assertIsNone(result.fields.purpose)
        self.assertEqual(result.confidence, "low")

    async def test_schema_placeholder_strings_fall_back_to_null(self) -> None:
        request = ReceiptAIStructureRequest(
            ocr_text="收據",
            ocr_confidence=80,
        )
        calls = 0

        async def transport(url, headers, payload, timeout):
            nonlocal calls
            calls += 1
            return model_response({
                "fields": {
                    "amount": None,
                    "currency": "HKD|null",
                    "date": "YYYY-MM-DD|null",
                    "payer": "string|null",
                    "purpose": "null",
                },
                "confidence": "low|medium|high",
                "warnings": [],
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertEqual(calls, 1)
        self.assertIsNone(result.fields.amount)
        self.assertIsNone(result.fields.currency)
        self.assertIsNone(result.fields.date)
        self.assertIsNone(result.fields.payer)
        self.assertIsNone(result.fields.purpose)
        self.assertEqual(result.confidence, "low")

    async def test_malformed_and_extreme_amounts_are_never_accepted(self) -> None:
        cases = [
            ("1,2,3", "日期：2026-07-16\nHK$1,2,3"),
            (1.23, "日期：2026-07-16\n$1.234"),
            (10 ** 400, "日期：2026-07-16\nHK$100.00"),
            (True, "日期：2026-07-16\nHK$1.00"),
            (float("inf"), "日期：2026-07-16\nHK$1.00"),
        ]

        for model_amount, source in cases:
            with self.subTest(model_amount=repr(model_amount)[:40]):
                request = ReceiptAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=95,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": {
                            "amount": model_amount,
                            "currency": "HKD",
                            "date": "2026-07-16",
                            "payer": None,
                            "purpose": None,
                        },
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_receipt_with_ai(
                    request,
                    "unit-test-key",
                    transport=transport,
                )
                self.assertIsNone(result.fields.amount)
                self.assertEqual(result.confidence, "low")

    async def test_field_labels_are_not_accepted_as_values(self) -> None:
        source = "收據\n日期\n2025年6月15日\n今收到\n張三"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=95,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": {
                    "amount": None,
                    "currency": None,
                    "date": "2025-06-15",
                    "payer": "今收到",
                    "purpose": "日期",
                },
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertIsNone(result.fields.payer)
        self.assertIsNone(result.fields.purpose)
        self.assertTrue(any("付款标签" in item for item in result.warnings))
        self.assertTrue(any("字段标签" in item for item in result.warnings))

    async def test_system_warnings_are_not_displaced_by_model_warnings(self) -> None:
        source = "收據\nN°\n8865431\n日期：2025年6月15日"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=95,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": {
                    "amount": 8865431,
                    "currency": "HKD",
                    "date": "2025-06-15",
                    "payer": None,
                    "purpose": None,
                },
                "confidence": "high",
                "warnings": [f"模型警告 {index}" for index in range(20)],
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertLessEqual(len(result.warnings), 20)
        self.assertTrue(any("金额缺少" in item for item in result.warnings))
        self.assertTrue(any("币别未自动确认" in item for item in result.warnings))

    async def test_high_confidence_is_capped_when_fields_are_missing(self) -> None:
        source = "日期：2026-07-16\nHK$100.00"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=95,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": {
                    "amount": 100,
                    "currency": "HKD",
                    "date": "2026-07-16",
                    "payer": None,
                    "purpose": None,
                },
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_receipt_with_ai(
            request,
            "unit-test-key",
            transport=transport,
        )

        self.assertEqual(result.confidence, "medium")

    async def test_invalid_json_retries_once_without_logging_sensitive_text(self) -> None:
        source = "private-ocr-marker\n收據"
        secret = "unit-test-secret-key"
        model_marker = "bad-model-output-marker"
        request = ReceiptAIStructureRequest(
            ocr_text=source,
            ocr_confidence=50,
        )
        payloads: list[dict] = []

        async def transport(url, headers, payload, timeout):
            payloads.append(payload)
            if len(payloads) == 1:
                return {"choices": [{"message": {"content": model_marker}}]}
            return model_response({
                "fields": {
                    "amount": None,
                    "currency": None,
                    "date": None,
                    "payer": None,
                    "purpose": None,
                },
                "confidence": "low",
                "warnings": ["未发现可靠字段"],
            })

        with self.assertLogs(
            "app.modules.ocr.receipt_ai_service",
            level="WARNING",
        ) as captured:
            result = await structure_receipt_with_ai(
                request,
                secret,
                transport=transport,
            )

        self.assertEqual(len(payloads), 2)
        self.assertIn("上一次回复无法通过", payloads[1]["messages"][1]["content"])
        self.assertNotIn(model_marker, json.dumps(payloads[1], ensure_ascii=False))
        self.assertNotIn(secret, json.dumps(payloads, ensure_ascii=False))
        log_output = "\n".join(captured.output)
        self.assertNotIn(source, log_output)
        self.assertNotIn(model_marker, log_output)
        self.assertNotIn(secret, log_output)
        self.assertEqual(result.raw_text, source)

    async def test_transport_error_is_not_retried(self) -> None:
        request = ReceiptAIStructureRequest(
            ocr_text="收據",
            ocr_confidence=50,
        )
        calls = 0

        async def transport(url, headers, payload, timeout):
            nonlocal calls
            calls += 1
            raise AIReceiptError("DeepSeek API Key 无效")

        with self.assertRaisesRegex(AIReceiptError, "API Key 无效"):
            await structure_receipt_with_ai(
                request,
                "unit-test-key",
                transport=transport,
            )
        self.assertEqual(calls, 1)

    async def test_invalid_model_json_is_reported_safely(self) -> None:
        request = ReceiptAIStructureRequest(
            ocr_text="日期：2026年7月16日",
            ocr_confidence=90,
        )

        calls = 0

        async def transport(url, headers, payload, timeout):
            nonlocal calls
            calls += 1
            return {"choices": [{"message": {"content": "not-json"}}]}

        with self.assertRaisesRegex(AIReceiptError, "JSON 规范") as caught:
            await structure_receipt_with_ai(
                request,
                "unit-test-secret-key",
                transport=transport,
            )
        self.assertEqual(calls, 2)
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
