# Apple 子系统总览

> **文档版本**: v1.0 | **日期**: 2026-07-19 | **负责人**: 同学 5（汇总）

---

## 1. 系统概述

培英中学 AI 数智化平台 —— **Apple 子系统**，面向校务行政人员提供四大业务模块的数字化管理能力，涵盖**奖状奖学金、财务收支、资产盘点、学生事务**，并通过 **OCR Worker + AI 结构化**实现票据与文档的智能识别。

### 1.1 设计目标

| 目标 | 说明 |
|------|------|
| 去纸化 | 收据、发票、报价单拍照上传 → OCR 识别 → 自动入账 |
| 自动化 | 奖状批量生成、考勤 Excel 批量导入、证明文件一键生成 |
| 可追溯 | 所有关键操作写入审计日志，审批流完整记录 |
| 可演示 | 2 天冲刺完成可独立演示版本，含 mock 数据与前端页面 |

### 1.2 核心数据流

`
用户操作（前端）
    ↓
Next.js (apps/web) → REST API
    ↓
FastAPI (apps/api) → SQLAlchemy Async ORM
    ↓
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  A1 奖状奖学金 │  A2 财务收支  │  A3 资产盘点  │  A4 学生事务  │
│  apple/awards │ apple/finance│ apple/assets │ apple/students│
├──────────────┼──────────────┼──────────────┼──────────────┤
│ 奖状模板      │ 收入/支出     │ 资产登记     │ 学生档案      │
│ 奖状颁发      │ 收据 OCR     │ 资产移动     │ 考勤导入      │
│ 奖学金申请    │ 报价单分析    │ 资产注销     │ 证明生成      │
│ 审批流        │ 地址标签      │ 盘点报告     │ 成绩导出      │
└──────────────┴──────────────┴──────────────┴──────────────┘
    ↓
Celery Worker (workers/ocr_worker) → 百度 OCR API
    ↓
PostgreSQL 16（开发环境 SQLite）
`

---

## 2. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | FastAPI | 0.115+ |
| ORM | SQLAlchemy 2.0 Async | 2.0.36 |
| 数据库 | PostgreSQL 16 / SQLite | — |
| 队列 | Celery + Redis | 5.4.0 / 7 |
| OCR 引擎 | 百度智能云 OCR | — |
| AI 结构化 | DeepSeek（用户自备 Key） | — |
| 前端 | Next.js 15 + TypeScript | 15.x |
| UI | Tailwind CSS | — |
| 容器化 | Docker Compose | — |

---

## 3. 项目结构

`
puiying-ai-apple/
├── apps/
│   ├── api/                  # FastAPI 后端
│   │   ├── app/
│   │   │   ├── core/         # 配置、安全、权限、日志
│   │   │   ├── db/           # 数据库会话、基类
│   │   │   ├── common/       # 通用 Schema、错误码、分页
│   │   │   └── modules/
│   │   │       ├── accounts/ # 用户/角色/权限
│   │   │       ├── files/    # 文件上传管理
│   │   │       ├── ocr/      # OCR 任务 + AI 结构化
│   │   │       ├── audit/    # 审计日志
│   │   │       ├── approvals/# 审批记录
│   │   │       ├── ai/       # AI 任务
│   │   │       └── apple/
│   │   │           ├── awards/    # A1 奖状奖学金
│   │   │           ├── finance/   # A2 财务收支
│   │   │           ├── assets/    # A3 资产盘点
│   │   │           ├── students/  # A4 学生事务
│   │   │           └── prompts/   # AI Prompt 文件
│   │   ├── alembic/         # 数据库迁移
│   │   └── scripts/         # 种子数据脚本
│   └── web/                 # Next.js 前端
│       ├── app/             # Next.js App Router 页面
│       ├── components/      # UI + 业务组件
│       └── lib/             # API 客户端、工具函数
├── workers/
│   └── ocr_worker/          # Celery OCR Worker
│       ├── handlers/        # 各类型文档处理
│       ├── services/        # 百度 OCR 引擎
│       └── tests/           # Worker 测试
├── docs/                    # 项目文档
└── README.md
`

---

## 4. 模块依赖关系

`
A1 奖状奖学金 ──────┬──── 权限系统 (accounts)
A2 财务收支 ────────┤
A3 资产盘点 ────────┤
A4 学生事务 ────────┤
                   │
OCR Worker ─────────┴──── 文件服务 (files)
                             │
                        AI 结构化 (ocr)
`

- 四个业务模块**互不依赖**，各自独立 Router → Service → Repository
- OCR Worker 通过 Redis 队列异步处理，不阻塞 API
- AI 结构化（DeepSeek）由前端触发独立 API，非 Worker 内部步骤

---

## 5. 统一约定

### 5.1 API 规范

- 前缀：/api/v1
- 统一返回格式：{ code: int, message: string, data: T }
- 分页返回：{ code: 0, message: "ok", data: { items: [], total, page, page_size, total_pages } }

### 5.2 权限体系

- 格式：{module}:{resource}:{action}（如 pple:awards:read）
- 装饰器：@require_permission("apple:awards:read")
- 预置角色：super_admin / principal / moral_director / academic_director / general_director / grade_leader / class_teacher / finance_staff / asset_manager

### 5.3 错误码

| 范围 | 说明 |
|------|------|
| 10001-10099 | 认证授权 |
| 20001-20099 | 资源不存在 |
| 30001-30099 | 参数校验 |
| 40001-40099 | 业务逻辑 |
| 50001-50099 | 服务器内部 |

### 5.4 审计日志

关键操作（增/删/改/审批）写入 udit_logs 表，记录 user_id、action、module、entity_type、entity_id。

### 5.5 数据库

- 开发/演示：SQLite（sqlite+aiosqlite:///./test.db）
- 生产：PostgreSQL 16（通过 DATABASE_URL 环境变量切换）
- 迁移工具：Alembic

---

## 6. 快速启动

`ash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填写 DATABASE_URL、百度 OCR AK/SK

# 2. 启动数据库和 Redis
docker compose up -d db redis

# 3. 构建并启动 API + Worker
docker compose up -d --build api worker

# 4. 执行数据库迁移
docker compose exec api alembic upgrade head

# 5. 启动前端
docker compose up -d --build web

# 6. 访问
# 前端: http://localhost:3000
# API 文档: http://localhost:8000/docs
`

---

## 7. 演示账号

| 用户名 | 密码 | 角色 | 权限范围 |
|--------|------|------|---------|
| admin | admin123 | super_admin | 全部 |
| wendy | demo123 | moral_director | 奖状 + 学生 |
| tommy | demo123 | general_director | 财务 + 资产 |
| steven | demo123 | finance_staff | 财务只读/写入 |
| danielle | demo123 | asset_manager | 资产只读/写入 |

---

## 8. 相关文档

| 文档 | 说明 |
|------|------|
| [module-awards.md](module-awards.md) | A1 奖状奖学金模块 |
| [module-finance-assets.md](module-finance-assets.md) | A2 财务收支模块 |
| [module-assets.md](module-assets.md) | A3 资产盘点模块 |
| [module-students-ai.md](module-students-ai.md) | A4 学生事务 + AI Prompt |
| [ocr-worker.md](ocr-worker.md) | OCR Worker 技术文档 |
| [deployment-guide.md](deployment-guide.md) | 部署指南 |
| [testing-report.md](testing-report.md) | 测试报告 |
| [demo-guide.md](demo-guide.md) | 演示手册 |
| [acceptance-checklist.md](acceptance-checklist.md) | 验收清单 |

---

*文档版本: v1.0 · 编制日期: 2026-07-19 · 适用范围: 培英中学 AI 数智化平台 Apple 子系统*
