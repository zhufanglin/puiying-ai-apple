"""统一日志配置"""
import logging
import sys

from app.core.config import get_settings

settings = get_settings()


def setup_logging():
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    fmt = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"

    logging.basicConfig(
        level=level,
        format=fmt,
        stream=sys.stdout,
    )

    # 抑制第三方库的 DEBUG 日志
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
