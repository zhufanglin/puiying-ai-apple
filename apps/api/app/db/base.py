"""ORM 模型基类（所有模型继承自此）"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """给所有表自动加 id / created_at / updated_at

    使用 CURRENT_TIMESTAMP 兼容 SQLite 和 PostgreSQL。
    """
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
    )
