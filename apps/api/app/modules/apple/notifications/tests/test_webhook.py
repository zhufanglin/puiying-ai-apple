from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.modules.apple.notifications.webhook import _extract_log_id


class WhatsAppWebhookTest(unittest.TestCase):
    def test_extract_log_id_supports_numeric_and_mock_ids(self) -> None:
        self.assertEqual(_extract_log_id("42"), 42)
        self.assertEqual(_extract_log_id("mock_42"), 42)
        self.assertIsNone(_extract_log_id("mock_not_numeric"))
        self.assertIsNone(_extract_log_id("wamid.123"))

    def test_verify_webhook_returns_challenge(self) -> None:
        with patch.dict(os.environ, {"WHATSAPP_WEBHOOK_VERIFY_TOKEN": "test-token"}):
            response = TestClient(app).get(
                "/api/v1/webhooks/whatsapp",
                params={
                    "hub.mode": "subscribe",
                    "hub.verify_token": "test-token",
                    "hub.challenge": "challenge-123",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, "challenge-123")

    def test_webhook_routes_are_registered(self) -> None:
        routes = {
            (route.path, tuple(sorted(route.methods or [])))
            for route in app.routes
            if route.path == "/api/v1/webhooks/whatsapp"
        }

        self.assertIn(("/api/v1/webhooks/whatsapp", ("GET",)), routes)
        self.assertIn(("/api/v1/webhooks/whatsapp", ("POST",)), routes)


if __name__ == "__main__":
    unittest.main()
