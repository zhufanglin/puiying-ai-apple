"""Pydantic schemas for Apple notice templates and WhatsApp notifications."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NoticeTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., pattern="^(考试|活動|活动|放假|其他)$")
    zh_content_template: str = Field(..., min_length=1)
    en_content_template: str | None = None


class NoticeTemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    category: str | None = Field(None, pattern="^(考试|活動|活动|放假|其他)$")
    zh_content_template: str | None = Field(None, min_length=1)
    en_content_template: str | None = None
    is_active: bool | None = None


class NoticeTemplateResponse(BaseModel):
    id: int
    name: str
    category: str
    zh_content_template: str
    en_content_template: str | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationCreate(BaseModel):
    template_id: int
    title_zh: str = Field(..., min_length=1, max_length=200)
    title_en: str | None = None
    target_classes: list[str] = Field(..., min_length=1)
    placeholders: dict[str, Any] = Field(
        default_factory=dict,
        description='模板占位符，如 {"date": "2026-07-24"}',
    )


class NotificationGenerateRequest(BaseModel):
    placeholders: dict[str, Any] = Field(default_factory=dict)


class NotificationResponse(BaseModel):
    id: int
    template_id: int | None = None
    title_zh: str
    title_en: str | None = None
    content_zh: str
    content_en: str | None = None
    target_classes: str | None = None
    status: str
    pdf_path: str | None = None
    sent_at: datetime | None = None
    created_by: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationLogResponse(BaseModel):
    id: int
    notification_id: int
    parent_phone: str
    student_name: str
    message_status: str
    error_msg: str | None = None
    status_updated_at: datetime | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationStatsResponse(BaseModel):
    total: int = 0
    sent: int = 0
    delivered: int = 0
    read: int = 0
    failed: int = 0
