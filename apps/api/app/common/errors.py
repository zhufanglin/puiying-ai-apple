"""统一错误码

所有错误码 5 位数：
- 10xxx  认证/权限
- 20xxx  资源不存在
- 30xxx  参数校验
- 40xxx  业务逻辑
- 50xxx  服务端内部
"""

from typing import Optional

from fastapi import HTTPException


class AppError(HTTPException):
    """业务异常：统一携带 code + message"""

    def __init__(self, code: int, message: str, status_code: int = 400, detail: Optional[dict] = None):
        super().__init__(status_code=status_code, detail={
            "code": code,
            "message": message,
            "data": detail,
        })


# ==================== 10xxx 认证 ====================
AUTH_INVALID_TOKEN   = (10001, "无效的访问令牌")
AUTH_EXPIRED_TOKEN   = (10002, "令牌已过期")
AUTH_PERMISSION_DENY = (10003, "权限不足")
AUTH_LOGIN_FAILED    = (10004, "用户名或密码错误")

# ==================== 20xxx 资源 ====================
NOT_FOUND  = (20001, "资源不存在")
CONFLICT   = (20002, "资源冲突（重复创建）")

# ==================== 30xxx 参数 ====================
VALIDATION_ERROR = (30001, "参数校验失败")

# ==================== 40xxx 业务 ====================
BUSINESS_ERROR  = (40001, "业务逻辑错误")
OCR_FAILED      = (40002, "OCR 识别失败")
AI_FAILED       = (40003, "AI 处理失败")
UPLOAD_TOO_LARGE = (40004, "文件过大")

# ==================== 50xxx 服务端 ====================
INTERNAL_ERROR = (50001, "服务器内部错误")


def raise_error(code: int, message: str, status_code: int = 400, detail: Optional[dict] = None):
    raise AppError(code, message, status_code, detail)
