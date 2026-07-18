FROM python:3.12-slim

WORKDIR /app

# 系统依赖（OCR 需要 libgomp1 等）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libgomp1 && \
    rm -rf /var/lib/apt/lists/*

# Python 依赖（与 API 共用 requirements.txt）
COPY ../api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Worker 代码
COPY . .

# 创建上传目录
RUN mkdir -p uploads

CMD ["celery", "-A", "main", "worker", "--loglevel=info", "--concurrency=2"]
