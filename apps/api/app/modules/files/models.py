"""文件管理模型"""
from typing import Optional

from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class File(Base, TimestampMixin):
    __tablename__ = "files"

    filename: Mapped[str] = mapped_column(String(255), comment="原始文件名")
    stored_path: Mapped[str] = mapped_column(String(500), comment="存储路径")
    mime_type: Mapped[str] = mapped_column(String(100), comment="MIME 类型")
    size_bytes: Mapped[int] = mapped_column(BigInteger, comment="文件大小(字节)")
    module: Mapped[str] = mapped_column(String(50), comment="归属模块: awards / finance / assets / students")
    uploaded_by: Mapped[int] = mapped_column(comment="上传者 user_id")
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), comment="关联实体类型: certificate / receipt / photo")
    entity_id: Mapped[Optional[int]] = mapped_column(comment="关联实体ID")
