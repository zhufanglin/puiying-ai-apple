from __future__ import annotations

from datetime import date
try:
    from enum import StrEnum
except ImportError:  # Python 3.10 compatibility
    from enum import Enum

    class StrEnum(str, Enum):
        """Backport the Python 3.11 string-enum behavior used by Pydantic."""

        def __str__(self) -> str:
            return self.value

from pydantic import BaseModel, EmailStr, Field, field_validator


class StudentStatus(StrEnum):
    active = "active"
    suspended = "suspended"
    withdrawn = "withdrawn"


class AttendanceStatus(StrEnum):
    present = "present"
    late = "late"
    absent = "absent"
    sick_leave = "sick_leave"


class CertificateType(StrEnum):
    enrollment = "enrollment"
    enrollment_bilingual = "enrollment_bilingual"
    transcript_reissue = "transcript_reissue"


class StudentCreate(BaseModel):
    studentNo: str = Field(min_length=2, max_length=32)
    nameZh: str = Field(min_length=1, max_length=100)
    nameEn: str | None = Field(default=None, max_length=160)
    className: str = Field(min_length=1, max_length=32)
    status: StudentStatus = StudentStatus.active
    admissionDate: date | None = None
    parentName: str | None = Field(default=None, max_length=100)
    parentPhone: str | None = Field(default=None, max_length=40)
    parentEmail: EmailStr | None = None
    photoUrl: str | None = Field(default=None, max_length=500)

    @field_validator("studentNo", "className")
    @classmethod
    def strip_and_upper(cls, value: str) -> str:
        return value.strip().upper()


class StudentUpdate(BaseModel):
    nameZh: str | None = Field(default=None, min_length=1, max_length=100)
    nameEn: str | None = Field(default=None, max_length=160)
    className: str | None = Field(default=None, min_length=1, max_length=32)
    status: StudentStatus | None = None
    admissionDate: date | None = None
    parentName: str | None = Field(default=None, max_length=100)
    parentPhone: str | None = Field(default=None, max_length=40)
    parentEmail: EmailStr | None = None
    photoUrl: str | None = Field(default=None, max_length=500)


class AttendanceRead(BaseModel):
    id: str
    studentId: str
    date: date
    status: AttendanceStatus
    remarks: str = ""
    sourceFileId: str | None = None


class CertificateCreate(BaseModel):
    certificateType: CertificateType = CertificateType.enrollment_bilingual
    language: str = Field(default="bilingual", pattern="^(zh|en|bilingual)$")
    purpose: str = Field(default="学校事务", max_length=300)


class CertificateRead(BaseModel):
    id: str
    studentId: str
    requestDate: date
    certificateType: CertificateType
    language: str
    purpose: str
    status: str
    generatedAt: str | None = None


class ImportErrorRow(BaseModel):
    row: int
    message: str


class ImportResult(BaseModel):
    sourceFileId: str
    imported: int
    updated: int = 0
    skipped: int = 0
    errors: list[ImportErrorRow] = []
