# puiying-ai-apple

培英中学 AI 数智化平台 — Apple 子系统

## 模块

| 模块 | 说明 |
|------|------|
| A1 奖状奖学金 | 奖状模板管理、生成、审批 |
| A2 财务收支 | 收支记录、票据 OCR、分类统计 |
| A3 资产盘点 | 资产登记、盘点、折旧、报废 |
| A4 学生事务 | 学生档案、在校证明、请假管理 |

## 技术栈

- **后端**: Python 3.12 + FastAPI + SQLAlchemy + Celery
- **前端**: Next.js 15 + TypeScript + Tailwind CSS
- **数据库**: PostgreSQL 16
- **缓存/队列**: Redis 7
- **OCR**: PaddleOCR
- **容器化**: Docker Compose

## 快速启动

```bash
# 1. 启动所有服务
docker-compose up -d

# 2. 运行数据库迁移
docker-compose exec api alembic upgrade head

# 3. 导入演示数据
docker-compose exec api python scripts/seed_demo_data.py

# 4. 访问
# 前端: http://localhost:3000
# API 文档: http://localhost:8000/docs
```

## 项目结构

```
├── apps/
│   ├── api/          # FastAPI 后端
│   └── web/          # Next.js 前端
├── workers/
│   └── ocr_worker/   # Celery OCR Worker
├── docs/             # 项目文档
├── docker-compose.yml
└── README.md
```

## 开发规范

- Commit: `[模块] 动作：描述` (如 `[awards] feat: add certificate template`)
- PR: 至少 1 位 reviewer 通过
- API: RESTful，统一返回 `{ code, data, message }`
- 权限: `@require_permission("apple:awards:read")`
