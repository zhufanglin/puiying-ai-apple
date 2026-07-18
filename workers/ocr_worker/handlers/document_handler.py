"""通用文档 OCR 处理器

用于发票、合同等非收据/证书类文档。
"""


async def handle_document_ocr(job_id: int) -> dict:
    """处理通用文档 OCR 任务

    返回原始 OCR 文本 + 基本元信息。
    具体业务字段提取由各模块 service 层完成。
    """
    from sqlalchemy import select
    from app.db.session import SessionLocal
    from app.modules.ocr.models import OCRJob

    async with SessionLocal() as db:
        result = await db.execute(select(OCRJob).where(OCRJob.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            return {
                "text": "",
                "confidence": "low",
                "warnings": ["OCR 任务不存在"],
            }

        if not job.result_text:
            return {
                "text": "",
                "confidence": "low",
                "warnings": ["OCR 文本为空"],
            }

        return {
            "text": job.result_text,
            "confidence": "high" if len(job.result_text) > 50 else "medium",
            "status": job.status,
            "warnings": [],
        }
