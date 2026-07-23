"""WhatsApp Business API client for Apple notification delivery.

The client defaults to mock mode so local development and demos can send
messages without external Meta credentials.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)


class WhatsAppClient:
    """Send WhatsApp text/template messages and parse delivery webhooks."""

    def __init__(self, mock: bool = True) -> None:
        self.api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")
        self.phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        self.access_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")

        env_mock = os.getenv("WHATSAPP_MOCK_MODE")
        self.mock = env_mock.lower() == "true" if env_mock is not None else mock

    def send_text(self, phone: str, message: str) -> dict[str, Any]:
        """Send a WhatsApp text message."""
        try:
            if self.mock:
                logger.info("[MOCK WhatsApp] 发送消息给 %s：%s...", phone, message[:50])
                return {
                    "status": "sent",
                    "message_id": f"mock_{int(time.time())}",
                    "phone": phone,
                }

            payload = {
                "messaging_product": "whatsapp",
                "to": phone,
                "type": "text",
                "text": {"body": message},
            }
            data = self._post_message(payload)
            return {
                "status": "sent",
                "message_id": self._extract_message_id(data),
                "phone": phone,
                "response": data,
            }
        except Exception as exc:
            logger.exception("Failed to send WhatsApp text message to %s", phone)
            return {"status": "failed", "error": str(exc)}

    def send_template(self, phone: str, template_name: str, params: dict[str, Any]) -> dict[str, Any]:
        """Send a WhatsApp template message."""
        try:
            if self.mock:
                logger.info(
                    "[MOCK WhatsApp] 发送模板 %s 给 %s，参数：%s",
                    template_name,
                    phone,
                    params,
                )
                return {
                    "status": "sent",
                    "message_id": f"mock_{int(time.time())}",
                    "phone": phone,
                    "template": template_name,
                }

            language_code = str(params.get("language_code", "zh_HK"))
            body_params = params.get("body", params)
            if isinstance(body_params, dict):
                body_values = list(body_params.values())
            elif isinstance(body_params, list):
                body_values = body_params
            else:
                body_values = []

            payload = {
                "messaging_product": "whatsapp",
                "to": phone,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": language_code},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": str(value)}
                                for value in body_values
                            ],
                        }
                    ],
                },
            }
            data = self._post_message(payload)
            return {
                "status": "sent",
                "message_id": self._extract_message_id(data),
                "phone": phone,
                "template": template_name,
                "response": data,
            }
        except Exception as exc:
            logger.exception("Failed to send WhatsApp template %s to %s", template_name, phone)
            return {"status": "failed", "error": str(exc)}

    def handle_webhook(self, payload: dict[str, Any]) -> list[dict[str, Any]] | dict[str, Any]:
        """Parse WhatsApp delivery/read status updates from a webhook payload."""
        try:
            statuses: list[dict[str, Any]] = []
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    for status_item in value.get("statuses", []):
                        statuses.append(
                            {
                                "message_id": status_item.get("id", ""),
                                "status": status_item.get("status", ""),
                                "timestamp": status_item.get("timestamp", ""),
                            }
                        )
            logger.info("Parsed %s WhatsApp webhook status update(s)", len(statuses))
            return statuses
        except Exception as exc:
            logger.exception("Failed to parse WhatsApp webhook payload")
            return {"status": "failed", "error": str(exc)}

    def _post_message(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.phone_number_id:
            raise ValueError("WHATSAPP_PHONE_NUMBER_ID is not configured")
        if not self.access_token:
            raise ValueError("WHATSAPP_ACCESS_TOKEN is not configured")

        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        try:
            import httpx

            with httpx.Client(timeout=20.0) as client:
                response = client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()
        except ImportError:
            return self._post_message_with_urllib(url, headers, payload)

    def _post_message_with_urllib(
        self,
        url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        import json
        from urllib.error import HTTPError
        from urllib.request import Request, urlopen

        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"WhatsApp API error {exc.code}: {body}") from exc

    def _extract_message_id(self, data: dict[str, Any]) -> str:
        messages = data.get("messages") or []
        if not messages:
            raise ValueError("WhatsApp API response did not include messages[0].id")
        message_id = messages[0].get("id")
        if not message_id:
            raise ValueError("WhatsApp API response did not include messages[0].id")
        return str(message_id)
