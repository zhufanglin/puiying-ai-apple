"""OCR 异步任务路由。"""

import os
import sys
from pathlib import Path

# 必须在 PaddleOCR import 之前设置，防止 Windows MKL/OpenMP 冲突导致 Segfault
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, status
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

# 让 API 也能 import worker 的 OCR 引擎
_worker_root = Path(__file__).resolve().parents[5] / "workers" / "ocr_worker" / "services"
if str(_worker_root) not in sys.path:
    sys.path.insert(0, str(_worker_root))

# 模块加载时只导入类定义，不实例化 PaddleOCR（避免启动时 Segfault 导致后端崩溃）
# PaddleOCR 的实际初始化延迟到首次 OCR 请求时（懒加载）
_paddle_backend = None
_paddle_load_error = None
try:
    from ocr_engine import PaddleOcrBackend
    # 不在此处实例化：PaddleOcrBackend() 会触发 PP-LCNet 模型加载，Windows 上 PaddleX 3.7.2 会 Segfault
    print("[OCR] PaddleOcrBackend class imported (lazy init)")
except Exception as _e:
    _paddle_load_error = str(_e)
    print(f"[OCR] PaddleOCR backend NOT available: {_e}")

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


@router.post("/recognize")
async def paddle_recognize(
    file: UploadFile = File(),
):
    """PaddleOCR 本地同步识别（无需 API key，无需 AI）。"""
    global _paddle_backend
    import tempfile
    from PIL import Image

    suffix = Path(file.filename or "image.png").suffix or ".png"
    try:
        contents = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="无法读取上传文件")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # 压缩大图：手机拍摄的照片通常 3000+ 像素，PaddleOCR 处理极慢
        # 缩放到长边不超过 1000px，识别速度提升 10x+，精度基本无损
        MAX_DIM = 1000
        img = Image.open(tmp_path)
        w, h = img.size
        if max(w, h) > MAX_DIM:
            ratio = MAX_DIM / max(w, h)
            new_size = (int(w * ratio), int(h * ratio))
            img = img.resize(new_size, Image.LANCZOS)
            img.save(tmp_path)
        img.close()  # 释放文件句柄，Windows 下必须关闭

        if _paddle_backend is None:
            try:
                _paddle_backend = PaddleOcrBackend()
            except Exception as e:
                raise RuntimeError(f"PaddleOCR 初始化失败：{e}")
        result = _paddle_backend.extract(Path(tmp_path))
        return {
            "text": result.text,
            "confidence": result.confidence,
            "engine": result.engine,
            "lines": [
                {"text": t, "confidence": c}
                for t, c in zip(
                    result.text.split("\n"),
                    [result.confidence] * len(result.text.split("\n")),
                )
            ] if result.text else [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PaddleOCR 识别失败：{e}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@router.post("/baidu-recognize")
async def baidu_recognize(
    file: UploadFile = File(),
):
    """百度 OCR 同步识别（无需 Redis/Celery，直连百度 API）。"""
    import tempfile
    from PIL import Image
    from ocr_engine import BaiduOcrBackend, OcrResult

    suffix = Path(file.filename or "image.png").suffix or ".png"
    try:
        contents = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="无法读取上传文件")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        backend = BaiduOcrBackend()
        result: OcrResult = backend.extract(Path(tmp_path))
        return {
            "text": result.text,
            "confidence": result.confidence,
            "engine": result.engine,
            "lines": [
                {"text": t, "confidence": c}
                for t, c in zip(
                    result.text.split("\n"),
                    [result.confidence] * len(result.text.split("\n")),
                )
            ] if result.text else [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"百度OCR 识别失败：{e}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)
