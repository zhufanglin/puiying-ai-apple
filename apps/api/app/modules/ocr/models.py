"""OCR 任务模型"""
from typing import Optional

from sqlalchemy import BigInteger, Integer, String, Text
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class OCRJob(Base, TimestampMixin):
    __tablename__ = "ocr_jobs"

    file_id: Mapped[int] = mapped_column(comment="关联 files.id")
    module: Mapped[str] = mapped_column(String(50), comment="归属模块")
    job_type: Mapped[str] = mapped_column(
        String(30), default="document",
        comment="receipt / invoice / certificate / document",
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="pending / processing / completed / failed"
    )
    result_text: Mapped[Optional[str]] = mapped_column(Text, comment="OCR 原始文本")
    result_json: Mapped[Optional[dict]] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), comment="OCR 结构化结果")
    error_message: Mapped[Optional[str]] = mapped_column(String(500), comment="失败原因")
    created_by: Mapped[int] = mapped_column(comment="提交者 user_id")
