"""数据库驱动的百度 OCR Celery 任务。"""

from __future__ import annotations

import asyncio
from typing import Any, Callable

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from workers.ocr_worker.handlers.certificate_handler import extract_certificate_fields
from workers.ocr_worker.handlers.document_handler import build_document_result
from workers.ocr_worker.handlers.receipt_handler import extract_receipt_fields
from workers.ocr_worker.main import app
from workers.ocr_worker.services.ocr_engine import OcrEngine, OcrResult


WorkerSessionFactory = Callable[[], AsyncSession]


def create_worker_session_factory(
    database_url: str | None = None,
    *,
    echo: bool | None = None,
) -> tuple[AsyncEngine, WorkerSessionFactory]:
    """为单个 Celery 任务创建不跨事件循环复用连接的会话工厂。"""
    if database_url is None:
        from app.core.config import get_settings

        settings = get_settings()
        database_url = settings.DATABASE_URL
        echo = settings.DEBUG if echo is None else echo
    engine = create_async_engine(
        database_url,
        echo=bool(echo),
        poolclass=NullPool,
    )
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return engine, session_factory


def build_job_result(job_type: str, ocr_result: OcrResult) -> dict[str, Any]:
    """将 OCR 原文转换为 API 可消费的统一结构。"""
    ocr_payload = ocr_result.to_dict()
    if job_type == "receipt":
        structured = extract_receipt_fields(ocr_result.text, ocr_result.confidence)
    elif job_type == "certificate":
        structured = extract_certificate_fields(ocr_result.text, ocr_result.confidence)
    else:
        structured = build_document_result(
            ocr_result.text,
            ocr_result.confidence,
            ocr_result.warnings,
        )
    return {"ocr": ocr_payload, **structured}


async def _process_job(job_id: int, job_type_override: str | None = None) -> dict[str, Any]:
    from sqlalchemy import select

    from app.modules.files.models import File
    from app.modules.ocr.models import OCRJob

    engine, session_factory = create_worker_session_factory()
    try:
        async with session_factory() as db:
            result = await db.execute(select(OCRJob).where(OCRJob.id == job_id))
            job = result.scalar_one_or_none()
            if not job:
                raise ValueError(f"OCR 任务 {job_id} 不存在")
            if job.status == "completed" and isinstance(job.result_json, dict):
                return job.result_json

            file_result = await db.execute(select(File).where(File.id == job.file_id))
            file_record = file_result.scalar_one_or_none()
            if not file_record:
                job.status = "failed"
                job.error_message = f"文件 {job.file_id} 不存在"
                await db.commit()
                raise FileNotFoundError(job.error_message)

            job.status = "processing"
            job.error_message = None
            await db.commit()

            try:
                job_type = job_type_override or job.job_type or "document"
                ocr_result = await asyncio.to_thread(
                    OcrEngine().extract,
                    file_record.stored_path,
                    job_type=job_type,
                )
                payload = build_job_result(job_type, ocr_result)
                job.result_text = ocr_result.text
                job.result_json = payload
                job.status = "completed"
                await db.commit()
                return payload
            except Exception as exc:
                job.status = "failed"
                job.error_message = str(exc)[:500]
                await db.commit()
                raise
    finally:
        await engine.dispose()


def process_ocr_job_sync(job_id: int, *, job_type_override: str | None = None) -> dict[str, Any]:
    return asyncio.run(_process_job(job_id, job_type_override))


@app.task(name="ocr.process", bind=True, max_retries=3, default_retry_delay=15)
def process_ocr_job(self, job_id: int) -> dict[str, Any]:
    try:
        return process_ocr_job_sync(job_id)
    except OSError as exc:
        raise self.retry(exc=exc)


@app.task(name="ocr.process_receipt", bind=True, max_retries=3, default_retry_delay=15)
def process_receipt_ocr(self, job_id: int) -> dict[str, Any]:
    try:
        return process_ocr_job_sync(job_id, job_type_override="receipt")
    except OSError as exc:
        raise self.retry(exc=exc)


@app.task(name="ocr.process_document", bind=True, max_retries=3, default_retry_delay=15)
def process_document_ocr(self, job_id: int) -> dict[str, Any]:
    try:
        return process_ocr_job_sync(job_id, job_type_override="document")
    except OSError as exc:
        raise self.retry(exc=exc)
