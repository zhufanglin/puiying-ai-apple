"""JWT 认证与密码哈希"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.session import get_db

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============== 密码 ==============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ============== Token ==============

def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


# ============== 当前用户（FastAPI 依赖）==============

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """从 JWT 中提取当前登录用户，返回 User ORM 对象 + 权限列表"""
    from app.modules.accounts.models import User
    from app.modules.accounts.models import RolePermission, Permission

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail={"code": 10001, "message": "无效的访问令牌"})

    user_id = int(payload.get("sub", 0))
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(RolePermission).selectinload(RolePermission.permission)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail={"code": 10001, "message": "用户不存在或已禁用"})

    return user
