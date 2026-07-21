"""A2 财务收支 — API 路由

端点清单（严格按任务指南 §4.3，8 个端点）:
- GET    /income                      收入列表
- POST   /income                      新增收入（支持 OCR 预填）
- GET    /expense                     支出列表
- POST   /expense                     新增支出
- GET    /quotations                  报价单列表
- POST   /quotations                  新增报价单
- POST   /quotations/analyze          报价分析
- POST   /address-labels              生成地址 LABEL

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
from app.modules.apple.finance import repository, service
from app.modules.apple.finance.schemas import (
    AddressLabelRequest,
    AddressLabelResponse,
    FinanceRecordCreate,
    FinanceRecordResponse,
    FinanceRecordUpdate,
    QuotationAnalysisResponse,
    QuotationCreate,
    QuotationResponse,
)

router = APIRouter()


# ═══════════════════════════════════════════════════════════
# 收入
# ═══════════════════════════════════════════════════════════

@router.get("/income", response_model=APIResponse[PaginatedData[FinanceRecordResponse]])
async def list_income(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="状态筛选: pending / confirmed"),
    project: Optional[str] = Query(None, description="项目名模糊搜索"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.FINANCE_READ)),
):
    """收入列表"""
    items, total, total_pages = await repository.list_income(
        db, page=page, page_size=page_size, status=status, project=project,
    )
    return APIResponse(data=PaginatedData(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.post("/income", response_model=APIResponse[FinanceRecordResponse])
async def create_income(
    body: FinanceRecordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.FINANCE_WRITE)),
):
    """新增收入记录 — 支持 OCR 自动填充"""
    if body.type != "income":
        raise_error(*VALIDATION_ERROR, detail={"message": "type 必须为 income"})

    data = body.model_dump(exclude_unset=True)
    if body.file_id:
        ocr_result = await service.receipt_ocr_analyze(db, body.file_id, user.id)
        if not data.get("amount"):
            data["amount"] = ocr_result["amount"]
        if not data.get("project"):
            data["project"] = ocr_result["purpose"]
        if not data.get("handler"):
            data["handler"] = ocr_result["payer"]

    record = await service.create_income(db, data, user.id)
    return APIResponse(data=record)


@router.get("/income/{record_id}", response_model=APIResponse[FinanceRecordResponse])
async def get_income_detail(
    record_id: int, db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.FINANCE_READ)),
):
    """收入详情"""
    record = await repository.get_record_by_id(db, record_id)
    if not record or record.type != "income":
        raise_error(*NOT_FOUND)
    return APIResponse(data=record)


@router.put("/income/{record_id}", response_model=APIResponse[FinanceRecordResponse])
async def update_income(
    record_id: int, body: FinanceRecordUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.FINANCE_WRITE)),
):
    """更新收入记录"""
    record = await repository.get_record_by_id(db, record_id)
    if not record or record.type != "income":
        raise_error(*NOT_FOUND)
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    record = await repository.update_record(db, record, data)

    # 审计日志
    db.add(AuditLog(user_id=user.id, action="update", module="finance",
                    entity_type="income", entity_id=record.id))
    await db.flush()
    return APIResponse(data=record)


@router.delete("/income/{record_id}", response_model=APIResponse[None])
async def delete_income(
    record_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.FINANCE_DELETE)),
):
    """删除收入记录"""
    record = await repository.get_record_by_id(db, record_id)
    if not record or record.type != "income":
        raise_error(*NOT_FOUND)
    await repository.delete_record(db, record)

    db.add(AuditLog(user_id=user.id, action="delete", module="finance",
                    entity_type="income", entity_id=record_id))
    await db.flush()
    return APIResponse(message="已删除")


# ═══════════════════════════════════════════════════════════
# 支出
# ═══════════════════════════════════════════════════════════

@router.get("/expense", response_model=APIResponse[PaginatedData[FinanceRecordResponse]])
async def list_expense(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    supplier: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.FINANCE_READ)),
):
    """支出列表"""
    items, total, total_pages = await repository.list_expense(
        db, page=page, page_size=page_size, status=status, supplier=supplier,
    )
    return APIResponse(data=PaginatedData(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.post("/expense", response_model=APIResponse[FinanceRecordResponse])
async def create_expense(
    body: FinanceRecordCreate, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.FINANCE_WRITE)),
):
    """新增支出记录"""
    if body.type != "expense":
        raise_error(*VALIDATION_ERROR, detail={"message": "type 必须为 expense"})
    data = body.model_dump(exclude_unset=True)
    record = await service.create_expense(db, data, user.id)
    return APIResponse(data=record)


@router.get("/expense/{record_id}", response_model=APIResponse[FinanceRecordResponse])
async def get_expense_detail(
    record_id: int, db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.FINANCE_READ)),
):
    """支出详情"""
    record = await repository.get_record_by_id(db, record_id)
    if not record or record.type != "expense":
        raise_error(*NOT_FOUND)
    return APIResponse(data=record)


@router.put("/expense/{record_id}", response_model=APIResponse[FinanceRecordResponse])
async def update_expense(
    record_id: int, body: FinanceRecordUpdate,
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.FINANCE_WRITE)),
):
    """更新支出记录（含审批）"""
    record = await repository.get_record_by_id(db, record_id)
    if not record or record.type != "expense":
        raise_error(*NOT_FOUND)
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    record = await repository.update_record(db, record, data)

    db.add(AuditLog(user_id=user.id, action="update", module="finance",
                    entity_type="expense", entity_id=record.id))
    await db.flush()
    return APIResponse(data=record)


@router.delete("/expense/{record_id}", response_model=APIResponse[None])
async def delete_expense(
    record_id: int, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.FINANCE_DELETE)),
):
    """删除支出记录"""
    record = await repository.get_record_by_id(db, record_id)
    if not record or record.type != "expense":
        raise_error(*NOT_FOUND)
    await repository.delete_record(db, record)

    db.add(AuditLog(user_id=user.id, action="delete", module="finance",
                    entity_type="expense", entity_id=record_id))
    await db.flush()
    return APIResponse(message="已删除")


# ═══════════════════════════════════════════════════════════
# 报价单
# ═══════════════════════════════════════════════════════════

@router.get("/quotations", response_model=APIResponse[PaginatedData[QuotationResponse]])
async def list_quotations(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
    project_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.FINANCE_READ)),
):
    """报价单列表"""
    items, total, total_pages = await repository.list_quotations(
        db, page=page, page_size=page_size, project_name=project_name,
    )
    return APIResponse(data=PaginatedData(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.post("/quotations", response_model=APIResponse[QuotationResponse])
async def create_quotation(
    body: QuotationCreate, db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.FINANCE_WRITE)),
):
    """新增报价单"""
    data = body.model_dump()
    q = await repository.create_quotation(db, data, user.id)

    db.add(AuditLog(user_id=user.id, action="create", module="finance",
                    entity_type="quotation", entity_id=q.id))
    await db.flush()
    return APIResponse(data=q)


@router.post("/quotations/analyze", response_model=APIResponse[QuotationAnalysisResponse])
async def analyze_quotations(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.FINANCE_READ)),
):
    """报价单分析（AI 规则引擎）— 自动识别单一报价/未采纳最低报价"""
    result = await service.quotation_analyze(db)
    return APIResponse(data=result)


# ═══════════════════════════════════════════════════════════
# 地址标签
# ═══════════════════════════════════════════════════════════

@router.post("/address-labels", response_model=APIResponse[AddressLabelResponse])
async def generate_labels(
    body: AddressLabelRequest, db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.FINANCE_READ)),
):
    """批量生成地址 LABEL"""
    labels = await service.generate_address_labels(db, body.record_ids)
    return APIResponse(data=AddressLabelResponse(labels=labels, generated_count=len(labels)))
