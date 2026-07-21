"""API 侧 Celery 发送器；不导入 Worker 源码。"""

from celery import Celery

from app.core.config import get_settings


def enqueue_ocr_job(job_id: int) -> str:
    settings = get_settings()
    client = Celery("ocr_api_client", broker=settings.REDIS_URL)
    task = client.send_task("ocr.process", args=[job_id])
    return task.id
