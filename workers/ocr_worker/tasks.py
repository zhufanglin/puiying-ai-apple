"""OCR Worker — Celery 任务定义

任务流（严格按文档 §4）:
    获取文件 → 调用 OCR 引擎 → 调用 AI Prompt → 结构化输出 → 写 ai_jobs 表
"""

from workers.ocr_worker.main import app
from workers.ocr_worker.services.ocr_engine import recognize_file


@app.task(name="ocr.process", bind=True, max_retries=3, default_retry_delay=30)
def process_ocr_job(self, job_id: int) -> dict:
    """处理 OCR 任务

    流程:
    1. 根据 job_id 查询 ocr_jobs 表获取文件信息
    2. 更新任务状态为 processing
    3. 调用 OCR 引擎识别
    4. 调用 AI Prompt 结构化（见 handlers/）
    5. 写入结果到 ocr_jobs.result_json
    6. 更新任务状态为 completed

    Args:
        job_id: ocr_jobs 表中的任务 ID

    Returns:
        dict: OCR 结构化结果
    """
    import asyncio
    from sqlalchemy import select
    from app.db.session import SessionLocal
    from app.modules.ocr.models import OCRJob
    from app.modules.files.models import File

    async def _run():
        async with SessionLocal() as db:
            # 1. 获取任务
            result = await db.execute(
                select(OCRJob).where(OCRJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                raise ValueError(f"OCR 任务 {job_id} 不存在")

            # 更新状态
            job.status = "processing"

            # 2. 获取文件
            result = await db.execute(
                select(File).where(File.id == job.file_id)
            )
            file_record = result.scalar_one_or_none()
            if not file_record:
                job.status = "failed"
                job.error_message = f"文件 {job.file_id} 不存在"
                await db.commit()
                return {"error": job.error_message}

            # 3. OCR 识别
            try:
                ocr_result = await recognize_file(file_record.stored_path)
            except Exception as e:
                job.status = "failed"
                job.error_message = f"OCR 识别失败: {str(e)}"
                await db.commit()
                raise

            # 4. 写入结果
            job.result_text = ocr_result.get("raw_text", "")
            job.result_json = ocr_result
            job.status = "completed"
            await db.commit()

            return ocr_result

    return asyncio.run(_run())


@app.task(name="ocr.process_receipt", bind=True)
def process_receipt_ocr(self, job_id: int) -> dict:
    """收据专用 OCR — 调用 receipt_handler 提取结构化字段"""
    import asyncio

    async def _run():
        from workers.ocr_worker.handlers.receipt_handler import handle_receipt_ocr
        return await handle_receipt_ocr(job_id)

    return asyncio.run(_run())


@app.task(name="ocr.process_document", bind=True)
def process_document_ocr(self, job_id: int) -> dict:
    """文档通用 OCR — 调用 document_handler"""
    import asyncio

    async def _run():
        from workers.ocr_worker.handlers.document_handler import handle_document_ocr
        return await handle_document_ocr(job_id)

    return asyncio.run(_run())
