"""WhatsApp Webhook callback endpoints for delivery/read receipts."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.apple.notifications.models import NotificationLog
from services.whatsapp_client import WhatsAppClient

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Receive WhatsApp message status updates from Meta."""
    payload = await request.json()
    logger.info("WhatsApp webhook received")

    parsed = WhatsAppClient().handle_webhook(payload)
    if isinstance(parsed, dict) and parsed.get("status") == "failed":
        return parsed

    status_updates: list[dict[str, Any]] = []
    for item in parsed:
        message_id = str(item.get("message_id", ""))
        status = str(item.get("status", ""))
        log_id = _extract_log_id(message_id)

        if log_id is None:
            status_updates.append({
                "message_id": message_id,
                "status": status,
                "updated": False,
                "reason": "message_id cannot be mapped to notification_log.id",
            })
            continue

        try:
            result = await db.execute(
                update(NotificationLog)
                .where(NotificationLog.id == log_id)
                .values(
                    message_status=status,
                    status_updated_at=datetime.now(timezone.utc),
                )
            )
            status_updates.append({
                "message_id": message_id,
                "status": status,
                "updated": result.rowcount > 0,
            })
        except Exception as exc:
            logger.exception("Failed to update notification log for message %s", message_id)
            status_updates.append({
                "message_id": message_id,
                "status": status,
                "updated": False,
                "error": str(exc),
            })

    await db.flush()
    return {"status": "ok", "updates": status_updates}


@router.get("/webhooks/whatsapp")
async def verify_webhook(request: Request) -> Response:
    """Verify WhatsApp webhook ownership for Meta subscription setup."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    verify_token = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "apple_webhook_2026")
    if mode == "subscribe" and token == verify_token and challenge is not None:
        logger.info("WhatsApp webhook verified")
        return PlainTextResponse(challenge)

    logger.warning("WhatsApp webhook verification failed: mode=%s", mode)
    return JSONResponse({"error": "verification failed"})


def _extract_log_id(message_id: str) -> int | None:
    """Map mock/numeric message ids to local NotificationLog ids when possible."""
    if message_id.isdigit():
        return int(message_id)
    if message_id.startswith("mock_"):
        suffix = message_id.removeprefix("mock_")
        if suffix.isdigit():
            return int(suffix)
    return None
