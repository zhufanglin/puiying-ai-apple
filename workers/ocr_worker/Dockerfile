FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt /tmp/api-requirements.txt
COPY workers/ocr_worker/requirements.txt /tmp/worker-requirements.txt
RUN pip install --no-cache-dir \
    -r /tmp/api-requirements.txt \
    -r /tmp/worker-requirements.txt

COPY apps/api/app /app/app
COPY workers /app/workers
RUN mkdir -p /app/uploads

ENV PYTHONPATH=/app

CMD ["celery", "-A", "workers.ocr_worker.main:app", "worker", "--loglevel=info", "--concurrency=2"]
