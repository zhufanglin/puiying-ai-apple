"""A3 资产盘点 — API 路由

端点清单（严格按任务指南 §5.1，7 个端点）:
- GET    /                           资产列表
- POST   /                           新增资产
- GET    /{id}/movements             资产搬移历史
- POST   /{id}/movements             记录搬移
- POST   /stocktake                  盘点任务
- POST   /{id}/writeoff             资产注销
- POST   /print-labels              批量打印 LABEL

每个端点必须: 权限检查 + 数据库会话 + 当前用户 + 审计日志 + 统一返回
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import raise_error, NOT_FOUND, VALIDATION_ERROR
from app.common.schemas import APIResponse, PaginatedData
from app.core.permissions import Permissions, require_permission
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.accounts.models import User
from app.modules.audit.models import AuditLog
from app.modules.apple.assets import repository, service
from app.modules.apple.assets.schemas import (
    AssetCreate,
    AssetMovementCreate,
    AssetMovementResponse,
    AssetResponse,
    AssetUpdate,
    PrintLabelsRequest,
    PrintLabelsResponse,
    StocktakeRequest,
    StocktakeResponse,
    WriteoffRequest,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════
# 资产 CRUD
# ═══════════════════════════════════════════════════════════

@router.get("", response_model=APIResponse[PaginatedData[AssetResponse]])
async def list_assets(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.ASSETS_READ)),
):
    """资产列表"""
    items, total, total_pages = await repository.list_assets(
        db, page=page, page_size=page_size,
        status=status, location=location, keyword=keyword,
    )
    return APIResponse(data=PaginatedData(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.post("", response_model=APIResponse[AssetResponse])
async def create_asset(
    body: AssetCreate, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.ASSETS_WRITE)),
):
    """登记新资产（自动生成编号）"""
    data = body.model_dump(exclude_unset=True)
    asset = await repository.create_asset(db, data, user.id)

    db.add(AuditLog(user_id=user.id, action="create", module="assets",
                    entity_type="asset", entity_id=asset.id))
    await db.flush()
    return APIResponse(data=asset)


@router.get("/{asset_id}", response_model=APIResponse[AssetResponse])
async def get_asset(
    asset_id: int, db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.ASSETS_READ)),
):
    """资产详情"""
    asset = await repository.get_asset_by_id(db, asset_id)
    if not asset:
        raise_error(*NOT_FOUND)
    return APIResponse(data=asset)


@router.put("/{asset_id}", response_model=APIResponse[AssetResponse])
async def update_asset(
    asset_id: int, body: AssetUpdate,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.ASSETS_WRITE)),
):
    """更新资产信息"""
    asset = await repository.get_asset_by_id(db, asset_id)
    if not asset:
        raise_error(*NOT_FOUND)
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    asset = await repository.update_asset(db, asset, data)

    db.add(AuditLog(user_id=user.id, action="update", module="assets",
                    entity_type="asset", entity_id=asset.id))
    await db.flush()
    return APIResponse(data=asset)


@router.delete("/{asset_id}", response_model=APIResponse[None])
async def delete_asset(
    asset_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.ASSETS_DELETE)),
):
    """删除资产"""
    asset = await repository.get_asset_by_id(db, asset_id)
    if not asset:
        raise_error(*NOT_FOUND)
    await repository.delete_asset(db, asset)

    db.add(AuditLog(user_id=user.id, action="delete", module="assets",
                    entity_type="asset", entity_id=asset_id))
    await db.flush()
    return APIResponse(message="已删除")


# ═══════════════════════════════════════════════════════════
# 资产搬移
# ═══════════════════════════════════════════════════════════

@router.get("/{asset_id}/movements", response_model=APIResponse[PaginatedData[AssetMovementResponse]])
async def list_asset_movements(
    asset_id: int, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.ASSETS_READ)),
):
    """某资产的搬移历史"""
    asset = await repository.get_asset_by_id(db, asset_id)
    if not asset:
        raise_error(*NOT_FOUND)

    items, total, total_pages = await repository.list_movements(
        db, asset_id=asset_id, page=page, page_size=page_size,
    )
    return APIResponse(data=PaginatedData(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.post("/{asset_id}/movements", response_model=APIResponse[AssetMovementResponse])
async def create_asset_movement(
    asset_id: int, body: AssetMovementCreate,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.ASSETS_WRITE)),
):
    """记录资产搬移（同时更新资产地点和状态）"""
    asset = await repository.get_asset_by_id(db, asset_id)
    if not asset:
        raise_error(*NOT_FOUND)

    if body.from_location != asset.location:
        raise_error(40002, f"当前资产地点为 {asset.location}，与填写的 {body.from_location} 不一致")
    if body.from_location == body.to_location:
        raise_error(40003, "目标地点不能与当前地点相同")

    movement = await repository.create_movement(
        db, asset_id, body.model_dump(), user_id=user.id,
    )

    await repository.update_asset(db, asset, {
        "location": body.to_location, "status": "moved",
    })

    db.add(AuditLog(user_id=user.id, action="move", module="assets",
                    entity_type="asset", entity_id=asset.id))
    await db.flush()
    return APIResponse(data=movement)


# ═══════════════════════════════════════════════════════════
# 盘点
# ═══════════════════════════════════════════════════════════

@router.post("/stocktake", response_model=APIResponse[StocktakeResponse])
async def stocktake(
    body: StocktakeRequest, db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.ASSETS_READ)),
):
    """执行盘点 — 按地点分组生成盘点报告"""
    result = await service.stocktake_generate_report(db, location=body.location)
    return APIResponse(data=result)


# ═══════════════════════════════════════════════════════════
# 注销
# ═══════════════════════════════════════════════════════════

@router.post("/{asset_id}/writeoff", response_model=APIResponse[AssetResponse])
async def writeoff_asset(
    asset_id: int, body: WriteoffRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.ASSETS_APPROVE)),
):
    """注销资产 — 更新状态 + 创建 Approval + 写 AuditLog"""
    asset = await repository.get_asset_by_id(db, asset_id)
    if not asset:
        raise_error(*NOT_FOUND)

    asset = await service.writeoff_asset(db, asset, body.reason)
    await db.flush()
    return APIResponse(data=asset)


# ═══════════════════════════════════════════════════════════
# 打印标签
# ═══════════════════════════════════════════════════════════

@router.post("/print-labels", response_model=APIResponse[PrintLabelsResponse])
async def print_labels(
    body: PrintLabelsRequest, db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.ASSETS_READ)),
):
    """批量打印资产标签"""
    labels = await service.print_labels(db, body.asset_ids)
    return APIResponse(data=PrintLabelsResponse(labels=labels, generated_count=len(labels)))
