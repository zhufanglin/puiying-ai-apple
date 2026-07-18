from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path

from workers.ocr_worker.handlers.receipt_handler import ReceiptHandler
from workers.ocr_worker.services.ocr_engine import BaiduOcrBackend, OcrEngine, OcrResult
from sqlalchemy.pool import NullPool

from workers.ocr_worker.tasks import build_job_result, create_worker_session_factory


class BaiduOcrWorkerTest(unittest.TestCase):
    def setUp(self) -> None:
        BaiduOcrBackend._token_cache.clear()

    def test_receipt_handler_extracts_structured_fields(self) -> None:
        result = ReceiptHandler().process(
            "日期 16/7/2026；付款人：陈先生；用途：活动费；HK$1,200.00",
            92,
        )
        self.assertEqual(result["fields"]["amount"], 1200.0)
        self.assertEqual(result["fields"]["date"], "2026-07-16")
        self.assertEqual(result["confidence"], "high")

    def test_receipt_handler_does_not_invent_amount(self) -> None:
        result = ReceiptHandler().process("手写金额无法辨认", 42)
        self.assertIsNone(result["fields"]["amount"])
        self.assertEqual(result["confidence"], "low")
        self.assertTrue(result["warnings"])

    def test_baidu_backend_requires_credentials(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "缺少"):
            BaiduOcrBackend(api_key="", secret_key="", access_token="")

    def test_baidu_backend_gets_token_and_parses_words(self) -> None:
        calls: list[tuple[str, str, dict[str, str] | None]] = []

        def transport(url: str, data: dict[str, str] | None, method: str, timeout: float) -> dict:
            self.assertEqual(timeout, 5)
            calls.append((url, method, data))
            if "/oauth/2.0/token" in url:
                return {"access_token": "test-token", "expires_in": 2592000}
            self.assertIn("/ocr/v1/handwriting", url)
            self.assertNotIn("unit-test-sk", url)
            return {
                "words_result": [
                    {"words": "日期 16/7/2026", "probability": {"average": 0.92}},
                    {"words": "HK$1,200.00", "probability": {"average": 0.88}},
                ],
            }

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "receipt.png"
            path.write_bytes(b"fake-png-for-mocked-http")
            result = BaiduOcrBackend(
                api_key="unit-test-ak",
                secret_key="unit-test-sk",
                mode="handwriting",
                timeout=5,
                transport=transport,
            ).extract(path)

        self.assertEqual(result.engine, "baidu_ocr")
        self.assertEqual(result.text, "日期 16/7/2026\nHK$1,200.00")
        self.assertAlmostEqual(result.confidence, 90)
        self.assertEqual([call[1] for call in calls], ["GET", "POST"])

    def test_access_token_skips_token_request(self) -> None:
        calls: list[str] = []

        def transport(url: str, data: dict[str, str] | None, method: str, timeout: float) -> dict:
            calls.append(url)
            return {"words_result": [{"words": "测试"}]}

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "document.jpg"
            path.write_bytes(b"fake")
            BaiduOcrBackend(access_token="ready-token", transport=transport).extract(path)
        self.assertEqual(len(calls), 1)
        self.assertIn("access_token=ready-token", calls[0])

    def test_baidu_api_error_is_reported(self) -> None:
        def transport(url: str, data: dict[str, str] | None, method: str, timeout: float) -> dict:
            return {"error_code": 17, "error_msg": "Open api daily request limit reached"}

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "receipt.jpg"
            path.write_bytes(b"fake")
            backend = BaiduOcrBackend(access_token="secret-token", transport=transport)
            with self.assertRaisesRegex(RuntimeError, "错误 17") as caught:
                backend.extract(path)
        self.assertNotIn("secret-token", str(caught.exception))

    def test_job_type_selects_handwriting_for_receipt(self) -> None:
        modes: list[str] = []

        class FakeBackend:
            def __init__(self, *, mode: str) -> None:
                modes.append(mode)

            def extract(self, path: str | Path) -> OcrResult:
                return OcrResult("ok", 100, "fake")

        OcrEngine(backend_factory=FakeBackend).extract(__file__, job_type="receipt")
        self.assertEqual(modes, ["handwriting"])

    def test_build_job_result_contains_browser_contract(self) -> None:
        result = build_job_result(
            "receipt",
            OcrResult(
                "用途：活动费\nHK$100.00",
                90,
                "baidu_ocr",
                lines=[{
                    "text": "HK$100.00",
                    "confidence": 90,
                    "bbox": {"x0": 0, "y0": 0, "x1": 1, "y1": 1},
                }],
            ),
        )
        self.assertEqual(result["ocr"]["engine"], "baidu_ocr")
        self.assertEqual(result["fields"]["amount"], 100.0)
        self.assertIn("raw_text", result)

    def test_worker_sessions_do_not_reuse_connections_across_event_loops(self) -> None:
        url = "sqlite+aiosqlite:///:memory:"
        first_engine, _ = create_worker_session_factory(url)
        second_engine, _ = create_worker_session_factory(url)
        try:
            self.assertIsNot(first_engine, second_engine)
            self.assertIsInstance(first_engine.sync_engine.pool, NullPool)
            self.assertIsInstance(second_engine.sync_engine.pool, NullPool)
        finally:
            asyncio.run(first_engine.dispose())
            asyncio.run(second_engine.dispose())


if __name__ == "__main__":
    unittest.main()
