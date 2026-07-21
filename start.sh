#!/bin/bash
# Render 启动脚本 — 同时启动 FastAPI + Next.js + 反向代理

set -e

echo "=== Apple 子系统 Render 部署 ==="

# 设置默认值
export PORT="${PORT:-10000}"
export API_PORT="${API_PORT:-8001}"
export WEB_PORT="${WEB_PORT:-3000}"
export DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:///./test.db}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export JWT_SECRET="${JWT_SECRET:-render-prod-secret-change-me}"
export DEBUG="${DEBUG:-false}"

# 初始化数据库
cd /app/apps/api
python -c "
import asyncio
from app.db.session import engine, Base
from app.modules.accounts.models import *
from app.modules.apple.awards.models import *
from app.modules.apple.finance.models import *
from app.modules.apple.assets.models import *
from app.modules.apple.students.models import *
from app.modules.files.models import *
from app.modules.audit.models import *
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
asyncio.run(init())
print('数据库表就绪')
"

# 种子数据（幂等，仅首次运行）
python scripts/seed_demo_data.py 2>/dev/null || echo "种子数据跳过（可能已存在）"

# 启动 FastAPI 后端（后台）
echo "启动 FastAPI :${API_PORT}"
uvicorn app.main:app --host 127.0.0.1 --port "${API_PORT}" &

# 启动 Next.js 前端（后台）
echo "启动 Next.js :${WEB_PORT}"
cd /app/apps/web
node node_modules/.bin/next start --port "${WEB_PORT}" &

# 等待两个服务就绪
echo "等待服务就绪..."
for i in $(seq 1 30); do
  if curl -s "http://127.0.0.1:${API_PORT}/api/v1/health" > /dev/null 2>&1; then
    echo "  API 就绪"
    break
  fi
  sleep 1
done
for i in $(seq 1 30); do
  if curl -s "http://127.0.0.1:${WEB_PORT}" > /dev/null 2>&1; then
    echo "  Web 就绪"
    break
  fi
  sleep 1
done

# 启动反向代理（前台，主进程）
echo "启动反向代理 :${PORT}"
cd /app
exec python server.py
