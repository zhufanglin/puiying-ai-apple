"""成績管理與 AI 評語的 SQLAlchemy 表契約。"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Score(Base, TimestampMixin):
    """一名學生在一次考試中的單科成績。"""

    __tablename__ = "apple_scores"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "school_year",
            "term",
            "exam_type",
            "subject",
            name="uq_apple_scores_student_exam_subject",
        ),
        CheckConstraint("score >= 0", name="ck_apple_scores_non_negative"),
        CheckConstraint("full_mark > 0", name="ck_apple_scores_full_mark_positive"),
        CheckConstraint("score <= full_mark", name="ck_apple_scores_not_over_full_mark"),
        Index("ix_apple_scores_exam", "school_year", "term", "exam_type"),
    )

    student_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("apple_students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    school_year: Mapped[str] = mapped_column(String(16), nullable=False)
    term: Mapped[str] = mapped_column(String(24), nullable=False)
    exam_type: Mapped[str] = mapped_column(String(80), nullable=False)
    subject: Mapped[str] = mapped_column(String(80), nullable=False)
    score: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False)
    full_mark: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False, default=100)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="excel")
    source_filename: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class ScoreComment(Base, TimestampMixin):
    """AI 評語、教師審閱狀態及逐名學生的 WhatsApp 發送狀態。"""

    __tablename__ = "apple_score_comments"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "school_year",
            "term",
            "exam_type",
            name="uq_apple_score_comments_student_exam",
        ),
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'sent')",
            name="ck_apple_score_comments_status",
        ),
        CheckConstraint(
            "delivery_status IN ('not_sent', 'pending', 'sent', 'delivered', 'read', 'failed')",
            name="ck_apple_score_comments_delivery_status",
        ),
        Index("ix_apple_score_comments_exam", "school_year", "term", "exam_type"),
        Index("ix_apple_score_comments_status", "status", "delivery_status"),
    )

    student_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("apple_students.id", ondelete="CASCADE"), index=True, nullable=False
    )
    school_year: Mapped[str] = mapped_column(String(16), nullable=False)
    term: Mapped[str] = mapped_column(String(24), nullable=False)
    exam_type: Mapped[str] = mapped_column(String(80), nullable=False)
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
    highlight_subject: Mapped[str | None] = mapped_column(String(80))
    improve_subject: Mapped[str | None] = mapped_column(String(80))
    suggestion: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    delivery_status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_sent")
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    whatsapp_message_id: Mapped[str | None] = mapped_column(String(160), index=True)
    send_error: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
