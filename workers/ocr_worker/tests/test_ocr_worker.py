from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from workers.ocr_worker.handlers.receipt_handler import ReceiptHandler
from workers.ocr_worker.job_store import OcrJobStore
from workers.ocr_worker.services.ocr_engine import BaiduOcrBackend, OcrEngine
from workers.ocr_worker.tasks import process_ocr_job_sync


class OcrWorkerTest(unittest.TestCase):
    def test_direct_text_engine(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "receipt.txt"
            path.write_text("HK$1,200.00", encoding="utf-8")
            result = OcrEngine().extract(path)
            self.assertEqual(result.engine, "direct_document")
            self.assertEqual(result.confidence, 1.0)

    def test_receipt_handler_extracts_structured_fields(self) -> None:
        result = ReceiptHandler().process("日期 16/7/2026；付款人：陈先生；用途：活动费；HK$1,200.00", 0.92)
        self.assertEqual(result["fields"]["amount"], 1200.0)
        self.assertEqual(result["fields"]["date"], "2026-07-16")
        self.assertEqual(result["fields"]["currency"], "HKD")
        self.assertEqual(result["confidence"], "high")

    def test_receipt_handler_does_not_invent_amount(self) -> None:
        result = ReceiptHandler().process("手写金额无法辨认", 0.42)
        self.assertIsNone(result["fields"]["amount"])
        self.assertEqual(result["confidence"], "low")
        self.assertTrue(result["warnings"])

    def test_process_job_moves_to_needs_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            source = data_dir / "receipt.txt"
            source.write_text("日期 16/7/2026；HK$1,200.00", encoding="utf-8")
            state = {
                "files": [{"id": "file-1", "path": str(source)}],
                "sources": [],
                "aiJobs": [{"id": "job-1", "jobType": "ocr.extract_receipt", "module": "apple", "sourceFileId": "file-1", "status": "pending"}],
                "auditLogs": [],
            }
            (data_dir / "apple_students_state.json").write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
            result = process_ocr_job_sync("job-1", store=OcrJobStore(data_dir), engine=OcrEngine())
            self.assertEqual(result["status"], "needs_review")
            self.assertTrue(result["humanReviewRequired"])
            saved = json.loads((data_dir / "apple_students_state.json").read_text(encoding="utf-8"))
            self.assertEqual(saved["aiJobs"][0]["result"]["fields"]["amount"], 1200.0)

    def test_baidu_backend_gets_token_and_parses_words(self) -> None:
        calls: list[tuple[str, str, dict[str, str] | None]] = []

        def transport(url: str, data: dict[str, str] | None, method: str, timeout: float) -> dict:
            self.assertEqual(timeout, 5)
            calls.append((url, method, data))
            if "/oauth/2.0/token" in url:
                return {"access_token": "test-token", "expires_in": 2592000}
            self.assertIn("/ocr/v1/handwriting", url)
            self.assertEqual(method, "POST")
            self.assertIsNotNone(data)
            self.assertIn("image", data or {})
            self.assertEqual((data or {}).get("probability"), "true")
            return {
                "log_id": 123,
                "words_result_num": 2,
                "words_result": [
                    {"words": "日期 16/7/2026", "probability": {"average": 0.92}},
                    {"words": "HK$1,200.00", "probability": {"average": 0.88}},
                ],
            }

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "receipt.png"
            path.write_bytes(b"fake-png-for-mocked-http")
            backend = BaiduOcrBackend(
                api_key="unit-test-ak",
                secret_key="unit-test-sk",
                mode="handwriting",
                timeout=5,
                transport=transport,
            )
            result = backend.extract(path)
        self.assertEqual(result.engine, "baidu_ocr")
        self.assertEqual(result.text, "日期 16/7/2026\nHK$1,200.00")
        self.assertAlmostEqual(result.confidence, 0.90)
        self.assertEqual([call[1] for call in calls], ["GET", "POST"])


if __name__ == "__main__":
    unittest.main()
