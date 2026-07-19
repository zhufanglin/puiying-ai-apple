"""认证路由（登录）"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.errors import AUTH_LOGIN_FAILED, raise_error
from app.common.schemas import APIResponse, LoginRequest, TokenResponse
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.modules.accounts.models import User

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """用户登录，返回 JWT token"""
    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.username == body.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise_error(*AUTH_LOGIN_FAILED)

    if not user.is_active:
        raise_error(10005, "账号已禁用", 403)

    token = create_access_token(user.id, user.role.name if user.role else "guest")

    return APIResponse(data=TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.name if user.role else "guest",
        display_name=user.display_name,
    ))
