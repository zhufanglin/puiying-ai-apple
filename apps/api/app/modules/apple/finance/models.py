"""A2 财务收支 — 数据库模型

表：
- apple_finance_records  收支记录（收入 + 支出合一）
- apple_quotations       报价单

严格按任务指南 §4.1 字段定义。
"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Numeric, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class FinanceRecord(Base, TimestampMixin):
    """收支记录（收入 / 支出共用一张表，通过 type 区分）"""

    __tablename__ = "apple_finance_records"

    # ---- 分类 ----
    type: Mapped[str] = mapped_column(
        String(20), comment="income / expense"
    )

    # ---- 公共字段 ----
    date: Mapped[str] = mapped_column(String(10), comment="日期 YYYY-MM-DD")
    project: Mapped[str] = mapped_column(String(200), comment="项目名称")
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), comment="金额")

    # ---- 收入专用 ----
    payment_method: Mapped[Optional[str]] = mapped_column(
        String(50), comment="支付方式"
    )
    handler: Mapped[str] = mapped_column(
        String(50), comment="经手人"
    )

    # ---- 支出专用 ----
    invoice_no: Mapped[Optional[str]] = mapped_column(
        String(100), comment="发票号"
    )
    supplier: Mapped[Optional[str]] = mapped_column(
        String(200), comment="供应商"
    )
    approver: Mapped[Optional[str]] = mapped_column(
        String(50), comment="审批人"
    )

    # ---- 状态 ----
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="pending / confirmed / approved / rejected"
    )

    # ---- 文件关联 ----
    file_id: Mapped[Optional[int]] = mapped_column(comment="关联 files.id")

    # ---- 审计 ----
    created_by: Mapped[int] = mapped_column(comment="创建者 user_id")

    def __repr__(self) -> str:
        return f"<FinanceRecord {self.id} [{self.type}] {self.project}>"


class Quotation(Base, TimestampMixin):
    """报价单"""

    __tablename__ = "apple_quotations"

    project_name: Mapped[str] = mapped_column(String(200), comment="项目名")
    vendor: Mapped[str] = mapped_column(String(200), comment="报价单位")
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), comment="报价金额")
    is_lowest: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否最低报价")
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否采纳")
    remark: Mapped[Optional[str]] = mapped_column(Text, comment="备注")
    created_by: Mapped[int] = mapped_column(comment="创建者 user_id")

    def __repr__(self) -> str:
        return f"<Quotation {self.id} {self.project_name} {self.vendor}>"
