"""Apple notice templates, notifications, WhatsApp sending, and logs API."""
from __future__ import annotations

import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import NOT_FOUND, raise_error
from app.common.schemas import APIResponse, PaginatedData
from app.core.permissions import Permissions, require_permission
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.accounts.models import User
from app.modules.audit.models import AuditLog
from app.modules.apple.notifications import repository, service
from app.modules.apple.notifications.schemas import (
    NotificationCreate,
    NotificationGenerateRequest,
    NotificationLogResponse,
    NotificationResponse,
    NotificationStatsResponse,
    NoticeTemplateCreate,
    NoticeTemplateResponse,
    NoticeTemplateUpdate,
)

router = APIRouter(prefix="/apple/notifications")


@router.get("/templates", response_model=APIResponse[list[NoticeTemplateResponse]])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.NOTIFICATIONS_READ)),
):
    """通告模板列表"""
    return APIResponse(data=await repository.list_templates(db))


@router.post("/templates", response_model=APIResponse[NoticeTemplateResponse])
async def create_template(
    body: NoticeTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.NOTIFICATIONS_WRITE)),
):
    """新增通告模板"""
    template = await repository.create_template(db, body.model_dump())
    db.add(AuditLog(
        user_id=user.id,
        username=user.username,
        action="create",
        module="notifications",
        entity_type="notice_template",
        entity_id=template.id,
        detail={"name": template.name},
    ))
    await db.flush()
    return APIResponse(data=template)


@router.put("/templates/{template_id}", response_model=APIResponse[NoticeTemplateResponse])
async def update_template(
    template_id: int,
    body: NoticeTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.NOTIFICATIONS_WRITE)),
):
    """编辑通告模板"""
    template = await repository.get_template(db, template_id)
    if not template:
        raise_error(*NOT_FOUND, status_code=404)

    updated = await repository.update_template(
        db,
        template,
        body.model_dump(exclude_unset=True, exclude_none=True),
    )
    db.add(AuditLog(
        user_id=user.id,
        username=user.username,
        action="update",
        module="notifications",
        entity_type="notice_template",
        entity_id=template_id,
        detail={"fields": sorted(body.model_dump(exclude_unset=True))},
    ))
    await db.flush()
    return APIResponse(data=updated)


@router.delete("/templates/{template_id}", response_model=APIResponse[None])
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.NOTIFICATIONS_WRITE)),
):
    """软删除通告模板"""
    template = await repository.get_template(db, template_id)
    if not template:
        raise_error(*NOT_FOUND, status_code=404)

    await repository.delete_template(db, template)
    db.add(AuditLog(
        user_id=user.id,
        username=user.username,
        action="delete",
        module="notifications",
        entity_type="notice_template",
        entity_id=template_id,
    ))
    await db.flush()
    return APIResponse(message="已删除")


@router.get("/stats", response_model=APIResponse[NotificationStatsResponse])
async def notification_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.NOTIFICATIONS_READ)),
):
    """发送状态统计"""
    return APIResponse(data=await repository.count_logs_by_status(db))


@router.get("", response_model=APIResponse[PaginatedData[NotificationResponse]])
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.NOTIFICATIONS_READ)),
):
    """发送记录列表"""
    items, total, total_pages = await repository.list_notifications(db, page, page_size)
    return APIResponse(data=PaginatedData(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    ))


@router.post("", response_model=APIResponse[NotificationResponse])
async def create_notification(
    body: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.NOTIFICATIONS_WRITE)),
):
    """新建通告草稿"""
    generated = await service.generate_notice_content(body.template_id, body.placeholders, db)
    if "error" in generated:
        raise_error(*NOT_FOUND, status_code=404)

    notification = await repository.create_notification(db, {
        "template_id": body.template_id,
        "title_zh": body.title_zh,
        "title_en": body.title_en,
        "content_zh": generated["content_zh"],
        "content_en": generated["content_en"],
        "target_classes": json.dumps(body.target_classes, ensure_ascii=False),
        "status": "draft",
        "created_by": user.id,
    })
    db.add(AuditLog(
        user_id=user.id,
        username=user.username,
        action="create",
        module="notifications",
        entity_type="notification",
        entity_id=notification.id,
        detail={"title_zh": notification.title_zh, "target_classes": body.target_classes},
    ))
    await db.flush()
    return APIResponse(data=notification)


@router.get("/{notification_id}", response_model=APIResponse[NotificationResponse])
async def get_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.NOTIFICATIONS_READ)),
):
    """通告详情"""
    notification = await repository.get_notification(db, notification_id)
    if not notification:
        raise_error(*NOT_FOUND, status_code=404)
    return APIResponse(data=notification)


@router.post("/{notification_id}/generate", response_model=APIResponse[NotificationResponse])
async def generate_notification_content(
    notification_id: int,
    body: NotificationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.NOTIFICATIONS_WRITE)),
):
    """根据模板和占位符生成中英文内容"""
    notification = await repository.get_notification(db, notification_id)
    if not notification:
        raise_error(*NOT_FOUND, status_code=404)
    if notification.template_id is None:
        raise_error(40001, "通告没有关联模板")

    generated = await service.generate_notice_content(notification.template_id, body.placeholders, db)
    if "error" in generated:
        raise_error(*NOT_FOUND, status_code=404)

    updated = await repository.update_notification(db, notification, generated)
    db.add(AuditLog(
        user_id=user.id,
        username=user.username,
        action="update",
        module="notifications",
        entity_type="notification",
        entity_id=notification_id,
        detail={"action": "generate"},
    ))
    await db.flush()
    return APIResponse(data=updated)


@router.post("/{notification_id}/send", response_model=APIResponse[dict])
async def send_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.NOTIFICATIONS_SEND)),
):
    """发送 WhatsApp 通告给目标班级家长"""
    result = await service.send_notification_to_parents(notification_id, db)
    if result.get("error") == "notification not found":
        raise_error(*NOT_FOUND, status_code=404)
    if result.get("error"):
        raise_error(40001, str(result["error"]))

    db.add(AuditLog(
        user_id=user.id,
        username=user.username,
        action="send",
        module="notifications",
        entity_type="notification",
        entity_id=notification_id,
        detail=result,
    ))
    await db.flush()
    return APIResponse(data=result)


@router.get("/{notification_id}/logs", response_model=APIResponse[list[NotificationLogResponse]])
async def list_notification_logs(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.NOTIFICATIONS_READ)),
):
    """发送日志列表"""
    notification = await repository.get_notification(db, notification_id)
    if not notification:
        raise_error(*NOT_FOUND, status_code=404)
    return APIResponse(data=await repository.list_logs_by_notification(db, notification_id))


@router.post("/{notification_id}/export-pdf", response_model=APIResponse[dict])
async def export_notification_pdf(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.NOTIFICATIONS_WRITE)),
):
    """导出通告为双语 PDF（中文页 + 英文页）"""
    notification = await repository.get_notification(db, notification_id)
    if not notification:
        raise_error(*NOT_FOUND, status_code=404)

    from app.core.config import get_settings

    settings = get_settings()
    output_dir = os.path.join(settings.UPLOAD_DIR, "notifications")
    filename = f"notice_{notification_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    filepath = service.export_notification_pdf(
        title_zh=notification.title_zh,
        title_en=notification.title_en or "",
        content_zh=notification.content_zh,
        content_en=notification.content_en or "",
        output_dir=output_dir,
        filename=filename,
    )

    await repository.update_notification(db, notification, {"pdf_path": filepath})

    db.add(AuditLog(
        user_id=user.id,
        username=user.username,
        action="export_pdf",
        module="notifications",
        entity_type="notification",
        entity_id=notification_id,
    ))
    await db.flush()

    return APIResponse(data={"pdf_path": filepath, "filename": filename})
