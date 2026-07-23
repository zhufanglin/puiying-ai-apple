"""Data access helpers for Apple notice templates and notifications."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.pagination import paginate
from app.modules.apple.notifications.models import Notification, NotificationLog, NoticeTemplate


async def list_templates(db: AsyncSession) -> list[NoticeTemplate]:
    result = await db.execute(
        select(NoticeTemplate)
        .where(NoticeTemplate.is_active.is_(True))
        .order_by(NoticeTemplate.category, NoticeTemplate.name)
    )
    return list(result.scalars().all())


async def get_template(db: AsyncSession, template_id: int) -> NoticeTemplate | None:
    result = await db.execute(select(NoticeTemplate).where(NoticeTemplate.id == template_id))
    return result.scalar_one_or_none()


async def create_template(db: AsyncSession, data: dict) -> NoticeTemplate:
    template = NoticeTemplate(**data)
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


async def update_template(
    db: AsyncSession,
    template: NoticeTemplate,
    data: dict,
) -> NoticeTemplate:
    for key, value in data.items():
        if value is not None:
            setattr(template, key, value)
    await db.flush()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, template: NoticeTemplate) -> None:
    template.is_active = False
    await db.flush()


async def list_notifications(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Notification], int, int]:
    stmt = select(Notification).order_by(Notification.created_at.desc(), Notification.id.desc())
    return await paginate(db, stmt, page, page_size)


async def get_notification(db: AsyncSession, notification_id: int) -> Notification | None:
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    return result.scalar_one_or_none()


async def create_notification(db: AsyncSession, data: dict) -> Notification:
    notification = Notification(**data)
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification


async def update_notification(
    db: AsyncSession,
    notification: Notification,
    data: dict,
) -> Notification:
    for key, value in data.items():
        if value is not None:
            setattr(notification, key, value)
    await db.flush()
    await db.refresh(notification)
    return notification


async def list_logs_by_notification(
    db: AsyncSession,
    notification_id: int,
) -> list[NotificationLog]:
    result = await db.execute(
        select(NotificationLog)
        .where(NotificationLog.notification_id == notification_id)
        .order_by(NotificationLog.id)
    )
    return list(result.scalars().all())


async def create_log(db: AsyncSession, data: dict) -> NotificationLog:
    log = NotificationLog(**data)
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log


async def count_logs_by_status(
    db: AsyncSession,
    notification_id: int | None = None,
) -> dict[str, int]:
    stmt = select(NotificationLog.message_status, func.count(NotificationLog.id)).group_by(
        NotificationLog.message_status
    )
    if notification_id is not None:
        stmt = stmt.where(NotificationLog.notification_id == notification_id)

    result = await db.execute(stmt)
    counts = {str(status): int(count) for status, count in result.all()}
    total = sum(counts.values())
    return {
        "total": total,
        "sent": counts.get("sent", 0),
        "delivered": counts.get("delivered", 0),
        "read": counts.get("read", 0),
        "failed": counts.get("failed", 0),
    }
