"""add Apple scores and AI score comments

Revision ID: 20260724_01
Revises: 20260719_01
Create Date: 2026-07-24
"""
from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260724_01"
down_revision: str | None = "20260719_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "apple_scores",
        sa.Column("student_id", sa.String(length=64), nullable=False),
        sa.Column("school_year", sa.String(length=16), nullable=False),
        sa.Column("term", sa.String(length=24), nullable=False),
        sa.Column("exam_type", sa.String(length=80), nullable=False),
        sa.Column("subject", sa.String(length=80), nullable=False),
        sa.Column("score", sa.Numeric(precision=7, scale=2), nullable=False),
        sa.Column("full_mark", sa.Numeric(precision=7, scale=2), nullable=False, server_default="100"),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="excel"),
        sa.Column("source_filename", sa.String(length=255)),
        sa.Column("created_by", sa.Integer()),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("full_mark > 0", name="ck_apple_scores_full_mark_positive"),
        sa.CheckConstraint("score >= 0", name="ck_apple_scores_non_negative"),
        sa.CheckConstraint("score <= full_mark", name="ck_apple_scores_not_over_full_mark"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["apple_students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "student_id", "school_year", "term", "exam_type", "subject",
            name="uq_apple_scores_student_exam_subject",
        ),
    )
    op.create_index("ix_apple_scores_student_id", "apple_scores", ["student_id"])
    op.create_index("ix_apple_scores_exam", "apple_scores", ["school_year", "term", "exam_type"])

    op.create_table(
        "apple_score_comments",
        sa.Column("student_id", sa.String(length=64), nullable=False),
        sa.Column("school_year", sa.String(length=16), nullable=False),
        sa.Column("term", sa.String(length=24), nullable=False),
        sa.Column("exam_type", sa.String(length=80), nullable=False),
        sa.Column("comment_text", sa.Text(), nullable=False),
        sa.Column("highlight_subject", sa.String(length=80)),
        sa.Column("improve_subject", sa.String(length=80)),
        sa.Column("suggestion", sa.Text()),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("delivery_status", sa.String(length=20), nullable=False, server_default="not_sent"),
        sa.Column("reviewed_by", sa.Integer()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("whatsapp_message_id", sa.String(length=160)),
        sa.Column("send_error", sa.String(length=500)),
        sa.Column("created_by", sa.Integer()),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'confirmed', 'sent')", name="ck_apple_score_comments_status"),
        sa.CheckConstraint(
            "delivery_status IN ('not_sent', 'pending', 'sent', 'delivered', 'read', 'failed')",
            name="ck_apple_score_comments_delivery_status",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["apple_students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "student_id", "school_year", "term", "exam_type",
            name="uq_apple_score_comments_student_exam",
        ),
    )
    op.create_index("ix_apple_score_comments_student_id", "apple_score_comments", ["student_id"])
    op.create_index("ix_apple_score_comments_exam", "apple_score_comments", ["school_year", "term", "exam_type"])
    op.create_index("ix_apple_score_comments_status", "apple_score_comments", ["status", "delivery_status"])
    op.create_index("ix_apple_score_comments_whatsapp_message_id", "apple_score_comments", ["whatsapp_message_id"])


def downgrade() -> None:
    op.drop_table("apple_score_comments")
    op.drop_table("apple_scores")
