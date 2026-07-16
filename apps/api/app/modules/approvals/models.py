"""审批流模型"""
from typing import Optional

from sqlalchemy import BigInteger, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Approval(Base, TimestampMixin):
    __tablename__ = "approvals"

    module: Mapped[str] = mapped_column(String(50), comment="归属模块")
    entity_type: Mapped[str] = mapped_column(String(50), comment="审批对象类型: award / certificate")
    entity_id: Mapped[int] = mapped_column(comment="审批对象ID")
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="pending / approved / rejected"
    )
    submitted_by: Mapped[int] = mapped_column(comment="提交人 user_id")
    reviewed_by: Mapped[Optional[int]] = mapped_column(comment="审批人 user_id")
    review_comment: Mapped[Optional[str]] = mapped_column(Text, comment="审批意见")
