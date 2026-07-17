"""add Apple A4 student, attendance and certificate tables

Revision ID: 20260717_01
Revises:
Create Date: 2026-07-17
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260717_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "apple_students",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("student_no", sa.String(length=32), nullable=False),
        sa.Column("name_zh", sa.String(length=100), nullable=False),
        sa.Column("name_en", sa.String(length=160)),
        sa.Column("class_name", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="active"),
        sa.Column("admission_date", sa.Date()),
        sa.Column("parent_name", sa.String(length=100)),
        sa.Column("parent_phone", sa.String(length=40)),
        sa.Column("parent_email", sa.String(length=200)),
        sa.Column("photo_url", sa.String(length=500)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=False),
        sa.Column("last_reviewed_by", sa.String(length=64)),
        sa.Column("last_reviewed_at", sa.DateTime()),
        sa.Column("source_file_id", sa.String(length=64)),
        sa.UniqueConstraint("student_no", name="uq_apple_students_student_no"),
    )
    op.create_index("ix_apple_students_class_name", "apple_students", ["class_name"])
    op.create_index("ix_apple_students_status", "apple_students", ["status"])

    op.create_table(
        "apple_attendance",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("student_id", sa.String(length=64), sa.ForeignKey("apple_students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("remarks", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=False),
        sa.Column("last_reviewed_by", sa.String(length=64)),
        sa.Column("last_reviewed_at", sa.DateTime()),
        sa.Column("source_file_id", sa.String(length=64)),
        sa.UniqueConstraint("student_id", "attendance_date", name="uq_attendance_student_date"),
    )
    op.create_index("ix_apple_attendance_student_id", "apple_attendance", ["student_id"])
    op.create_index("ix_apple_attendance_date", "apple_attendance", ["attendance_date"])
    op.create_index("ix_apple_attendance_status", "apple_attendance", ["status"])

    op.create_table(
        "apple_certificate_requests",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("student_id", sa.String(length=64), sa.ForeignKey("apple_students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_date", sa.Date(), nullable=False),
        sa.Column("certificate_type", sa.String(length=40), nullable=False),
        sa.Column("language", sa.String(length=20), nullable=False, server_default="bilingual"),
        sa.Column("purpose", sa.String(length=300)),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("docx_path", sa.String(length=600)),
        sa.Column("pdf_path", sa.String(length=600)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=False),
        sa.Column("last_reviewed_by", sa.String(length=64)),
        sa.Column("last_reviewed_at", sa.DateTime()),
        sa.Column("source_file_id", sa.String(length=64)),
    )
    op.create_index("ix_apple_cert_student_id", "apple_certificate_requests", ["student_id"])
    op.create_index("ix_apple_cert_request_date", "apple_certificate_requests", ["request_date"])
    op.create_index("ix_apple_cert_status", "apple_certificate_requests", ["status"])


def downgrade() -> None:
    op.drop_table("apple_certificate_requests")
    op.drop_table("apple_attendance")
    op.drop_table("apple_students")
