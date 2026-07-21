"""add file storage and OCR job tables

Revision ID: 20260719_01
Revises: 20260717_01
Create Date: 2026-07-19
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260719_01"
down_revision: str | None = "20260717_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "files",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("module", sa.String(length=50), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=50)),
        sa.Column("entity_id", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_files_module", "files", ["module"])
    op.create_index("ix_files_uploaded_by", "files", ["uploaded_by"])

    op.create_table(
        "ocr_jobs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("module", sa.String(length=50), nullable=False),
        sa.Column("job_type", sa.String(length=30), nullable=False, server_default="document"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("result_text", sa.Text()),
        sa.Column("result_json", sa.JSON().with_variant(postgresql.JSONB(), "postgresql")),
        sa.Column("error_message", sa.String(length=500)),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ocr_jobs_file_id", "ocr_jobs", ["file_id"])
    op.create_index("ix_ocr_jobs_status", "ocr_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("ocr_jobs")
    op.drop_table("files")
