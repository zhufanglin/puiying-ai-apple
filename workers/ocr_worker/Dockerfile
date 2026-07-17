FROM python:3.12-slim

WORKDIR /workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-chi-tra \
    && rm -rf /var/lib/apt/lists/*

COPY workers/ocr_worker/requirements.txt /tmp/ocr-requirements.txt
RUN pip install --no-cache-dir -r /tmp/ocr-requirements.txt

COPY workers /workspace/workers
COPY apps/api/app/modules/apple/prompts /workspace/apps/api/app/modules/apple/prompts

ENV PYTHONPATH=/workspace
ENV APPLE_STUDENTS_DATA_DIR=/app/data
ENV OCR_ENGINE=auto

CMD ["celery", "-A", "workers.ocr_worker.main.celery_app", "worker", "--loglevel=INFO", "--concurrency=2"]
