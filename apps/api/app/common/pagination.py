"""分页工具"""
from typing import TypeVar

from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


async def paginate(
    session,
    stmt: Select,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list, int, int]:
    """通用分页查询

    Returns:
        (items, total, total_pages)
    """
    # 总数
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # 分页
    offset = (page - 1) * page_size
    items_stmt = stmt.offset(offset).limit(page_size)
    result = await session.execute(items_stmt)
    items = result.scalars().all()

    total_pages = max(1, (total + page_size - 1) // page_size)
    return items, total, total_pages
