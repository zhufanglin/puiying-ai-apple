"""A2 财务收支 — 数据访问层

严格按任务指南 §4.4 方法定义。
"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import Select, select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.pagination import paginate
from app.modules.apple.finance.models import FinanceRecord, Quotation


# ============== 收支记录 ==============

def _base_income_stmt() -> Select:
    return (
        select(FinanceRecord)
        .where(FinanceRecord.type == "income")
        .order_by(FinanceRecord.date.desc(), FinanceRecord.id.desc())
    )


def _base_expense_stmt() -> Select:
    return (
        select(FinanceRecord)
        .where(FinanceRecord.type == "expense")
        .order_by(FinanceRecord.date.desc(), FinanceRecord.id.desc())
    )


async def list_income(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    project: Optional[str] = None,
) -> tuple[list[FinanceRecord], int, int]:
    """收入列表（支持筛选）— 对应 GET /income"""
    stmt = _base_income_stmt()
    if status:
        stmt = stmt.where(FinanceRecord.status == status)
    if project:
        stmt = stmt.where(FinanceRecord.project.ilike(f"%{project}%"))
    return await paginate(db, stmt, page, page_size)


async def list_expense(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    supplier: Optional[str] = None,
) -> tuple[list[FinanceRecord], int, int]:
    """支出列表（支持筛选）— 对应 GET /expense"""
    stmt = _base_expense_stmt()
    if status:
        stmt = stmt.where(FinanceRecord.status == status)
    if supplier:
        stmt = stmt.where(FinanceRecord.supplier.ilike(f"%{supplier}%"))
    return await paginate(db, stmt, page, page_size)


async def get_record_by_id(db: AsyncSession, record_id: int) -> Optional[FinanceRecord]:
    """根据 ID 获取单条记录"""
    result = await db.execute(
        select(FinanceRecord).where(FinanceRecord.id == record_id)
    )
    return result.scalar_one_or_none()


async def create_record(db: AsyncSession, data: dict, user_id: int) -> FinanceRecord:
    """新增收支记录"""
    record = FinanceRecord(**data, created_by=user_id)
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def update_record(db: AsyncSession, record: FinanceRecord, data: dict) -> FinanceRecord:
    """更新收支记录"""
    for key, value in data.items():
        if value is not None:
            setattr(record, key, value)
    await db.flush()
    await db.refresh(record)
    return record


async def delete_record(db: AsyncSession, record: FinanceRecord) -> None:
    """删除收支记录"""
    await db.delete(record)
    await db.flush()


async def get_finance_stats(db: AsyncSession, record_type: str) -> dict:
    """获取财务统计数据 — 任务指南 §4.4 get_finance_stats"""
    result = await db.execute(
        select(
            func.count(FinanceRecord.id).label("total"),
            func.coalesce(func.sum(FinanceRecord.amount), 0).label("total_amount"),
        ).where(FinanceRecord.type == record_type)
    )
    row = result.one()

    if record_type == "income":
        pending_result = await db.execute(
            select(func.coalesce(func.sum(FinanceRecord.amount), 0)).where(
                and_(FinanceRecord.type == "income", FinanceRecord.status == "pending")
            )
        )
        confirmed_result = await db.execute(
            select(func.coalesce(func.sum(FinanceRecord.amount), 0)).where(
                and_(FinanceRecord.type == "income", FinanceRecord.status == "confirmed")
            )
        )
        return {
            "total": row.total,
            "total_amount": row.total_amount,
            "pending_amount": pending_result.scalar() or 0,
            "confirmed_amount": confirmed_result.scalar() or 0,
        }

    # expense
    pending_count = await db.execute(
        select(func.count(FinanceRecord.id)).where(
            and_(FinanceRecord.type == "expense", FinanceRecord.status == "pending")
        )
    )
    approved_count = await db.execute(
        select(func.count(FinanceRecord.id)).where(
            and_(FinanceRecord.type == "expense", FinanceRecord.status == "approved")
        )
    )
    return {
        "total": row.total,
        "total_amount": row.total_amount,
        "pending_count": pending_count.scalar() or 0,
        "approved_count": approved_count.scalar() or 0,
    }


# ============== 报价单 ==============

async def list_quotations(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 50,
    project_name: Optional[str] = None,
) -> tuple[list[Quotation], int, int]:
    """报价单列表"""
    stmt = select(Quotation).order_by(Quotation.project_name, Quotation.amount)
    if project_name:
        stmt = stmt.where(Quotation.project_name.ilike(f"%{project_name}%"))
    return await paginate(db, stmt, page, page_size)


async def get_quotations_grouped(db: AsyncSession) -> dict[str, list[Quotation]]:
    """报价单按项目名分组"""
    result = await db.execute(
        select(Quotation).order_by(Quotation.project_name, Quotation.amount)
    )
    rows = result.scalars().all()
    grouped: dict[str, list[Quotation]] = {}
    for q in rows:
        grouped.setdefault(q.project_name, []).append(q)
    return grouped


async def create_quotation(db: AsyncSession, data: dict, user_id: int) -> Quotation:
    """新增报价单"""
    q = Quotation(**data, created_by=user_id)
    db.add(q)
    await db.flush()
    await db.refresh(q)
    return q


async def get_quotation_by_id(db: AsyncSession, q_id: int) -> Optional[Quotation]:
    """根据 ID 获取报价单"""
    result = await db.execute(select(Quotation).where(Quotation.id == q_id))
    return result.scalar_one_or_none()
