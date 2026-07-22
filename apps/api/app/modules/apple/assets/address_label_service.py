"""资产标签打印服务 — 批量生成标签文字"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.apple.assets import repository


async def print_labels(db: AsyncSession, asset_ids: list[int]) -> list[str]:
    """批量生成资产标签"""
    labels: list[str] = []
    for aid in asset_ids:
        asset = await repository.get_asset_by_id(db, aid)
        if asset:
            labels.append(
                f"【{asset.asset_no}】\n"
                f"{asset.name}\n"
                f"地点：{asset.location}\n"
                f"类别：{asset.category}\n"
                f"状态：{asset.status}\n"
            )
    return labels
