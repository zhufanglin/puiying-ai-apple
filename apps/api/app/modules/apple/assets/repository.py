"""A3 资产盘点 — 数据访问层"""
from datetime import date as date_type
from typing import Optional

from sqlalchemy import Select, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.pagination import paginate
from app.modules.apple.assets.models import Asset, AssetMovement


# ============== 资产 ==============

def _base_asset_stmt() -> Select:
    return select(Asset).order_by(Asset.location, Asset.asset_no)


async def list_assets(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 50,
    status: Optional[str] = None,
    location: Optional[str] = None,
    keyword: Optional[str] = None,
    exclude_written_off: bool = False,
) -> tuple[list[Asset], int, int]:
    """资产列表（支持多条件筛选）"""
    stmt = _base_asset_stmt()

    if exclude_written_off:
        stmt = stmt.where(Asset.status != "written_off")
    if status and status != "all":
        stmt = stmt.where(Asset.status == status)
    if location:
        stmt = stmt.where(Asset.location.ilike(f"%{location}%"))
    if keyword:
        stmt = stmt.where(
            (Asset.name.ilike(f"%{keyword}%")) | (Asset.asset_no.ilike(f"%{keyword}%"))
        )

    return await paginate(db, stmt, page, page_size)


async def list_assets_grouped_by_location(
    db: AsyncSession,
    location: Optional[str] = None,
) -> dict[str, list[Asset]]:
    """资产按地点分组"""
    stmt = select(Asset).order_by(Asset.location, Asset.asset_no)
    if location:
        stmt = stmt.where(Asset.location.ilike(f"%{location}%"))

    result = await db.execute(stmt)
    rows = result.scalars().all()

    grouped: dict[str, list[Asset]] = {}
    for a in rows:
        grouped.setdefault(a.location, []).append(a)
    return grouped


async def get_asset_by_id(db: AsyncSession, asset_id: int) -> Optional[Asset]:
    """根据 ID 获取资产"""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    return result.scalar_one_or_none()


async def create_asset(db: AsyncSession, data: dict, user_id: int) -> Asset:
    """新增资产（自动生成编号）"""
    if not data.get("asset_no"):
        from datetime import date
        year = str(date.today().year)
        count_result = await db.execute(select(func.count(Asset.id)))
        seq = (count_result.scalar() or 0) + 1
        data["asset_no"] = f"AS-{year}-{seq:03d}"

    asset = Asset(**data, created_by=user_id)
    db.add(asset)
    await db.flush()
    await db.refresh(asset)
    return asset


async def update_asset(db: AsyncSession, asset: Asset, data: dict) -> Asset:
    """更新资产"""
    for key, value in data.items():
        if value is not None:
            setattr(asset, key, value)
    await db.flush()
    await db.refresh(asset)
    return asset


async def delete_asset(db: AsyncSession, asset: Asset) -> None:
    """删除资产"""
    await db.delete(asset)
    await db.flush()


async def get_asset_stats(db: AsyncSession) -> dict:
    """资产统计"""
    result = await db.execute(
        select(
            func.count(Asset.id).label("total"),
            func.count().filter(Asset.status == "active").label("active"),
            func.count().filter(Asset.status == "moved").label("moved"),
            func.count().filter(Asset.status == "written_off").label("written_off"),
            func.count().filter(Asset.status == "missing").label("missing"),
        )
    )
    row = result.one()
    return {
        "total": row.total,
        "active": row.active,
        "moved": row.moved,
        "written_off": row.written_off,
        "missing": row.missing,
    }


# ============== 资产移动 ==============

async def list_movements(
    db: AsyncSession,
    *,
    asset_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AssetMovement], int, int]:
    """资产移动记录列表"""
    stmt = select(AssetMovement).order_by(AssetMovement.movement_date.desc(), AssetMovement.id.desc())
    if asset_id:
        stmt = stmt.where(AssetMovement.asset_id == asset_id)
    return await paginate(db, stmt, page, page_size)


async def create_movement(
    db: AsyncSession,
    asset_id: int,
    data: dict,
    user_id: int,
) -> AssetMovement:
    """记录资产搬移"""
    movement = AssetMovement(asset_id=asset_id, created_by=user_id, **data)
    db.add(movement)
    await db.flush()
    await db.refresh(movement)
    return movement


async def list_all_movements(
    db: AsyncSession,
) -> list[AssetMovement]:
    """所有移动记录"""
    result = await db.execute(
        select(AssetMovement).order_by(AssetMovement.movement_date.desc(), AssetMovement.id.desc())
    )
    return list(result.scalars().all())
