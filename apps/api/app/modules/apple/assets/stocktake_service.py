"""盘点服务 — 按地点分组生成盘点报告"""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.apple.assets import repository
from app.modules.apple.assets.schemas import (
    AssetResponse,
    StocktakeLocationGroup,
    StocktakeResponse,
)


async def stocktake_generate_report(
    db: AsyncSession,
    location: str | None = None,
) -> StocktakeResponse:
    """生成盘点报告（按地点分组）"""
    grouped = await repository.list_assets_grouped_by_location(db, location=location)
    stats = await repository.get_asset_stats(db)

    location_groups: list[StocktakeLocationGroup] = []
    for loc, assets_item in grouped.items():
        loc_stats = {
            "total": len(assets_item),
            "active": sum(1 for a in assets_item if a.status == "active"),
            "moved": sum(1 for a in assets_item if a.status == "moved"),
            "missing": sum(1 for a in assets_item if a.status == "missing"),
        }
        location_groups.append(StocktakeLocationGroup(
            location=loc,
            total=loc_stats["total"],
            active=loc_stats["active"],
            moved=loc_stats["moved"],
            missing=loc_stats["missing"],
            assets=[AssetResponse.model_validate(a) for a in assets_item],
        ))

    return StocktakeResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_assets=stats["total"],
        total_active=stats["active"],
        total_moved=stats["moved"],
        total_written_off=stats["written_off"],
        total_missing=stats["missing"],
        location_groups=location_groups,
    )
