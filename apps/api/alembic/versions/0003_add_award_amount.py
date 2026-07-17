"""添加 apple_awards.amount 字段（奖学金金额）

Revision ID: 0003_add_award_amount
Revises: 0002_create_awards_scholarships
Create Date: 2026-07-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_add_award_amount"
down_revision: Union[str, None] = "0002_create_awards_scholarships"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "apple_awards",
        sa.Column("amount", sa.Numeric(10, 2), nullable=True, comment="奖学金金额（HKD）"),
    )


def downgrade() -> None:
    op.drop_column("apple_awards", "amount")
