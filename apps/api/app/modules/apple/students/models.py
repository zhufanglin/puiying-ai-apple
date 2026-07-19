"""学生事务正式 PostgreSQL 表契约。

当前演示环境由 repository.py 的文件适配器运行；这些 ORM 模型保持与正式数据库
表一致，接入 PostgreSQL 时无需改变 router、schema 或 service。
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Student(Base):
    __tablename__ = "apple_students"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name_zh: Mapped[str] = mapped_column(String(100), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(160))
    class_name: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(24), index=True, default="active", nullable=False)
    admission_date: Mapped[date | None] = mapped_column(Date)
    parent_name: Mapped[str | None] = mapped_column(String(100))
    parent_phone: Mapped[str | None] = mapped_column(String(40))
    parent_email: Mapped[str | None] = mapped_column(String(200))
    photo_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_by: Mapped[str] = mapped_column(String(64), nullable=False)
    last_reviewed_by: Mapped[str | None] = mapped_column(String(64))
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    source_file_id: Mapped[str | None] = mapped_column(String(64))


class Attendance(Base):
    __tablename__ = "apple_attendance"
    __table_args__ = (UniqueConstraint("student_id", "attendance_date", name="uq_attendance_student_date"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("apple_students.id"), index=True, nullable=False)
    attendance_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(24), index=True, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_by: Mapped[str] = mapped_column(String(64), nullable=False)
    last_reviewed_by: Mapped[str | None] = mapped_column(String(64))
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    source_file_id: Mapped[str | None] = mapped_column(String(64))


class CertificateRequest(Base):
    __tablename__ = "apple_certificate_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("apple_students.id"), index=True, nullable=False)
    request_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    certificate_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    language: Mapped[str] = mapped_column(String(20), default="bilingual", nullable=False)
    purpose: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(24), index=True, default="pending", nullable=False)
    docx_path: Mapped[str | None] = mapped_column(String(600))
    pdf_path: Mapped[str | None] = mapped_column(String(600))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_by: Mapped[str] = mapped_column(String(64), nullable=False)
    last_reviewed_by: Mapped[str | None] = mapped_column(String(64))
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    source_file_id: Mapped[str | None] = mapped_column(String(64))
