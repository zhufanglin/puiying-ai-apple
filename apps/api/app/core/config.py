"""应用配置（环境变量统一入口）"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # ---- 应用 ----
    APP_NAME: str = "培英中学 AI 数智化平台 — Apple 子系统"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    # ---- 数据库 ----
    DATABASE_URL: str = (
        "postgresql+asyncpg://puiying:puiying_dev@localhost:5432/puiying_apple"
    )

    # ---- Redis (Celery 用) ----
    REDIS_URL: str = "redis://localhost:6379/0"

    # ---- JWT ----
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 小时

    # ---- 文件上传 ----
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # ---- AI 服务（预留，演示期 mock） ----
    AI_API_URL: str = ""
    AI_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
