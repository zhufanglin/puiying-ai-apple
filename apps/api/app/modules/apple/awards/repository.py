"""奖状 & 奖学金 — 数据访问层 (Repository)

职责：封装所有 SQLAlchemy 数据库操作，供 service 层调用。
     service 层不应该直接操作 ORM。
"""
from datetime import date
from typing import Optional

from sqlalchemy import select, func, delete as sa_delete, Select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.pagination import paginate
from app.modules.apple.awards.models import (
    Award, AwardTemplate, AwardRecipient,
    ScholarshipApplication,
)


# ==================== 奖状模板 ====================

async def list_templates(
    db: AsyncSession,
    name: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AwardTemplate], int, int]:
    """查询奖状模板列表（分页）"""
    stmt: Select = select(AwardTemplate).order_by(AwardTemplate.id.desc())

    if name:
        stmt = stmt.where(AwardTemplate.name.ilike(f"%{name}%"))
    if category:
        stmt = stmt.where(AwardTemplate.category == category)
    if is_active is not None:
        stmt = stmt.where(AwardTemplate.is_active == is_active)

    return await paginate(db, stmt, page, page_size)


async def get_template(db: AsyncSession, template_id: int) -> Optional[AwardTemplate]:
    """获取单个奖状模板"""
    result = await db.execute(
        select(AwardTemplate).where(AwardTemplate.id == template_id)
    )
    return result.scalar_one_or_none()


async def create_template(db: AsyncSession, data: dict) -> AwardTemplate:
    """创建奖状模板"""
    obj = AwardTemplate(**data)
    db.add(obj)
    await db.flush()
    return obj


async def update_template(db: AsyncSession, template_id: int, data: dict) -> Optional[AwardTemplate]:
    """更新奖状模板"""
    obj = await get_template(db, template_id)
    if not obj:
        return None
    for key, val in data.items():
        if val is not None:
            setattr(obj, key, val)
    await db.flush()
    await db.refresh(obj)
    return obj


async def delete_template(db: AsyncSession, template_id: int) -> bool:
    """删除奖状模板"""
    obj = await get_template(db, template_id)
    if not obj:
        return False
    # 检查是否有奖状关联此模板
    count_result = await db.execute(
        select(func.count()).select_from(Award).where(Award.template_id == template_id)
    )
    count = count_result.scalar() or 0
    if count > 0:
        from app.common.errors import raise_error, BUSINESS_ERROR
        raise_error(*BUSINESS_ERROR, detail={"message": f"無法刪除模板：有 {count} 份獎狀正在使用此模板"})
    await db.delete(obj)
    await db.flush()
    return True


# ==================== 奖状 ====================

async def list_awards(
    db: AsyncSession,
    title: Optional[str] = None,
    template_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Award], int, int]:
    """查询奖状列表（分页），附带模板名称"""
    stmt: Select = (
        select(Award)
        .options(selectinload(Award.template))
        .order_by(Award.id.desc())
    )

    if title:
        stmt = stmt.where(Award.title.ilike(f"%{title}%"))
    if template_id:
        stmt = stmt.where(Award.template_id == template_id)
    if status:
        stmt = stmt.where(Award.status == status)
    if date_from:
        stmt = stmt.where(Award.issue_date >= date_from)
    if date_to:
        stmt = stmt.where(Award.issue_date <= date_to)

    return await paginate(db, stmt, page, page_size)


async def get_award(db: AsyncSession, award_id: int) -> Optional[Award]:
    """获取单个奖状（含模板 + 获奖学生）"""
    result = await db.execute(
        select(Award)
        .options(
            selectinload(Award.template),
            selectinload(Award.recipients),
        )
        .where(Award.id == award_id)
    )
    return result.scalar_one_or_none()


async def create_award(db: AsyncSession, data: dict) -> Award:
    """创建奖状"""
    obj = Award(**data)
    db.add(obj)
    await db.flush()
    return obj


async def update_award(db: AsyncSession, award_id: int, data: dict) -> Optional[Award]:
    """更新奖状（不含获奖学生）"""
    obj = await get_award(db, award_id)
    if not obj:
        return None
    for key, val in data.items():
        if val is not None:
            setattr(obj, key, val)
    await db.flush()
    return obj


async def delete_award(db: AsyncSession, award_id: int) -> bool:
    """删除奖状（级联删除获奖学生）"""
    obj = await db.execute(select(Award).where(Award.id == award_id))
    obj = obj.scalar_one_or_none()
    if not obj:
        return False
    await db.delete(obj)
    await db.flush()
    return True


# ==================== 获奖学生 ====================

async def add_recipients(db: AsyncSession, award_id: int, recipients_data: list[dict]) -> list[AwardRecipient]:
    """批量添加获奖学生"""
    objs = [AwardRecipient(award_id=award_id, **rd) for rd in recipients_data]
    db.add_all(objs)
    await db.flush()

    # 原子递增 total_recipients（避免竞态）
    await db.execute(
        sa_update(Award)
        .where(Award.id == award_id)
        .values(total_recipients=Award.total_recipients + len(objs))
    )
    await db.flush()

    return objs


async def get_recipient(db: AsyncSession, recipient_id: int) -> Optional[AwardRecipient]:
    """获取单个获奖学生"""
    result = await db.execute(
        select(AwardRecipient).where(AwardRecipient.id == recipient_id)
    )
    return result.scalar_one_or_none()


async def remove_recipient(db: AsyncSession, recipient_id: int) -> bool:
    """删除单个获奖学生"""
    obj = await db.execute(
        select(AwardRecipient).where(AwardRecipient.id == recipient_id)
    )
    obj = obj.scalar_one_or_none()
    if not obj:
        return False
    # 原子递减 total_recipients（避免竞态）
    await db.execute(
        sa_update(Award)
        .where(Award.id == obj.award_id, Award.total_recipients > 0)
        .values(total_recipients=Award.total_recipients - 1)
    )
    await db.delete(obj)
    await db.flush()
    return True


# ==================== 奖学金申请 ====================

async def list_scholarship_applications(
    db: AsyncSession,
    student_name: Optional[str] = None,
    scholarship_type: Optional[str] = None,
    status: Optional[str] = None,
    academic_year: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ScholarshipApplication], int, int]:
    """查询奖学金申请列表（分页）"""
    stmt: Select = (
        select(ScholarshipApplication)
        .options(selectinload(ScholarshipApplication.reviewer))
        .order_by(ScholarshipApplication.id.desc())
    )

    if student_name:
        stmt = stmt.where(ScholarshipApplication.student_name.ilike(f"%{student_name}%"))
    if scholarship_type:
        stmt = stmt.where(ScholarshipApplication.scholarship_type == scholarship_type)
    if status:
        stmt = stmt.where(ScholarshipApplication.status == status)
    if academic_year:
        stmt = stmt.where(ScholarshipApplication.academic_year == academic_year)

    return await paginate(db, stmt, page, page_size)


async def get_scholarship_application(db: AsyncSession, app_id: int) -> Optional[ScholarshipApplication]:
    """获取单个奖学金申请"""
    result = await db.execute(
        select(ScholarshipApplication)
        .options(selectinload(ScholarshipApplication.reviewer))
        .where(ScholarshipApplication.id == app_id)
    )
    return result.scalar_one_or_none()


async def create_scholarship_application(db: AsyncSession, data: dict) -> ScholarshipApplication:
    """创建奖学金申请"""
    obj = ScholarshipApplication(**data)
    db.add(obj)
    await db.flush()
    return obj


async def update_scholarship_application(
    db: AsyncSession, app_id: int, data: dict
) -> Optional[ScholarshipApplication]:
    """更新奖学金申请（审核用）"""
    obj = await get_scholarship_application(db, app_id)
    if not obj:
        return None
    for key, val in data.items():
        if val is not None:
            setattr(obj, key, val)
    await db.flush()
    # 重新查询以获取完整的关联数据（避免 MissingGreenlet 问题）
    return await get_scholarship_application(db, app_id)


# ==================== 统计 ====================

async def get_award_statistics(db: AsyncSession) -> dict:
    """获取奖状统计"""
    rows = await db.execute(
        select(Award.status, func.count(Award.id))
        .group_by(Award.status)
    )
    status_counts = dict(rows.all())

    total_recipients = await db.execute(
        select(func.coalesce(func.sum(Award.total_recipients), 0))
    )
    template_count = await db.execute(
        select(func.count()).select_from(AwardTemplate)
    )

    return {
        "total_awards": sum(status_counts.values()),
        "draft_count": status_counts.get("draft", 0),
        "calculated_count": status_counts.get("calculated", 0),
        "confirmed_count": status_counts.get("confirmed", 0),
        "cancelled_count": status_counts.get("cancelled", 0),
        "total_recipients": total_recipients.scalar() or 0,
        "template_count": template_count.scalar() or 0,
    }


async def get_scholarship_statistics(db: AsyncSession) -> dict:
    """获取奖学金统计"""
    rows = await db.execute(
        select(ScholarshipApplication.status, func.count(ScholarshipApplication.id))
        .group_by(ScholarshipApplication.status)
    )
    status_counts = dict(rows.all())

    total_amount = await db.execute(
        select(func.coalesce(func.sum(ScholarshipApplication.amount), 0))
    )
    approved_amount = await db.execute(
        select(func.coalesce(func.sum(ScholarshipApplication.amount), 0))
        .where(ScholarshipApplication.status == "approved")
    )

    return {
        "total_applications": sum(status_counts.values()),
        "pending_count": status_counts.get("pending", 0),
        "approved_count": status_counts.get("approved", 0),
        "rejected_count": status_counts.get("rejected", 0),
        "total_amount": total_amount.scalar() or 0,
        "approved_amount": approved_amount.scalar() or 0,
    }
