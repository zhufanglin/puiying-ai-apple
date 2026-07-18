"""OCR 异步任务路由。"""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.schemas import APIResponse
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.accounts.models import User
from app.modules.files.models import File
from app.modules.ocr.celery_client import enqueue_ocr_job
from app.modules.ocr.invoice_ai_service import AIInvoiceError, structure_invoice_with_ai
from app.modules.ocr.models import OCRJob
from app.modules.ocr.receipt_ai_service import AIReceiptError, structure_receipt_with_ai
from app.modules.ocr.schemas import (
    InvoiceAIStructureRequest,
    InvoiceAIStructureResponse,
    OCRJobCreate,
    OCRJobResponse,
    ReceiptAIStructureRequest,
    ReceiptAIStructureResponse,
)

router = APIRouter()


@router.post("/jobs", response_model=APIResponse[OCRJobResponse], status_code=status.HTTP_202_ACCEPTED)
async def create_ocr_job(
    body: OCRJobCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    file_result = await db.execute(
        select(File).where(File.id == body.file_id, File.uploaded_by == user.id)
    )
    file_record = file_result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="文件不存在")
    if file_record.module != body.module:
        raise HTTPException(status_code=422, detail="文件模块与 OCR 任务模块不一致")

    job = OCRJob(
        file_id=body.file_id,
        module=body.module,
        job_type=body.job_type,
        status="pending",
        created_by=user.id,
    )
    db.add(job)
    await db.flush()
    await db.commit()
    await db.refresh(job)

    try:
        enqueue_ocr_job(job.id)
    except Exception as exc:
        job.status = "failed"
        job.error_message = f"OCR Worker 暂不可用: {exc}"
        await db.commit()
        await db.refresh(job)

    return APIResponse(data=job)


@router.get("/jobs/{job_id}", response_model=APIResponse[OCRJobResponse])
async def get_ocr_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OCRJob).where(OCRJob.id == job_id, OCRJob.created_by == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="OCR 任务不存在")
    return APIResponse(data=job)


@router.post(
    "/receipt/structure",
    response_model=APIResponse[ReceiptAIStructureResponse],
)
async def structure_receipt(
    body: ReceiptAIStructureRequest,
    user: User = Depends(get_current_user),
    x_ai_api_key: str | None = Header(default=None, alias="X-AI-API-Key"),
):
    """调用用户选择的 DeepSeek 模型；Key 仅用于本次请求且不落库。"""

    del user  # 仅要求已登录；不要记录包含个人资料的 Prompt 输入。
    if not x_ai_api_key:
        raise HTTPException(status_code=422, detail="请输入 DeepSeek API Key")
    try:
        result = await structure_receipt_with_ai(body, x_ai_api_key)
    except AIReceiptError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return APIResponse(data=result)


@router.post(
    "/invoice/structure",
    response_model=APIResponse[InvoiceAIStructureResponse],
)
async def structure_invoice(
    body: InvoiceAIStructureRequest,
    user: User = Depends(get_current_user),
    x_ai_api_key: str | None = Header(default=None, alias="X-AI-API-Key"),
):
    """调用 DeepSeek 结构化资产发票；Key 仅用于本次请求且不落库。"""

    del user  # 仅要求已登录；禁止记录发票 OCR 原文或用户 Key。
    if not x_ai_api_key:
        raise HTTPException(status_code=422, detail="请输入 DeepSeek API Key")
    try:
        result = await structure_invoice_with_ai(body, x_ai_api_key)
    except AIInvoiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return APIResponse(data=result)
