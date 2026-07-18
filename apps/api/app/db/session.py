"""SQLAlchemy 异步数据库会话"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

# SQLite 不支持 pool_size / max_overflow，需区分处理
_engine_kwargs = {
    "echo": settings.DEBUG,
}
if not settings.DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

engine = create_async_engine(
    settings.DATABASE_URL,
    **_engine_kwargs,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# FastAPI、Celery Worker 和独立脚本共用同一异步会话工厂。
SessionLocal = async_session_factory


async def get_db() -> AsyncSession:
    """FastAPI 依赖注入：每次请求提供独立会话"""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
