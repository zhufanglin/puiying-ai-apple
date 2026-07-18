"""OCR 异步任务路由。"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.schemas import APIResponse
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.accounts.models import User
from app.modules.files.models import File
from app.modules.ocr.celery_client import enqueue_ocr_job
from app.modules.ocr.models import OCRJob
from app.modules.ocr.schemas import OCRJobCreate, OCRJobResponse

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
