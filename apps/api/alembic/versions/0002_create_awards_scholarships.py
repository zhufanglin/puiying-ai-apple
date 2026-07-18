"""创建奖状 & 奖学金表

Revision ID: 0002
Revises: 0001 (假设底座迁移为 0001)
Create Date: 2026-07-17

本迁移由同学 2（奖状奖学金模块）负责维护。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_create_awards_scholarships"
down_revision: Union[str, None] = None  # 如果已有底座迁移，设为其 revision id
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==================== 奖状模板 ====================
    op.create_table(
        "apple_award_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False, comment="模板名称"),
        sa.Column("description", sa.String(length=500), nullable=True, comment="描述"),
        sa.Column("category", sa.String(length=50), nullable=False,
                  server_default="其他", comment="分类: 学业/品德/活动/其他"),
        sa.Column("default_content", sa.Text(), nullable=True, comment="默认内容"),
        sa.Column("badge_style", sa.String(length=200), nullable=True, comment="徽章样式"),
        sa.Column("is_active", sa.Boolean(), nullable=False,
                  server_default=sa.text("true"), comment="是否启用"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_award_templates_category", "apple_award_templates", ["category"]
    )

    # ==================== 奖状 ====================
    op.create_table(
        "apple_awards",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("template_id", sa.Integer(), nullable=False, comment="关联模板ID"),
        sa.Column("title", sa.String(length=200), nullable=False, comment="奖状标题"),
        sa.Column("issue_date", sa.Date(), nullable=False,
                  server_default=sa.text("current_date"), comment="颁发日期"),
        sa.Column("issuer", sa.String(length=100), nullable=True, comment="颁发部门"),
        sa.Column("status", sa.String(length=20), nullable=False,
                  server_default="draft", comment="状态: draft/published/cancelled"),
        sa.Column("remark", sa.Text(), nullable=True, comment="备注"),
        sa.Column("total_recipients", sa.Integer(), nullable=False,
                  server_default=sa.text("0"), comment="获奖人数"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["template_id"], ["apple_award_templates.id"],
            ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_awards_status", "apple_awards", ["status"])
    op.create_index("ix_awards_issue_date", "apple_awards", ["issue_date"])

    # ==================== 获奖学生 ====================
    op.create_table(
        "apple_award_recipients",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("award_id", sa.Integer(), nullable=False, comment="关联奖状ID"),
        sa.Column("student_name", sa.String(length=50), nullable=False, comment="学生姓名"),
        sa.Column("student_class", sa.String(length=50), nullable=False, comment="班级"),
        sa.Column("student_grade", sa.String(length=20), nullable=True, comment="年级"),
        sa.Column("certificate_no", sa.String(length=50), nullable=True, comment="证书编号"),
        sa.Column("reason", sa.Text(), nullable=True, comment="获奖原因"),
        sa.Column("rank", sa.String(length=20), nullable=True, comment="获奖等级"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["award_id"], ["apple_awards.id"],
            ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("certificate_no"),
    )
    op.create_index(
        "ix_award_recipients_award_id", "apple_award_recipients", ["award_id"]
    )
    op.create_index(
        "ix_award_recipients_student_name", "apple_award_recipients", ["student_name"]
    )

    # ==================== 奖学金申请 ====================
    op.create_table(
        "apple_scholarship_applications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_name", sa.String(length=50), nullable=False, comment="学生姓名"),
        sa.Column("student_class", sa.String(length=50), nullable=False, comment="班级"),
        sa.Column("student_grade", sa.String(length=20), nullable=True, comment="年级"),
        sa.Column("scholarship_type", sa.String(length=50), nullable=False,
                  comment="类型: 学业优秀/品德风尚/科技竞赛/体艺特长/助学金"),
        sa.Column("academic_year", sa.String(length=20), nullable=False, comment="学年"),
        sa.Column("semester", sa.String(length=10), nullable=False, comment="学期: 上/下"),
        sa.Column("application_date", sa.Date(), nullable=False,
                  server_default=sa.text("current_date"), comment="申请日期"),
        sa.Column("status", sa.String(length=20), nullable=False,
                  server_default="pending", comment="状态: pending/approved/rejected"),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False,
                  server_default=sa.text("0.00"), comment="申请金额(HKD)"),
        sa.Column("reason", sa.Text(), nullable=True, comment="申请理由"),
        sa.Column("remark", sa.Text(), nullable=True, comment="备注"),
        sa.Column("reviewer_id", sa.Integer(), nullable=True, comment="审核人ID"),
        sa.Column("review_comment", sa.Text(), nullable=True, comment="审核意见"),
        sa.Column("review_date", sa.DateTime(timezone=True), nullable=True, comment="审核日期"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["reviewer_id"], ["users.id"],
            ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_scholarship_status", "apple_scholarship_applications", ["status"]
    )
    op.create_index(
        "ix_scholarship_type", "apple_scholarship_applications", ["scholarship_type"]
    )

    # ==================== 奖学金审核记录 ====================
    op.create_table(
        "apple_scholarship_reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False, comment="关联申请ID"),
        sa.Column("reviewer_id", sa.Integer(), nullable=False, comment="审核人ID"),
        sa.Column("review_status", sa.String(length=20), nullable=False, comment="审核状态"),
        sa.Column("review_comment", sa.Text(), nullable=True, comment="审核意见"),
        sa.Column("review_date", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False, comment="审核日期"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["application_id"], ["apple_scholarship_applications.id"],
            ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"], ["users.id"],
            ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_scholarship_reviews_application_id",
        "apple_scholarship_reviews", ["application_id"]
    )


def downgrade() -> None:
    op.drop_table("apple_scholarship_reviews")
    op.drop_table("apple_scholarship_applications")
    op.drop_table("apple_award_recipients")
    op.drop_table("apple_awards")
    op.drop_table("apple_award_templates")
