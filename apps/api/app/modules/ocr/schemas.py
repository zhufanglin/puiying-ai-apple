"""OCR 任务 API Schema。"""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class OCRJobCreate(BaseModel):
    file_id: int
    module: Literal["awards", "finance", "assets", "students"]
    job_type: Literal["receipt", "invoice", "certificate", "document"] = "document"


class OCRJobResponse(BaseModel):
    id: int
    file_id: int
    module: str
    job_type: str
    status: str
    result_text: Optional[str] = None
    result_json: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def serialize_datetime(cls, value):
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value) if value is not None else None
