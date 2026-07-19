"""AI 任务模型"""
from typing import Optional

from sqlalchemy import BigInteger, String, Text
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AIJob(Base, TimestampMixin):
    __tablename__ = "ai_jobs"

    module: Mapped[str] = mapped_column(String(50), comment="归属模块")
    task_type: Mapped[str] = mapped_column(
        String(50), comment="任务类型: award_comment / quote_analysis / student_profile"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="pending / processing / completed / failed"
    )
    input_data: Mapped[Optional[dict]] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), comment="输入参数（prompt + 上下文）")
    output_text: Mapped[Optional[str]] = mapped_column(Text, comment="AI 返回文本")
    output_json: Mapped[Optional[dict]] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), comment="AI 结构化结果")
    error_message: Mapped[Optional[str]] = mapped_column(String(500), comment="失败原因")
    created_by: Mapped[int] = mapped_column(comment="提交者 user_id")
