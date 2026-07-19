"""A3 资产盘点 — 数据库模型

表：
- apple_assets              资产主表
- apple_asset_movements     资产移动记录

严格按任务指南 §5.1 字段定义。
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Asset(Base, TimestampMixin):
    """资产主表"""

    __tablename__ = "apple_assets"

    asset_no: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, comment="资产编号"
    )
    name: Mapped[str] = mapped_column(String(200), comment="名称")
    category: Mapped[str] = mapped_column(
        String(50), comment="类别：办公设备/家具/电器/IT设备"
    )
    location: Mapped[str] = mapped_column(String(200), comment="存放地点")
    status: Mapped[str] = mapped_column(
        String(20), default="active",
        comment="active / written_off / moved / missing"
    )
    purchase_date: Mapped[Optional[str]] = mapped_column(
        String(10), comment="购买日期 YYYY-MM-DD"
    )
    purchase_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), comment="购买金额"
    )
    remark: Mapped[Optional[str]] = mapped_column(Text, comment="备注")

    # 注销相关
    written_off_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="注销日期"
    )
    written_off_reason: Mapped[Optional[str]] = mapped_column(
        Text, comment="注销原因"
    )

    # 文件关联
    file_id: Mapped[Optional[int]] = mapped_column(comment="关联发票 files.id")

    # 审计
    created_by: Mapped[int] = mapped_column(comment="登记人 user_id")

    # 关联
    movements: Mapped[list["AssetMovement"]] = relationship(
        back_populates="asset", viewonly=True
    )

    def __repr__(self) -> str:
        return f"<Asset {self.asset_no} {self.name}>"


class AssetMovement(Base, TimestampMixin):
    """资产移动记录"""

    __tablename__ = "apple_asset_movements"

    asset_id: Mapped[int] = mapped_column(
        ForeignKey("apple_assets.id"), comment="关联资产 ID"
    )
    from_location: Mapped[str] = mapped_column(String(200), comment="原地点")
    to_location: Mapped[str] = mapped_column(String(200), comment="目标地点")
    movement_date: Mapped[str] = mapped_column(String(10), comment="搬移日期 YYYY-MM-DD")
    reason: Mapped[Optional[str]] = mapped_column(Text, comment="搬移原因")
    created_by: Mapped[int] = mapped_column(comment="创建者 user_id")

    # 反向关联
    asset: Mapped["Asset"] = relationship(back_populates="movements")

    def __repr__(self) -> str:
        return f"<AssetMovement {self.id} {self.from_location} -> {self.to_location}>"
