"""成績、AI 評語與 WhatsApp 流程的 API schemas。"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ScoreContext(BaseModel):
    school_year: str = Field(min_length=4, max_length=16)
    term: str = Field(min_length=1, max_length=24)
    exam_type: str = Field(min_length=1, max_length=80)

    @field_validator("school_year", "term", "exam_type")
    @classmethod
    def strip_context(cls, value: str) -> str:
        return value.strip()


class GenerateCommentsRequest(ScoreContext):
    student_ids: list[str] | None = Field(default=None, max_length=200)
    model: str = Field(default="deepseek-chat", min_length=1, max_length=100)

    @field_validator("model")
    @classmethod
    def validate_model(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("deepseek-"):
            raise ValueError("DeepSeek 模型名稱必須以 deepseek- 開頭")
        return value


class CommentUpdate(BaseModel):
    comment_text: str = Field(min_length=1, max_length=1000)
    highlight_subject: str | None = Field(default=None, max_length=80)
    improve_subject: str | None = Field(default=None, max_length=80)
    suggestion: str | None = Field(default=None, max_length=1000)

    @field_validator("comment_text")
    @classmethod
    def strip_comment(cls, value: str) -> str:
        return value.strip()


class ConfirmCommentsRequest(BaseModel):
    comment_ids: list[int] = Field(min_length=1, max_length=200)


class SendCommentsRequest(ScoreContext):
    comment_ids: list[int] | None = Field(default=None, max_length=200)
    resend: bool = False


class ScoreCommentResponse(BaseModel):
    id: int
    student_id: str
    school_year: str
    term: str
    exam_type: str
    comment_text: str
    highlight_subject: str | None = None
    improve_subject: str | None = None
    suggestion: str | None = None
    status: Literal["pending", "confirmed", "sent"]
    delivery_status: Literal["not_sent", "pending", "sent", "delivered", "read", "failed"]
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    sent_at: datetime | None = None
    whatsapp_message_id: str | None = None
    send_error: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
