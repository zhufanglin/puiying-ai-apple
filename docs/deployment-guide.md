# Apple 子系统部署指南

> **文档版本**: v1.0 | **日期**: 2026-07-19

---

## 1. 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Docker | 24+ | 容器运行环境 |
| Docker Compose | 2.0+ | 多容器编排 |
| Python | 3.12+ | 后端运行环境 |
| Node.js | 18+ | 前端构建环境 |

## 2. Docker Compose 部署

### 2.1 准备环境

`ash
# 克隆仓库
git clone <repo-url> && cd puiying-ai-apple

# 复制环境变量
cp .env.example .env

# 编辑 .env 填写必要配置
# DATABASE_URL=postgresql+asyncpg://puiying:puiying_dev@localhost:5432/puiying_apple
# BAIDU_OCR_API_KEY=your_key
# BAIDU_OCR_SECRET_KEY=your_secret
`

### 2.2 启动全部服务

`ash
# 启动数据库和 Redis
docker compose up -d db redis

# 构建并启动 API
docker compose up -d --build api

# 执行数据库迁移
docker compose exec api alembic upgrade head

# 导入演示数据（可选）
docker compose exec api python scripts/seed_demo_data.py

# 启动 OCR Worker
docker compose up -d --build worker

# 启动前端
docker compose up -d --build web
`

### 2.3 访问服务

| 服务 | 地址 |
|------|------|
| 前端页面 | http://localhost:3000 |
| API 文档（Swagger） | http://localhost:8000/docs |
| API 健康检查 | http://localhost:8000/api/v1/health |

### 2.4 单服务重启

`ash
docker compose restart api
docker compose restart web
docker compose restart worker
`

## 3. 本地开发部署（无 Docker）

### 3.1 后端

`ash
cd apps/api

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
# Windows (PowerShell)
="sqlite+aiosqlite:///./test.db"

# 创建数据库表
python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.db.base import Base
async def init():
    engine = create_async_engine('sqlite+aiosqlite:///./test.db')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
asyncio.run(init())
"

# 导入演示数据
python scripts/seed_demo_data.py

# 启动开发服务器
uvicorn app.main:app --reload --port 8000
`

### 3.2 前端

`ash
cd apps/web

# 安装依赖
npm install --legacy-peer-deps

# 配置 API 地址（默认 http://localhost:8000）
# 编辑 .env.local 或设置环境变量
# NEXT_PUBLIC_API_URL=http://localhost:8000

# 启动开发服务器
npm run dev
`

## 4. 演示数据

执行种子脚本后会创建：

- **9 个角色**: super_admin, principal, moral_director, academic_director, general_director, grade_leader, class_teacher, finance_staff, asset_manager
- **14 个权限**: 覆盖 awards/finance/assets/students 的 read/write/approve
- **1 个管理员账号**: admin / admin123（super_admin 角色）
- **5 个演示账号**: wendy, tommy, steven, danielle, leung（密码 demo123）

## 5. 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| DATABASE_URL | postgresql://... | 数据库连接（可用 sqlite 本地开发） |
| REDIS_URL | redis://localhost:6379/0 | Redis 连接 |
| JWT_SECRET | dev-secret... | JWT 签名密钥 |
| JWT_ALGORITHM | HS256 | JWT 算法 |
| DEBUG | true | 调试模式 |
| UPLOAD_DIR | uploads | 文件上传目录 |
| MAX_UPLOAD_SIZE_MB | 10 | 上传文件大小限制 |
| BAIDU_OCR_API_KEY | — | 百度 OCR API Key |
| BAIDU_OCR_SECRET_KEY | — | 百度 OCR Secret Key |

## 6. 常见问题

| 问题 | 解决方法 |
|------|---------|
| API 启动后登录 500 | 检查 DATABASE_URL 是否正确，确保已执行迁移 |
| 前端无法连接 API | 检查 NEXT_PUBLIC_API_URL 是否正确 |
| 百度 OCR 返回空 | 检查 AK/SK 是否正确配置 |
| alembic 迁移失败 | 数据库 URL 不支持 RETURNING → 改用 SQLite 或 PostgreSQL |
| 端口被占用 | 修改 docker-compose.yml 中的端口映射 |

---

*文档版本: v1.0 · 编制日期: 2026-07-19*
