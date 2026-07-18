"""文件上传 API Schema。"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class FileResponse(BaseModel):
    id: int
    filename: str
    mime_type: str
    size_bytes: int
    module: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", mode="before")
    @classmethod
    def serialize_datetime(cls, value):
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value) if value is not None else None
