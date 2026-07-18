"""OCR 任务 API Schema。"""

from datetime import datetime
from datetime import date as date_type
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class OCRBoundingBox(BaseModel):
    """OCR 行坐标；用于让模型理解标签和值之间的相对位置。"""

    x0: float = 0
    y0: float = 0
    x1: float = 0
    y1: float = 0

    model_config = ConfigDict(extra="forbid")


class OCRLineInput(BaseModel):
    line_no: int = Field(ge=1)
    text: str = Field(min_length=1, max_length=500)
    confidence: float = Field(default=0, ge=0, le=100)
    bbox: Optional[OCRBoundingBox] = None

    model_config = ConfigDict(extra="forbid")


class ReceiptAIStructureRequest(BaseModel):
    """把 OCR 原文交给用户选择的模型做语义结构化。"""

    provider: Literal["deepseek"] = "deepseek"
    model: str = Field(default="deepseek-v4-flash", min_length=1, max_length=100)
    source_file_id: Optional[int] = Field(default=None, ge=1)
    ocr_engine: str = Field(default="baidu_ocr", min_length=1, max_length=50)
    ocr_text: str = Field(min_length=1, max_length=30_000)
    ocr_confidence: float = Field(ge=0, le=100)
    page: int = Field(default=1, ge=1, le=10_000)
    lines: list[OCRLineInput] = Field(default_factory=list, max_length=500)

    model_config = ConfigDict(extra="forbid")

    @field_validator("model")
    @classmethod
    def validate_deepseek_model(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("deepseek-"):
            raise ValueError("DeepSeek 模型名称必须以 deepseek- 开头")
        if not all(char.isalnum() or char in "-._" for char in value):
            raise ValueError("模型名称包含不支持的字符")
        return value


class ReceiptAIFields(BaseModel):
    amount: Optional[float] = Field(default=None, ge=0)
    currency: Optional[Literal["HKD"]] = None
    date: Optional[str] = None
    payer: Optional[str] = Field(default=None, max_length=200)
    purpose: Optional[str] = Field(default=None, max_length=500)

    model_config = ConfigDict(extra="forbid")

    @field_validator("date")
    @classmethod
    def validate_iso_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        try:
            return date_type.fromisoformat(value).isoformat()
        except ValueError as exc:
            raise ValueError("日期必须为 YYYY-MM-DD 或 null") from exc

    @field_validator("payer", "purpose")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class ReceiptPromptResult(BaseModel):
    """Prompt 的唯一合法输出结构。"""

    fields: ReceiptAIFields
    confidence: Literal["low", "medium", "high"]
    warnings: list[str] = Field(default_factory=list, max_length=20)
    raw_text: str = Field(max_length=30_000)

    model_config = ConfigDict(extra="forbid")

    @field_validator("warnings")
    @classmethod
    def normalize_warnings(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            warning = str(value).strip()[:300]
            if warning and warning not in normalized:
                normalized.append(warning)
        return normalized


class ReceiptAIStructureResponse(ReceiptPromptResult):
    provider: Literal["deepseek"] = "deepseek"
    model: str
