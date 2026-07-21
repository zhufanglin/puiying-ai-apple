from __future__ import annotations

import json
import unittest

from app.modules.ocr.invoice_ai_service import (
    AIInvoiceError,
    DEEPSEEK_CHAT_URL,
    structure_invoice_with_ai,
)
from app.modules.ocr.receipt_ai_service import AIReceiptError
from app.modules.ocr.schemas import InvoiceAIStructureRequest, OCRLineInput


def model_response(payload: dict) -> dict:
    return {
        "choices": [{
            "message": {
                "content": json.dumps(payload, ensure_ascii=False),
            }
        }]
    }


def single_asset_source() -> str:
    return "\n".join([
        "ACME TECHNOLOGY LIMITED",
        "Supplier: ACME TECHNOLOGY LIMITED",
        "Invoice No: INV-2026-001",
        "Invoice Date: 19/07/2026",
        "Description Qty Unit Price",
        "Lenovo ThinkPad E16 Laptop",
        "1",
        "Grand Total HKD 12,800.00",
    ])


def single_asset_fields(**overrides) -> dict:
    fields = {
        "asset_name": "Lenovo ThinkPad E16 Laptop",
        "category": "IT設備",
        "amount": 12800,
        "currency": "HKD",
        "purchase_date": "2026-07-19",
        "vendor": "ACME TECHNOLOGY LIMITED",
        "invoice_no": "INV-2026-001",
        "multiple_items": False,
    }
    fields.update(overrides)
    return fields


class InvoiceAIServiceTest(unittest.IsolatedAsyncioTestCase):
    async def test_calls_deepseek_json_mode_without_key_in_payload(self) -> None:
        source = single_asset_source()
        secret = "unit-test-deepseek-key"
        request = InvoiceAIStructureRequest(
            model="deepseek-v4-flash",
            ocr_text=source,
            ocr_confidence=92,
            lines=[
                OCRLineInput(line_no=1, text="ACME TECHNOLOGY LIMITED", confidence=92)
            ],
        )

        async def transport(url, headers, payload, timeout):
            self.assertEqual(url, DEEPSEEK_CHAT_URL)
            self.assertEqual(headers["Authorization"], f"Bearer {secret}")
            self.assertNotIn(secret, json.dumps(payload, ensure_ascii=False))
            self.assertEqual(payload["response_format"], {"type": "json_object"})
            self.assertEqual(payload["thinking"], {"type": "disabled"})
            self.assertIn('"ocr_confidence": 0.92', payload["messages"][1]["content"])
            self.assertIn("invoice_asset_extract", payload["messages"][0]["content"])
            self.assertEqual(timeout, 45.0)
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
                "raw_text": "模型不可控制服务端原文",
            })

        result = await structure_invoice_with_ai(request, secret, transport=transport)

        self.assertEqual(result.fields.amount, 12800)
        self.assertEqual(result.fields.asset_name, "Lenovo ThinkPad E16 Laptop")
        self.assertEqual(result.confidence, "high")
        self.assertEqual(result.raw_text, source)
        self.assertNotIn(secret, result.model_dump_json())

    async def test_only_final_total_is_accepted(self) -> None:
        source = single_asset_source().replace(
            "Grand Total HKD 12,800.00",
            "Subtotal HKD 10,000.00\nVAT HKD 1,000.00\nGrand Total HKD 11,000.00",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(amount=11000),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertEqual(result.fields.amount, 11000)
        self.assertEqual(result.confidence, "high")

    async def test_spaced_sub_total_is_never_accepted_as_final_total(self) -> None:
        source = single_asset_source().replace(
            "Grand Total HKD 12,800.00",
            "Sub Total HKD 12,800.00",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.amount)
        self.assertEqual(result.confidence, "low")

    async def test_negative_or_accounting_total_is_never_converted_positive(self) -> None:
        total_lines = (
            "Grand Total HKD -100.00",
            "Grand Total HKD −100.00",
            "Grand Total (HKD 100.00)",
            "Grand Total HKD (100.00)",
            "Grand Total (港幣 100.00)",
            "Grand Total 港元(100.00)",
            "Grand Total (100.00 HKD)",
            "Grand Total (100.00) HKD",
            "Grand Total （100.00）",
            "Grand Total （100.00 港幣）",
            "Grand Total 港元（100.00）",
            "Grand Total HKD 100.00-",
            "Grand Total HKD 100.00−",
            "Grand Total HKD 100.00 CR",
            "Grand Total CREDIT HKD 100.00",
        )
        for total_line in total_lines:
            with self.subTest(total_line=total_line):
                source = single_asset_source().replace(
                    "Grand Total HKD 12,800.00",
                    total_line,
                )
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=94,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(amount=100),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertIsNone(result.fields.amount)
                self.assertEqual(result.confidence, "low")

        credit_note_source = "CREDIT NOTE\n" + single_asset_source().replace(
            "12,800.00",
            "100.00",
        )
        credit_note_request = InvoiceAIStructureRequest(
            ocr_text=credit_note_source,
            ocr_confidence=94,
        )

        async def credit_note_transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(amount=100),
                "confidence": "high",
                "warnings": [],
            })

        credit_note_result = await structure_invoice_with_ai(
            credit_note_request,
            "unit-test-key",
            transport=credit_note_transport,
        )
        self.assertIsNone(credit_note_result.fields.amount)

        for heading in ("CREDIT MEMO", "CREDIT ADVICE"):
            with self.subTest(heading=heading):
                source = f"{heading}\n" + single_asset_source().replace(
                    "12,800.00",
                    "100.00",
                )
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=94,
                )

                async def heading_transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(amount=100),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=heading_transport
                )
                self.assertIsNone(result.fields.amount)

    async def test_model_amount_over_two_decimals_is_rejected_exactly(self) -> None:
        source = single_asset_source().replace("12,800.00", "100.00")
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(amount=100.004),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.amount)
        self.assertTrue(any("两位小数" in warning for warning in result.warnings))

    async def test_invoice_number_is_never_accepted_as_amount(self) -> None:
        source = single_asset_source().replace(
            "Grand Total HKD 12,800.00",
            "Currency: HKD",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(amount=2026001),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.amount)
        self.assertEqual(result.fields.invoice_no, "INV-2026-001")
        self.assertEqual(result.confidence, "low")

    async def test_invoice_number_next_line_rejects_other_field_values(self) -> None:
        cases = (
            "Grand Total HKD 12,800.00",
            "Invoice Date: 19/07/2026",
            "2026-07-19",
            "HKD 12,800.00",
            "Total",
        )
        for next_line in cases:
            with self.subTest(next_line=next_line):
                source = single_asset_source().replace(
                    "Invoice No: INV-2026-001",
                    f"Invoice No:\n{next_line}",
                )
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=94,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(invoice_no=next_line),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertIsNone(result.fields.invoice_no)

        valid_source = single_asset_source().replace(
            "Invoice No: INV-2026-001",
            "Invoice No:\nINV-2026-001",
        )
        valid_request = InvoiceAIStructureRequest(
            ocr_text=valid_source,
            ocr_confidence=94,
        )

        async def valid_transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        valid_result = await structure_invoice_with_ai(
            valid_request,
            "unit-test-key",
            transport=valid_transport,
        )
        self.assertEqual(valid_result.fields.invoice_no, "INV-2026-001")

    async def test_bare_dollar_does_not_confirm_hkd_or_amount(self) -> None:
        source = single_asset_source().replace(
            "Grand Total HKD 12,800.00",
            "Grand Total $12,800.00",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.amount)
        self.assertIsNone(result.fields.currency)
        self.assertEqual(result.confidence, "low")

    async def test_total_currency_must_be_bound_to_the_total_window(self) -> None:
        total_sections = (
            "Exchange Rate USD 1 = HKD 7.8\nGrand Total USD100.00",
            "Currency: HKD\nGrand Total $100.00",
            "Grand Total HKD 100.00 USD",
            "Currency: HKD\nGrand Total EUR 100.00",
            "Currency: HKD\nGrand Total GBP 100.00",
            "Currency: HKD\nGrand Total CNY 100.00",
            "Currency: HKD\nGrand Total RMB 100.00",
        )
        for total_section in total_sections:
            with self.subTest(total_section=total_section):
                source = single_asset_source().replace(
                    "Grand Total HKD 12,800.00",
                    total_section,
                )
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=94,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(amount=100),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertIsNone(result.fields.amount)
                self.assertIsNone(result.fields.currency)
                self.assertEqual(result.confidence, "low")

    async def test_invoice_total_beats_balance_due_and_partial_balance_is_not_cost(self) -> None:
        source = single_asset_source().replace(
            "Grand Total HKD 12,800.00",
            "Total HKD 1,000.00\nPaid HKD 1,000.00\nBalance Due HKD 0.00",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(amount=1000),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertEqual(result.fields.amount, 1000)
        self.assertEqual(result.fields.currency, "HKD")

        partial_source = single_asset_source().replace(
            "Grand Total HKD 12,800.00",
            "Paid HKD 800.00\nBalance Due HKD 200.00",
        )
        partial_request = InvoiceAIStructureRequest(
            ocr_text=partial_source,
            ocr_confidence=94,
        )

        async def partial_transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(amount=200),
                "confidence": "high",
                "warnings": [],
            })

        partial_result = await structure_invoice_with_ai(
            partial_request,
            "unit-test-key",
            transport=partial_transport,
        )
        self.assertIsNone(partial_result.fields.amount)
        self.assertIsNone(partial_result.fields.currency)

        due_only_source = single_asset_source().replace(
            "Grand Total HKD 12,800.00",
            "Amount Due HKD 1,000.00",
        )
        due_only_request = InvoiceAIStructureRequest(
            ocr_text=due_only_source,
            ocr_confidence=94,
        )

        async def due_only_transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(amount=1000),
                "confidence": "high",
                "warnings": [],
            })

        due_only_result = await structure_invoice_with_ai(
            due_only_request,
            "unit-test-key",
            transport=due_only_transport,
        )
        self.assertEqual(due_only_result.fields.amount, 1000)
        self.assertEqual(due_only_result.fields.currency, "HKD")

    async def test_conflicting_final_totals_are_cleared(self) -> None:
        source = single_asset_source().replace(
            "Grand Total HKD 12,800.00",
            "Grand Total HKD 12,800.00\nTotal Amount HKD 12,000.00",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=91)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.amount)
        self.assertTrue(any("冲突" in warning for warning in result.warnings))

    async def test_due_date_is_not_used_as_purchase_date(self) -> None:
        source = single_asset_source() + "\nDue Date: 19/08/2026"
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(purchase_date="2026-08-19"),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.purchase_date)
        self.assertEqual(result.confidence, "low")

    async def test_ambiguous_day_month_date_is_cleared(self) -> None:
        source = single_asset_source().replace(
            "Invoice Date: 19/07/2026",
            "Invoice Date: 06/07/2026\nPrinted: 2026-07-20",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(purchase_date="2026-07-06"),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.purchase_date)
        self.assertEqual(result.confidence, "low")

    async def test_only_invoice_date_or_unique_generic_date_is_accepted(self) -> None:
        for label in (
            "Printed Date: 19/07/2026",
            "Order Date: 19/07/2026",
            "Payment Date: 19/07/2026",
            "Service Date: 19/07/2026",
            "Delivery Date: 19/07/2026",
            "Due Date: 19/07/2026",
        ):
            with self.subTest(label=label):
                source = single_asset_source().replace(
                    "Invoice Date: 19/07/2026",
                    label,
                )
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=94,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertIsNone(result.fields.purchase_date)
                self.assertEqual(result.confidence, "low")

        generic_source = single_asset_source().replace(
            "Invoice Date: 19/07/2026",
            "Date: 19/07/2026",
        )
        generic_request = InvoiceAIStructureRequest(
            ocr_text=generic_source,
            ocr_confidence=94,
        )

        async def generic_transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        generic_result = await structure_invoice_with_ai(
            generic_request,
            "unit-test-key",
            transport=generic_transport,
        )
        self.assertEqual(generic_result.fields.purchase_date, "2026-07-19")

    async def test_multiple_generic_date_labels_are_rejected(self) -> None:
        source = single_asset_source().replace(
            "Invoice Date: 19/07/2026",
            "Date: 19/07/2026\nDate: 20/07/2026",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=94)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.purchase_date)

    async def test_bill_to_name_is_not_accepted_as_vendor(self) -> None:
        source = "\n".join([
            "Bill To:",
            "18 Nathan Road",
            "Kowloon",
            "Hong Kong",
            "Pui Ying Secondary School",
            "Invoice No: INV-2026-001",
            "Invoice Date: 19/07/2026",
            "Description Qty Unit Price",
            "Lenovo ThinkPad E16 Laptop",
            "1",
            "Grand Total HKD 12,800.00",
        ])
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=93)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(vendor="Pui Ying Secondary School"),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.vendor)
        self.assertEqual(result.confidence, "medium")
        self.assertTrue(any("Bill To" in warning for warning in result.warnings))

    async def test_supplier_elsewhere_cannot_authorize_bill_to_as_vendor(self) -> None:
        source = "\n".join([
            "Supplier: ACME TECHNOLOGY LIMITED",
            "Bill To:",
            "Pui Ying Secondary School",
            "Invoice No: INV-2026-001",
            "Invoice Date: 19/07/2026",
            "Description Qty Unit Price",
            "Lenovo ThinkPad E16 Laptop",
            "1",
            "Grand Total HKD 12,800.00",
        ])
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=93)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(vendor="Pui Ying Secondary School"),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.vendor)
        self.assertEqual(result.confidence, "medium")

    async def test_unlabelled_page_header_is_not_accepted_as_vendor(self) -> None:
        source = single_asset_source().replace(
            "Supplier: ACME TECHNOLOGY LIMITED\n",
            "",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=93)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.vendor)
        self.assertEqual(result.confidence, "medium")

    async def test_vendor_requires_complete_labeled_value_and_meaningful_text(self) -> None:
        source = single_asset_source().replace(
            "ACME TECHNOLOGY LIMITED",
            "ACME Hong Kong Limited",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=93)

        for vendor in ("Hong Kong", ":"):
            with self.subTest(vendor=vendor):
                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(vendor=vendor),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertIsNone(result.fields.vendor)
                self.assertEqual(result.confidence, "medium")

    async def test_hallucinated_or_label_asset_name_is_cleared(self) -> None:
        source = single_asset_source().replace(
            "Lenovo ThinkPad E16 Laptop",
            "Description",
        )
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=90)

        for asset_name in ("Description", "不存在的電腦"):
            with self.subTest(asset_name=asset_name):
                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(asset_name=asset_name),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertIsNone(result.fields.asset_name)
                self.assertIsNone(result.fields.category)
                self.assertIsNone(result.fields.amount)
                self.assertTrue(result.fields.multiple_items)
                self.assertEqual(result.confidence, "low")

    async def test_numeric_symbol_vendor_and_buyer_are_not_asset_names(self) -> None:
        source = "\n".join([
            "Supplier: ACME TECHNOLOGY LIMITED",
            "Bill To: Pui Ying Secondary School",
            "Invoice No: INV-2026-001",
            "Invoice Date: 19/07/2026",
            "Description Qty Unit Price",
            "Lenovo ThinkPad E16 Laptop",
            "1",
            "Grand Total HKD 12,800.00",
        ])
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=90)

        for asset_name in (":", "1", "ACME TECHNOLOGY LIMITED", "Pui Ying Secondary School"):
            with self.subTest(asset_name=asset_name):
                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(asset_name=asset_name),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertIsNone(result.fields.asset_name)
                self.assertIsNone(result.fields.category)
                self.assertIsNone(result.fields.amount)
                self.assertTrue(result.fields.multiple_items)

    async def test_short_supplier_or_buyer_name_cannot_become_table_asset(self) -> None:
        for label, party in (("Supplier", "ACME"), ("Bill To", "PUIYING")):
            with self.subTest(label=label):
                source = "\n".join([
                    f"{label}: {party}",
                    "Invoice No: INV-2026-001",
                    "Invoice Date: 19/07/2026",
                    "Description Qty Unit Price",
                    party,
                    "1",
                    "Grand Total HKD 12,800.00",
                ])
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=90,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(asset_name=party),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertTrue(result.fields.multiple_items)
                self.assertIsNone(result.fields.asset_name)
                self.assertIsNone(result.fields.amount)

    async def test_multiple_lines_or_quantity_over_one_block_single_asset(self) -> None:
        sources = [
            single_asset_source().replace(
                "Lenovo ThinkPad E16 Laptop\n1",
                "Item 1 Lenovo ThinkPad E16 Laptop\nItem 2 Dell Monitor",
            ),
            single_asset_source().replace("\n1\n", "\nQuantity: 2\n"),
            single_asset_source().replace(
                "Lenovo ThinkPad E16 Laptop\n1",
                "Laptop 1 1,000.00 1,000.00\nMonitor 1 500.00 500.00",
            ).replace("12,800.00", "1,500.00"),
            single_asset_source().replace("\n1\n", "\nQty\n2\n"),
            single_asset_source().replace("\n1\n", "\n"),
        ]
        for source in sources:
            with self.subTest(source=source):
                request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=90)

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(multiple_items=False),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertTrue(result.fields.multiple_items)
                self.assertIsNone(result.fields.asset_name)
                self.assertIsNone(result.fields.category)
                self.assertIsNone(result.fields.amount)
                self.assertEqual(result.confidence, "low")

    async def test_two_common_table_rows_are_detected_even_when_model_claims_single(self) -> None:
        source = "\n".join([
            "Supplier: ACME TECHNOLOGY LIMITED",
            "Invoice No: INV-2026-001",
            "Invoice Date: 19/07/2026",
            "Description Qty Unit Price Amount",
            "Laptop 1 1,000.00 1,000.00",
            "Monitor 1 500.00 500.00",
            "Grand Total HKD 1,500.00",
        ])
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=90)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(
                    asset_name="Laptop",
                    amount=1500,
                    multiple_items=False,
                ),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertTrue(result.fields.multiple_items)
        self.assertIsNone(result.fields.asset_name)
        self.assertIsNone(result.fields.category)
        self.assertIsNone(result.fields.amount)
        self.assertEqual(result.confidence, "low")

    async def test_x_model_number_is_not_mistaken_for_quantity(self) -> None:
        for model_number, quantity, should_accept in (
            ("X1", 1, True),
            ("X2", 1, True),
            ("X1", 2, False),
        ):
            with self.subTest(model_number=model_number, quantity=quantity):
                source = single_asset_source().replace(
                    "Lenovo ThinkPad E16 Laptop\n1",
                    f"ThinkPad {model_number} Carbon {quantity} 1,000.00 "
                    f"{quantity * 1000:,.2f}",
                ).replace(
                    "Description Qty Unit Price",
                    "Description Qty Unit Price Amount",
                ).replace("12,800.00", f"{quantity * 1000:,.2f}")
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=90,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(
                            asset_name=f"ThinkPad {model_number} Carbon",
                            amount=quantity * 1000,
                        ),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                if should_accept:
                    self.assertFalse(result.fields.multiple_items)
                    self.assertEqual(
                        result.fields.asset_name,
                        f"ThinkPad {model_number} Carbon",
                    )
                else:
                    self.assertTrue(result.fields.multiple_items)
                    self.assertIsNone(result.fields.asset_name)
                    self.assertIsNone(result.fields.amount)

    async def test_quantity_column_order_is_mapped_instead_of_assuming_first_number(self) -> None:
        for quantity, should_accept in ((1, True), (2, False)):
            with self.subTest(quantity=quantity):
                total = float(quantity)
                source = "\n".join([
                    "Supplier: ACME TECHNOLOGY LIMITED",
                    "Invoice No: INV-2026-001",
                    "Invoice Date: 19/07/2026",
                    "Description Unit Price Qty Amount",
                    f"Cable 1.00 {quantity} {total:.2f}",
                    f"Grand Total HKD {total:.2f}",
                ])
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=90,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(
                            asset_name="Cable",
                            category="其他",
                            amount=total,
                        ),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                if should_accept:
                    self.assertFalse(result.fields.multiple_items)
                    self.assertEqual(result.fields.asset_name, "Cable")
                else:
                    self.assertTrue(result.fields.multiple_items)
                    self.assertIsNone(result.fields.asset_name)
                    self.assertIsNone(result.fields.amount)

        unknown_source = "\n".join([
            "Supplier: ACME TECHNOLOGY LIMITED",
            "Invoice No: INV-2026-001",
            "Invoice Date: 19/07/2026",
            "Description Mystery Cost Qty Amount",
            "Cable 1.00 1 1.00",
            "Grand Total HKD 1.00",
        ])
        unknown_request = InvoiceAIStructureRequest(
            ocr_text=unknown_source,
            ocr_confidence=90,
        )

        async def unknown_transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(
                    asset_name="Cable",
                    category="其他",
                    amount=1,
                ),
                "confidence": "high",
                "warnings": [],
            })

        unknown_result = await structure_invoice_with_ai(
            unknown_request,
            "unit-test-key",
            transport=unknown_transport,
        )
        self.assertTrue(unknown_result.fields.multiple_items)
        self.assertIsNone(unknown_result.fields.asset_name)

    async def test_numeric_model_suffix_is_preserved_before_quantity_columns(self) -> None:
        for quantity, should_accept in ((1, True), (2, False)):
            with self.subTest(quantity=quantity):
                total = quantity * 1000
                source = "\n".join([
                    "Supplier: ACME TECHNOLOGY LIMITED",
                    "Invoice No: INV-2026-001",
                    "Invoice Date: 19/07/2026",
                    "Description Qty Unit Price Amount",
                    f"Office Chair Type 1 {quantity} 1000 {total}",
                    f"Grand Total HKD {total}.00",
                ])
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=90,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(
                            asset_name="Office Chair Type 1",
                            category="傢俱",
                            amount=total,
                        ),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                if should_accept:
                    self.assertFalse(result.fields.multiple_items)
                    self.assertEqual(result.fields.asset_name, "Office Chair Type 1")
                else:
                    self.assertTrue(result.fields.multiple_items)
                    self.assertIsNone(result.fields.asset_name)
                    self.assertIsNone(result.fields.amount)

    async def test_compact_item_label_with_explicit_qty_one_is_supported(self) -> None:
        cases = (
            ("Item: Laptop\nQty: 1", "Laptop"),
            ("Item: Laptop Qty: 1", "Laptop"),
            ("品名：手提電腦\n數量：1", "手提電腦"),
        )
        for item_lines, asset_name in cases:
            with self.subTest(item_lines=item_lines):
                source = "\n".join([
                    "Supplier: ACME TECHNOLOGY LIMITED",
                    "Invoice No: INV-2026-001",
                    "Invoice Date: 19/07/2026",
                    item_lines,
                    "Grand Total HKD 12,800.00",
                ])
                request = InvoiceAIStructureRequest(
                    ocr_text=source,
                    ocr_confidence=90,
                )

                async def transport(url, headers, payload, timeout):
                    return model_response({
                        "fields": single_asset_fields(asset_name=asset_name),
                        "confidence": "high",
                        "warnings": [],
                    })

                result = await structure_invoice_with_ai(
                    request, "unit-test-key", transport=transport
                )
                self.assertFalse(result.fields.multiple_items)
                self.assertEqual(result.fields.asset_name, asset_name)
                self.assertEqual(result.fields.amount, 12800)
                self.assertEqual(result.confidence, "high")

    async def test_compact_item_label_without_quantity_remains_conservative(self) -> None:
        source = "\n".join([
            "Supplier: ACME TECHNOLOGY LIMITED",
            "Invoice No: INV-2026-001",
            "Invoice Date: 19/07/2026",
            "Item: Laptop",
            "Grand Total HKD 12,800.00",
        ])
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=90)

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(asset_name="Laptop"),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertTrue(result.fields.multiple_items)
        self.assertIsNone(result.fields.asset_name)
        self.assertIsNone(result.fields.amount)

    async def test_low_ocr_confidence_disables_asset_autofill(self) -> None:
        request = InvoiceAIStructureRequest(
            ocr_text=single_asset_source(),
            ocr_confidence=49.9,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertTrue(result.fields.multiple_items)
        self.assertIsNone(result.fields.asset_name)
        self.assertIsNone(result.fields.category)
        self.assertIsNone(result.fields.amount)
        self.assertEqual(result.confidence, "low")
        self.assertTrue(any("低于 50" in warning for warning in result.warnings))

    async def test_obvious_category_conflict_is_cleared(self) -> None:
        request = InvoiceAIStructureRequest(
            ocr_text=single_asset_source(),
            ocr_confidence=90,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(category="傢俱"),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertIsNone(result.fields.category)
        self.assertEqual(result.fields.asset_name, "Lenovo ThinkPad E16 Laptop")
        self.assertEqual(result.confidence, "medium")
        self.assertTrue(any("分类冲突" in warning for warning in result.warnings))

    async def test_model_multiple_items_always_blocks_single_asset(self) -> None:
        request = InvoiceAIStructureRequest(
            ocr_text=single_asset_source(),
            ocr_confidence=90,
        )

        async def transport(url, headers, payload, timeout):
            return model_response({
                "fields": single_asset_fields(multiple_items=True),
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertTrue(result.fields.multiple_items)
        self.assertIsNone(result.fields.asset_name)
        self.assertIsNone(result.fields.amount)
        self.assertEqual(result.confidence, "low")

    async def test_invalid_category_and_missing_multiple_flag_are_conservative(self) -> None:
        request = InvoiceAIStructureRequest(
            ocr_text=single_asset_source(),
            ocr_confidence=90,
        )

        async def transport(url, headers, payload, timeout):
            fields = single_asset_fields(category="消耗品")
            fields.pop("multiple_items")
            return model_response({
                "fields": fields,
                "confidence": "high",
                "warnings": [],
            })

        result = await structure_invoice_with_ai(
            request, "unit-test-key", transport=transport
        )
        self.assertTrue(result.fields.multiple_items)
        self.assertIsNone(result.fields.category)
        self.assertIsNone(result.fields.amount)
        self.assertEqual(result.confidence, "low")

    async def test_invalid_json_retries_once_without_replaying_or_logging_secrets(self) -> None:
        source = "private-invoice-ocr-marker\n" + single_asset_source()
        secret = "unit-test-secret-key"
        model_marker = "bad-model-output-marker"
        request = InvoiceAIStructureRequest(ocr_text=source, ocr_confidence=90)
        payloads: list[dict] = []

        async def transport(url, headers, payload, timeout):
            payloads.append(payload)
            if len(payloads) == 1:
                return {"choices": [{"message": {"content": model_marker}}]}
            return model_response({
                "fields": single_asset_fields(),
                "confidence": "high",
                "warnings": [],
            })

        with self.assertLogs(
            "app.modules.ocr.invoice_ai_service",
            level="WARNING",
        ) as captured:
            result = await structure_invoice_with_ai(
                request, secret, transport=transport
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

    async def test_transport_error_is_not_retried_and_is_safely_wrapped(self) -> None:
        request = InvoiceAIStructureRequest(
            ocr_text=single_asset_source(),
            ocr_confidence=90,
        )
        calls = 0

        async def transport(url, headers, payload, timeout):
            nonlocal calls
            calls += 1
            raise AIReceiptError("DeepSeek API Key 无效")

        with self.assertRaisesRegex(AIInvoiceError, "API Key 无效"):
            await structure_invoice_with_ai(
                request, "unit-test-key", transport=transport
            )
        self.assertEqual(calls, 1)

    async def test_two_invalid_responses_report_safe_error(self) -> None:
        request = InvoiceAIStructureRequest(
            ocr_text=single_asset_source(),
            ocr_confidence=90,
        )
        calls = 0

        async def transport(url, headers, payload, timeout):
            nonlocal calls
            calls += 1
            return {"choices": [{"message": {"content": "not-json"}}]}

        with self.assertRaisesRegex(AIInvoiceError, "资产发票 JSON 规范") as caught:
            await structure_invoice_with_ai(
                request, "unit-test-secret-key", transport=transport
            )
        self.assertEqual(calls, 2)
        self.assertNotIn("unit-test-secret-key", str(caught.exception))

    async def test_short_key_is_rejected_without_echoing_it(self) -> None:
        request = InvoiceAIStructureRequest(
            ocr_text=single_asset_source(),
            ocr_confidence=90,
        )
        with self.assertRaisesRegex(AIInvoiceError, "有效") as caught:
            await structure_invoice_with_ai(request, "short")
        self.assertNotIn("short", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
