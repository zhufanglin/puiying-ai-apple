"""奖状 & 奖学金 数据库模型

表说明：
  - apple_award_templates   奖状模板（如"三好学生"、"优秀班干部"）
  - apple_awards            奖状/奖项主表（一次颁奖活动）
  - apple_award_recipients  获奖学生关联表
  - apple_scholarship_applications  奖学金申请
  - apple_scholarship_reviews       奖学金审核记录（审计追踪）

关联关系：
  Award → AwardTemplate (M:1)
  Award → AwardRecipient (1:M)
  ScholarshipApplication → User as reviewer (M:1)
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Date, DateTime, Numeric, ForeignKey, Integer, String, Text,
    Boolean, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


# ==================== 奖状模板 ====================

class AwardTemplate(Base, TimestampMixin):
    """奖状模板 — 定义奖状的类型、样式、默认内容"""
    __tablename__ = "apple_award_templates"

    name: Mapped[str] = mapped_column(String(100), comment="模板名称, 如: 三好学生")
    description: Mapped[Optional[str]] = mapped_column(String(500), comment="模板描述")
    category: Mapped[str] = mapped_column(
        String(50), default="其他",
        comment="分类: 学业 / 品德 / 活动 / 其他"
    )
    default_content: Mapped[Optional[str]] = mapped_column(Text, comment="默认奖状内容模板")
    badge_style: Mapped[Optional[str]] = mapped_column(String(200), comment="徽章样式/图标URL")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否启用")

    # 反向关系
    awards: Mapped[list["Award"]] = relationship(back_populates="template")

    def __repr__(self) -> str:
        return f"<AwardTemplate #{self.id} {self.name}>"


# ==================== 奖状 ====================

class Award(Base, TimestampMixin):
    """奖状/奖项 — 一次颁奖活动（可包含多名获奖学生）"""
    __tablename__ = "apple_awards"

    template_id: Mapped[int] = mapped_column(
        ForeignKey("apple_award_templates.id"), comment="关联模板ID"
    )
    title: Mapped[str] = mapped_column(String(200), comment="奖状标题")
    issue_date: Mapped[date] = mapped_column(
        Date, server_default=func.current_date(), comment="颁发日期"
    )
    issuer: Mapped[Optional[str]] = mapped_column(String(100), comment="颁发部门/发布者")
    status: Mapped[str] = mapped_column(
        String(20), default="draft",
        comment="狀態: draft=草稿 / calculated=已核算 / confirmed=已確認 / cancelled=已取消"
    )
    remark: Mapped[Optional[str]] = mapped_column(Text, comment="备注")
    total_recipients: Mapped[int] = mapped_column(
        Integer, default=0, comment="获奖人数"
    )
    amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, comment="奖学金金额（HKD）"
    )

    # 正向关系
    template: Mapped["AwardTemplate"] = relationship(back_populates="awards")
    recipients: Mapped[list["AwardRecipient"]] = relationship(
        back_populates="award", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Award #{self.id} {self.title}>"


# ==================== 获奖学生 ====================

class AwardRecipient(Base, TimestampMixin):
    """获奖学生 — 每条记录表示一个证书"""
    __tablename__ = "apple_award_recipients"

    award_id: Mapped[int] = mapped_column(
        ForeignKey("apple_awards.id"), index=True, comment="关联奖状ID"
    )
    student_name: Mapped[str] = mapped_column(String(50), comment="学生姓名")
    student_class: Mapped[str] = mapped_column(String(50), comment="班级")
    student_grade: Mapped[Optional[str]] = mapped_column(String(20), comment="年级")
    certificate_no: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, comment="证书编号（唯一）"
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, comment="获奖原因")
    rank: Mapped[Optional[str]] = mapped_column(
        String(20), comment="获奖等级: 一等奖 / 二等奖 / 三等奖 / 优秀奖"
    )
    scholarship_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True, default=None, comment="核算后的奖学金金额（HKD）"
    )

    # 正向关系
    award: Mapped["Award"] = relationship(back_populates="recipients")

    def __repr__(self) -> str:
        return f"<AwardRecipient #{self.id} {self.student_name}>"


# ==================== 奖学金申请 ====================

class ScholarshipApplication(Base, TimestampMixin):
    """奖学金申请表"""
    __tablename__ = "apple_scholarship_applications"

    student_name: Mapped[str] = mapped_column(String(50), comment="学生姓名")
    student_class: Mapped[str] = mapped_column(String(50), comment="班级")
    student_grade: Mapped[Optional[str]] = mapped_column(String(20), comment="年级")
    scholarship_type: Mapped[str] = mapped_column(
        String(50), comment="奖学金类型: 学业优秀 / 品德风尚 / 科技竞赛 / 体艺特长 / 助学金"
    )
    academic_year: Mapped[str] = mapped_column(String(20), comment="学年, 如: 2025-2026")
    semester: Mapped[str] = mapped_column(
        String(10), comment="学期: 上 / 下"
    )
    application_date: Mapped[date] = mapped_column(
        Date, server_default=func.current_date(), comment="申请日期"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="状态: pending=待审核 / approved=通过 / rejected=驳回"
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), comment="申请金额（HKD）"
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, comment="申请理由")
    remark: Mapped[Optional[str]] = mapped_column(Text, comment="备注")

    # 审核信息（由审核人填写）
    reviewer_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), comment="审核人ID"
    )
    review_comment: Mapped[Optional[str]] = mapped_column(Text, comment="审核意见")
    review_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="审核日期"
    )

    # 关系
    reviewer: Mapped[Optional["User"]] = relationship(
        foreign_keys=[reviewer_id],  # noqa: F821
        lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<ScholarshipApplication #{self.id} {self.student_name} {self.scholarship_type}>"


# ==================== 奖学金审核记录 ====================

class ScholarshipReview(Base, TimestampMixin):
    """奖学金审核记录（审计追踪）"""
    __tablename__ = "apple_scholarship_reviews"

    application_id: Mapped[int] = mapped_column(
        ForeignKey("apple_scholarship_applications.id"), index=True, comment="关联申请ID"
    )
    reviewer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), comment="审核人ID"
    )
    review_status: Mapped[str] = mapped_column(
        String(20), comment="审核状态: approved / rejected"
    )
    review_comment: Mapped[Optional[str]] = mapped_column(Text, comment="审核意见")
    review_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="审核日期"
    )

    def __repr__(self) -> str:
        return f"<ScholarshipReview #{self.id} app#{self.application_id} -> {self.review_status}>"
