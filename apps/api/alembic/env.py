"""Alembic 环境配置（异步）"""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Alembic Config 对象
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# ---- 导入所有模型（确保 Alembic 能发现所有表）----
from app.db.base import Base

# 共用表
from app.modules.accounts.models import User, Role, Permission, RolePermission  # noqa: F401
from app.modules.files.models import File                                          # noqa: F401
from app.modules.ocr.models import OCRJob                                          # noqa: F401
from app.modules.ai.models import AIJob                                            # noqa: F401
from app.modules.audit.models import AuditLog                                      # noqa: F401
from app.modules.approvals.models import Approval                                  # noqa: F401

# Apple 业务表（同学写完后在这里补 import）
# from app.modules.apple.awards.models import Award, Certificate
# from app.modules.apple.finance.models import Receipt, Budget
# from app.modules.apple.assets.models import Asset, AssetMovement
# from app.modules.apple.students.models import Student, LeaveRequest

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式：生成 SQL 脚本"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """在线模式：直接连接数据库执行"""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Alembic 同步入口 → 桥接 asyncio"""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
