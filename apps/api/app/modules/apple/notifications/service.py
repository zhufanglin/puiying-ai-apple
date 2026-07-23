"""Business logic for notice content generation and WhatsApp delivery."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.apple.notifications import repository
from app.modules.apple.students.student_service import StudentService
from services.whatsapp_client import WhatsAppClient


def render_template_content(
    zh_template: str,
    en_template: str | None,
    placeholders: dict[str, Any],
) -> dict[str, str]:
    content_zh = zh_template
    content_en = en_template or ""

    for key, value in placeholders.items():
        placeholder = "{{" + key + "}}"
        content_zh = content_zh.replace(placeholder, str(value))
        content_en = content_en.replace(placeholder, str(value))

    return {"content_zh": content_zh, "content_en": content_en}


async def generate_notice_content(
    template_id: int,
    placeholders: dict[str, Any],
    db: AsyncSession,
) -> dict[str, str]:
    template = await repository.get_template(db, template_id)
    if not template:
        return {"error": "template not found"}

    return render_template_content(
        template.zh_content_template,
        template.en_content_template,
        placeholders,
    )


async def send_notification_to_parents(
    notification_id: int,
    db: AsyncSession,
) -> dict[str, Any]:
    notification = await repository.get_notification(db, notification_id)
    if not notification:
        return {"error": "notification not found"}

    try:
        classes = json.loads(notification.target_classes) if notification.target_classes else []
    except json.JSONDecodeError:
        return {"error": "invalid target classes"}

    if not classes:
        return {"error": "no target classes"}

    all_parents: list[dict[str, str | None]] = []
    students = StudentService()
    for class_name in classes:
        all_parents.extend(students.list_parent_phones(str(class_name)))

    if not all_parents:
        return {"error": "no parent phones found"}

    client = WhatsAppClient()
    success_count = 0
    fail_count = 0
    message = f"{notification.title_zh}\n\n{notification.content_zh}"

    for parent in all_parents:
        phone = str(parent["phone"])
        result = client.send_text(phone, message)
        await repository.create_log(db, {
            "notification_id": notification_id,
            "parent_phone": phone,
            "student_name": str(parent["student_name"]),
            "message_status": "sent" if result.get("status") == "sent" else "failed",
            "error_msg": result.get("error"),
            "status_updated_at": datetime.now(timezone.utc),
        })

        if result.get("status") == "sent":
            success_count += 1
        else:
            fail_count += 1

    status = "sent" if fail_count == 0 else "partial" if success_count else "failed"
    await repository.update_notification(db, notification, {
        "status": status,
        "sent_at": datetime.now(timezone.utc),
    })

    return {
        "total": len(all_parents),
        "success": success_count,
        "failed": fail_count,
        "status": status,
    }
