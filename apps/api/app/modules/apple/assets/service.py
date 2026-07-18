"""A3 资产盘点 — 业务逻辑层

方法（严格按任务指南 §5.2）:
- stocktake_generate_report()  盘点报告生成
- writeoff_asset()             资产注销 + 创建 Approval + 写 AuditLog
- print_labels()               批量打印标签
"""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import raise_error
from app.modules.apple.assets import repository
from app.modules.apple.assets.models import Asset
from app.modules.apple.assets.schemas import (
    AssetResponse,
    StocktakeLocationGroup,
    StocktakeResponse,
)


# ============== 盘点 ==============

async def stocktake_generate_report(
    db: AsyncSession,
    location: str | None = None,
) -> StocktakeResponse:
    """生成盘点报告（按地点分组）— 任务指南 §5.2 stocktake_service"""
    grouped = await repository.list_assets_grouped_by_location(db, location=location)
    stats = await repository.get_asset_stats(db)

    location_groups: list[StocktakeLocationGroup] = []
    for loc, assets in grouped.items():
        loc_stats = {
            "total": len(assets),
            "active": sum(1 for a in assets if a.status == "active"),
            "moved": sum(1 for a in assets if a.status == "moved"),
            "missing": sum(1 for a in assets if a.status == "missing"),
        }
        location_groups.append(StocktakeLocationGroup(
            location=loc,
            total=loc_stats["total"],
            active=loc_stats["active"],
            moved=loc_stats["moved"],
            missing=loc_stats["missing"],
            assets=[AssetResponse.model_validate(a) for a in assets],
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


# ============== 注销 ==============

async def writeoff_asset(db: AsyncSession, asset: Asset, reason: str) -> Asset:
    """注销资产 — 任务指南 §5.2 asset_writeoff_service

    流程: 更新 status → 创建 Approval → 写 AuditLog
    """
    if asset.status == "written_off":
        raise_error(40005, "该资产已注销，无需重复操作")

    data = {
        "status": "written_off",
        "written_off_at": datetime.now(timezone.utc),
        "written_off_reason": reason,
    }
    result = await repository.update_asset(db, asset, data)

    # 创建 Approval 记录（待审批）
    from app.modules.approvals.models import Approval
    approval = Approval(
        module="assets",
        entity_type="writeoff",
        entity_id=asset.id,
        status="pending",
        submitted_by=asset.created_by,
    )
    db.add(approval)

    # 写审计日志
    from app.modules.audit.models import AuditLog
    log = AuditLog(
        user_id=asset.created_by,
        action="writeoff",
        module="assets",
        entity_type="asset",
        entity_id=str(asset.id),
    )
    db.add(log)

    return result


# ============== 打印标签 ==============

async def print_labels(db: AsyncSession, asset_ids: list[int]) -> list[str]:
    """批量生成资产标签"""
    labels: list[str] = []
    for aid in asset_ids:
        asset = await repository.get_asset_by_id(db, aid)
        if asset:
            labels.append(
                f"【{asset.asset_no}】\n"
                f"{asset.name}\n"
                f"地點：{asset.location}\n"
                f"類別：{asset.category}\n"
                f"狀態：{asset.status}\n"
            )
    return labels
