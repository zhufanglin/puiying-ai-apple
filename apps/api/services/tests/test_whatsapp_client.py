from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from services.whatsapp_client import WhatsAppClient


class WhatsAppClientTest(unittest.TestCase):
    def test_send_text_mock_returns_sent_result(self) -> None:
        with (
            patch.dict(os.environ, {"WHATSAPP_MOCK_MODE": "true"}),
            patch("services.whatsapp_client.time.time", return_value=1234567890),
        ):
            result = WhatsAppClient().send_text("+85261234567", "Hello 这是一条测试消息")

        self.assertEqual(result, {
            "status": "sent",
            "message_id": "mock_1234567890",
            "phone": "+85261234567",
        })

    def test_send_template_mock_returns_template_result(self) -> None:
        with (
            patch.dict(os.environ, {"WHATSAPP_MOCK_MODE": "true"}),
            patch("services.whatsapp_client.time.time", return_value=1234567890),
        ):
            result = WhatsAppClient().send_template(
                "+85261234567",
                "notice_template",
                {"date": "2026-07-24"},
            )

        self.assertEqual(result, {
            "status": "sent",
            "message_id": "mock_1234567890",
            "phone": "+85261234567",
            "template": "notice_template",
        })

    def test_send_text_real_mode_builds_meta_payload(self) -> None:
        env = {
            "WHATSAPP_MOCK_MODE": "false",
            "WHATSAPP_API_VERSION": "v22.0",
            "WHATSAPP_PHONE_NUMBER_ID": "phone-number-id",
            "WHATSAPP_ACCESS_TOKEN": "access-token",
        }
        with (
            patch.dict(os.environ, env),
            patch.object(
                WhatsAppClient,
                "_post_message",
                return_value={"messages": [{"id": "wamid.123"}]},
            ) as post_message,
        ):
            result = WhatsAppClient().send_text("+85261234567", "家长您好")

        self.assertEqual(result["status"], "sent")
        self.assertEqual(result["message_id"], "wamid.123")
        self.assertEqual(result["phone"], "+85261234567")
        post_message.assert_called_once_with({
            "messaging_product": "whatsapp",
            "to": "+85261234567",
            "type": "text",
            "text": {"body": "家长您好"},
        })

    def test_send_template_real_mode_builds_meta_payload(self) -> None:
        env = {
            "WHATSAPP_MOCK_MODE": "false",
            "WHATSAPP_PHONE_NUMBER_ID": "phone-number-id",
            "WHATSAPP_ACCESS_TOKEN": "access-token",
        }
        with (
            patch.dict(os.environ, env),
            patch.object(
                WhatsAppClient,
                "_post_message",
                return_value={"messages": [{"id": "wamid.template"}]},
            ) as post_message,
        ):
            result = WhatsAppClient().send_template(
                "+85261234567",
                "notice_template",
                {"language_code": "zh_HK", "body": {"date": "2026-07-24", "time": "09:00"}},
            )

        self.assertEqual(result["status"], "sent")
        self.assertEqual(result["message_id"], "wamid.template")
        post_message.assert_called_once_with({
            "messaging_product": "whatsapp",
            "to": "+85261234567",
            "type": "template",
            "template": {
                "name": "notice_template",
                "language": {"code": "zh_HK"},
                "components": [{
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": "2026-07-24"},
                        {"type": "text", "text": "09:00"},
                    ],
                }],
            },
        })

    def test_handle_webhook_extracts_status_updates(self) -> None:
        payload = {
            "entry": [{
                "changes": [{
                    "value": {
                        "statuses": [
                            {"id": "wamid.1", "status": "delivered", "timestamp": "1780000000"},
                            {"id": "wamid.2", "status": "read", "timestamp": "1780000060"},
                        ]
                    }
                }]
            }]
        }

        result = WhatsAppClient().handle_webhook(payload)

        self.assertEqual(result, [
            {"message_id": "wamid.1", "status": "delivered", "timestamp": "1780000000"},
            {"message_id": "wamid.2", "status": "read", "timestamp": "1780000060"},
        ])

    def test_real_mode_missing_config_returns_failed_result(self) -> None:
        env = {
            "WHATSAPP_MOCK_MODE": "false",
            "WHATSAPP_PHONE_NUMBER_ID": "",
            "WHATSAPP_ACCESS_TOKEN": "",
        }
        with (
            patch.dict(os.environ, env),
            patch("services.whatsapp_client.logger.exception"),
        ):
            result = WhatsAppClient().send_text("+85261234567", "家长您好")

        self.assertEqual(result["status"], "failed")
        self.assertIn("WHATSAPP_PHONE_NUMBER_ID", result["error"])


if __name__ == "__main__":
    unittest.main()
