"""通用 Pydantic Schema（所有 API 返回格式统一）"""
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


# ============== 统一响应 ==============

class APIResponse(BaseModel, Generic[T]):
    """所有接口统一返回此格式

    {
        "code": 0,
        "message": "ok",
        "data": { ... }
    }
    """
    code: int = Field(default=0, description="0=成功, 非0=错误码")
    message: str = Field(default="ok")
    data: Optional[T] = None


class PaginatedData(BaseModel, Generic[T]):
    """分页数据"""
    items: list[T] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0


# ============== 登录 ==============

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    display_name: str


# ============== 审计日志 ==============

class AuditAction(str):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    APPROVE = "approve"
    REJECT = "reject"
    EXPORT = "export"
