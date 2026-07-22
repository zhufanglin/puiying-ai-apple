"""资产注销服务 — 更新状态 + 创建审批 + 审计日志"""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import raise_error
from app.modules.apple.assets import repository
from app.modules.apple.assets.models import Asset


async def writeoff_asset(db: AsyncSession, asset: Asset, reason: str) -> Asset:
    """注销资产

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
        entity_id=asset.id,
    )
    db.add(log)

    return result
