"""OCR Worker Celery 入口。"""

import os

from celery import Celery

broker = os.getenv("REDIS_URL", os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"))
backend = os.getenv("CELERY_RESULT_BACKEND", broker)

app = Celery(
    "puiying_baidu_ocr_worker",
    broker=broker,
    backend=backend,
    include=["workers.ocr_worker.tasks"],
)
app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Hong_Kong",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_time_limit=300,
    task_soft_time_limit=240,
)

# 兼容旧文档和调用代码。
celery_app = app


if __name__ == "__main__":
    app.start()
