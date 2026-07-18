"""审计日志模型"""
from typing import Optional

from sqlalchemy import BigInteger, String, Text
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    user_id: Mapped[int] = mapped_column(comment="操作人 user_id")
    username: Mapped[str] = mapped_column(String(50), comment="操作人用户名（冗余，便于查询）")
    action: Mapped[str] = mapped_column(String(20), comment="动作: create / update / delete / approve / reject / export")
    module: Mapped[str] = mapped_column(String(50), comment="归属模块")
    entity_type: Mapped[str] = mapped_column(String(50), comment="实体类型: award / receipt / asset / student")
    entity_id: Mapped[Optional[int]] = mapped_column(comment="实体ID")
    detail: Mapped[Optional[dict]] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), comment="变更详情（前后对比）")
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), comment="操作IP")
