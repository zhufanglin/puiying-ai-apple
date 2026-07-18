"""OCR Worker — Celery 入口

启动命令:
    celery -A workers.ocr_worker.main worker --loglevel=info --concurrency=2

文档路径: workers/ocr_worker/main.py
"""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

# 创建 Celery 应用
app = Celery(
    "ocr_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "workers.ocr_worker.tasks",
    ],
)

# 可选配置
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Hong_Kong",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,       # 单个任务最大 5 分钟
    task_soft_time_limit=240,  # 软限制 4 分钟
    worker_prefetch_multiplier=1,  # 每次只取一个任务（OCR 是 CPU 密集型）
)

if __name__ == "__main__":
    app.start()
