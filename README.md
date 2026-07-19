# 培英中学 AI 数智化平台 — Apple 子系统

培英中学校务管理数字化平台，涵盖**奖状奖学金 (A1)、财务收支 (A2)、资产盘点 (A3)、学生事务 (A4)** 四大模块，集成百度 OCR 智能识别与 DeepSeek AI 结构化能力。

---

## 模块一览

| 模块 | 说明 | API 前缀 | 负责人 |
|------|------|---------|--------|
| **A1 奖状奖学金** | 奖状模板管理/颁发/审核、奖学金申请审批 | /api/v1/apple/awards | 同学 2 |
| **A2 财务收支** | 收入/支出记录、收据 OCR、报价单分析、地址标签 | /api/v1/apple/finance | 同学 3 |
| **A3 资产盘点** | 资产登记/移动/注销、盘点报告、发票 OCR | /api/v1/apple/assets | 同学 3 |
| **A4 学生事务** | 学生档案、考勤导入、在学证明、成绩导出 | /api/v1/apple/students | 同学 4 |

---

## 技术栈

- **后端**: Python 3.12 + FastAPI + SQLAlchemy 2.0 Async + Celery
- **前端**: Next.js 15 + TypeScript + Tailwind CSS
- **数据库**: PostgreSQL 16（开发可用 SQLite）
- **缓存/队列**: Redis 7
- **OCR**: 百度智能云 OCR（主引擎）+ Tesseract.js（浏览器回退）
- **AI 结构化**: DeepSeek（用户自备 Key）
- **容器化**: Docker Compose

---

## 快速开始

### Docker 部署

`ash
cp .env.example .env
# 编辑 .env 填写百度 OCR Key、数据库地址等

docker compose up -d db redis
docker compose up -d --build api worker
docker compose exec api alembic upgrade head
docker compose up -d --build web
`

### 本地开发（SQLite）

`ash
# 后端
cd apps/api
pip install -r requirements.txt
="sqlite+aiosqlite:///./test.db"
uvicorn app.main:app --reload --port 8000

# 前端（新终端）
cd apps/web
npm install --legacy-peer-deps
npm run dev
`

---

## 项目结构

`
├── apps/
│   ├── api/              # FastAPI 后端
│   │   ├── app/core/     # 配置/安全/权限
│   │   ├── app/db/       # ORM 会话/基类
│   │   └── app/modules/  # 各业务模块
│   └── web/              # Next.js 前端
├── workers/
│   └── ocr_worker/       # Celery OCR Worker
├── docs/                 # 项目文档
└── docker-compose.yml
`

---

## 演示账号

| 用户 | 密码 | 角色 | 权限 |
|------|------|------|------|
| admin | admin123 | 超级管理员 | 全部 |
| wendy | demo123 | 德育主任 | 奖状+学生 |
| tommy | demo123 | 总务主任 | 财务+资产 |
| steven | demo123 | 财务人员 | 财务 |
| danielle | demo123 | 资产管理员 | 资产 |

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/apple-system-overview.md](docs/apple-system-overview.md) | 子系统总览（架构/技术栈/约定） |
| [docs/module-awards.md](docs/module-awards.md) | A1 奖状奖学金模块 |
| [docs/module-finance-assets.md](docs/module-finance-assets.md) | A2 财务收支模块 |
| [docs/module-assets.md](docs/module-assets.md) | A3 资产盘点模块 |
| [docs/module-students-ai.md](docs/module-students-ai.md) | A4 学生事务 + AI Prompt |
| [docs/ocr-worker.md](docs/ocr-worker.md) | OCR Worker 技术文档 |
| [docs/deployment-guide.md](docs/deployment-guide.md) | 部署指南 |
| [docs/testing-report.md](docs/testing-report.md) | 测试报告 |
| [docs/demo-guide.md](docs/demo-guide.md) | 演示手册 |
| [docs/acceptance-checklist.md](docs/acceptance-checklist.md) | 验收清单 |

---

## 开发规范

- **Commit 格式**: [模块] 动作：描述（如 [awards] feat: add certificate template）
- **API 规范**: RESTful，统一返回 { code, data, message }
- **权限**: @require_permission("apple:awards:read")
- **审计**: 关键操作写入 udit_logs 表
- **PR**: 至少 1 位 reviewer 通过

---

*Copyright © 2026 培英中学 · AI 数智化平台 · Apple 子系统*
