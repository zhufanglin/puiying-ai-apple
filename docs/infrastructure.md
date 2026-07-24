# 01 — Apple 子系统基础设施文档

> **文档版本**: v1.0 | **日期**: 2026-07-21 | **负责人**: 同学 1（架构师/Leader）

---

## 1. 项目概览

培英中学 AI 数智化平台 — Apple 子系统，为校务管理提供 4 大业务模块的数字化支持。

| 项目 | 说明 |
|------|------|
| 项目名称 | puiying-ai-apple |
| 版本 | v0.2（联调修复 + 演示准备） |
| 仓库 | https://github.com/zhufanglin/puiying-ai-apple |
| 团队规模 | 5 人（2 天冲刺） |
| 目标 | 可独立演示的校务管理子系统 |

---

## 2. 技术架构总览

```
┌─────────────────────────────────────────────────┐
│                    浏览器                        │
│              localhost:3000 (Next.js)            │
└───────────────────┬─────────────────────────────┘
                    │ /api/v1/*
                    ▼
┌─────────────────────────────────────────────────┐
│           FastAPI 后端 (:8001)                   │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │  A1 奖项 │ A2 财务  │ A3 资产  │ A4 学生  │  │
│  │  (异步)  │  (异步)  │  (异步)  │  (同步)  │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
│  ┌──────────────────────────────────────────┐   │
│  │         SQLAlchemy 2.0 Async             │   │
│  └──────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│     SQLite (test.db) — 开发 / 演示              │
│     计划迁移: PostgreSQL 16 (生产)              │
└─────────────────────────────────────────────────┘

OCR Worker（独立进程，演示期可选）:
┌─────────────────────────────────────────────────┐
│   Celery Worker ── Redis (队列)                 │
│   └─ PaddleOCR / 百度 OCR 引擎                 │
│   └─ AI Prompt 结构化                            │
└─────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js (Webpack) | 15.5.20 |
| 前端语言 | TypeScript + React | ^19.0 |
| CSS | Tailwind CSS | ^3.4 |
| 后端框架 | FastAPI | 0.115.6 |
| 后端语言 | Python | 3.13.14 |
| ORM | SQLAlchemy Async | 2.0.36 |
| 数据库(开发) | SQLite (aiosqlite) | 0.20.0 |
| 数据库(生产) | PostgreSQL (asyncpg) | — |
| 任务队列 | Celery + Redis | 5.4.0 |
| OCR 引擎 | PaddleOCR 3.7.0 / 百度云 | 可选 |
| PDF 生成 | fpdf2 / reportlab / docxtpl | — |
| 容器化 | Docker Compose | — |

---

## 3. 项目目录结构

```
puiying-ai-apple/
├── apps/
│   ├── api/                          # FastAPI 后端
│   │   ├── app/
│   │   │   ├── main.py               # 应用入口
│   │   │   ├── core/                 # 配置 / 安全 / 权限 / 日志
│   │   │   │   ├── config.py         # pydantic-settings 统一入口
│   │   │   │   ├── security.py       # JWT 认证 (python-jose)
│   │   │   │   ├── permissions.py    # 14 权限码 + 装饰器
│   │   │   │   └── logging.py        # 日志配置
│   │   │   ├── db/
│   │   │   │   ├── session.py        # AsyncSession 工厂
│   │   │   │   └── base.py           # ORM 基类 + TimestampMixin
│   │   │   ├── common/               # 通用 schemas / errors / 分页
│   │   │   └── modules/
│   │   │       ├── accounts/         # 用户 / 角色 / 权限模型
│   │   │       ├── files/            # 文件上传
│   │   │       ├── ocr/              # OCR 任务管理
│   │   │       ├── audit/            # 审计日志
│   │   │       ├── ai/               # AI 任务
│   │   │       └── apple/            # Apple 子系统
│   │   │           ├── awards/       # A1 奖状奖学金
│   │   │           ├── finance/      # A2 财务收支
│   │   │           ├── assets/       # A3 资产盘点
│   │   │           ├── students/     # A4 学生事务
│   │   │           └── prompts/      # 共享 AI Prompts
│   │   ├── scripts/                  # 种子数据脚本
│   │   ├── templates/apple/          # Word/PDF 模板
│   │   └── data/                     # 学生 JSON 存储（A4 专用）
│   │
│   └── web/                          # Next.js 前端
│       ├── app/(dashboard)/
│       │   └── dashboard/apple/      # Apple 总览 + 4 模块
│       ├── components/
│       │   ├── ui/                   # 11 个通用组件
│       │   └── modules/apple/        # 模块专用组件
│       └── lib/                      # api.ts / utils
│
├── workers/
│   └── ocr_worker/                   # Celery OCR Worker
│       ├── main.py                   # Celery 应用
│       ├── tasks.py                  # 任务定义
│       ├── handlers/                 # 字段提取器
│       └── services/ocr_engine.py    # OCR 引擎封装
│
├── docs/                             # 项目文档 (11+ 份)
├── docker-compose.yml                # 容器编排
├── .env                              # 环境变量
└── README.md
```

---

## 4. 数据库 ER 图

> 完整交互式 ER 图见 `ER图.html`（Mermaid 渲染，可直接在浏览器打开）。

### 4.1 底座表（6 张）

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `users` | 用户 | username, password_hash, display_name, role_id |
| `roles` | 角色 | name, display_name, description |
| `permissions` | 权限码 | code（如 `apple:awards:read`）, name, module |
| `role_permissions` | 角色-权限关联 | role_id, permission_id |
| `audit_logs` | 审计日志 | user_id, action, module, entity_type, entity_id, detail |
| `files` | 文件管理 | file_name, file_type, path, size |

### 4.2 Apple 业务表（9 张）

| 表名 | 模块 | 说明 | 关键字段 |
|------|:---:|------|---------|
| `apple_award_templates` | A1 | 奖状模板 | name, category, default_content |
| `apple_awards` | A1 | 奖状颁发记录 | name, category, amount, semester, status |
| `apple_award_recipients` | A1 | 获奖学生关联 | award_id, student_id, score, ranking |
| `apple_finance_records` | A2 | 财务收支 | type, date, project, amount, payment_method, status |
| `apple_quotations` | A2 | 报价单 | project_name, vendor, amount, is_lowest, is_selected |
| `apple_assets` | A3 | 资产 | asset_no, name, category, location, status |
| `apple_asset_movements` | A3 | 资产移动 | asset_id, from_location, to_location, reason |
| `apple_students` | A4 | 学生信息 | student_no, name_zh, name_en, class_name, status |
| `apple_attendance` | A4 | 考勤 | student_id, date, status, remarks |
| `apple_certificate_requests` | A4 | 证明申请 | student_id, certificate_type, status, purpose |

### 4.3 关联关系

```
users ──► roles (N:1)
roles ──► permissions (N:M via role_permissions)
audit_logs ──► users (N:1)
files ──► users (N:1, created_by)

apple_awards ──► award_templates (N:1)
apple_award_recipients ──► awards (N:1), students (N:1)
apple_finance_records ──► users (N:1, created_by)
apple_quotations ──► users (N:1, created_by)
apple_assets ──► users (N:1, created_by)
apple_asset_movements ──► assets (N:1)
apple_attendance ──► students (N:1)
apple_certificate_requests ──► students (N:1)
```

> **注意**: A4 学生模块（同学 4）在后端使用 SQLAlchemy ORM（`apple_students` 表），但当前实际 API 路由走**同步路由 + JSON 文件**（`apple_students_state.json`），两套数据不互通。详见 §7 架构差异说明。

---

## 5. 权限体系

### 5.1 角色（9 种）

| 角色 | 权限范围 |
|------|---------|
| `super_admin` | 全部 14 个权限码 |
| `principal` | 4 模块只读 |
| `moral_director` | A1 读写 + A4 读写（德育主任） |
| `academic_director` | A1 读写 + A4 只读（教务主任） |
| `general_director` | A2 读写 + A3 读写（总务主任） |
| `grade_leader` | A1 只读 + A4 只读（年级组长） |
| `class_teacher` | A1 只读 + A4 只读（班主任） |
| `finance_staff` | A2 读写（财务人员） |
| `asset_manager` | A3 读写（资产管理员） |

### 5.2 权限码（14 个）

| 模块 | 权限码 | 动作 |
|------|--------|------|
| A1 | `apple:awards:read` / `write` / `delete` / `approve` | CRUD + 审批 |
| A2 | `apple:finance:read` / `write` / `delete` | CRUD |
| A3 | `apple:assets:read` / `write` / `delete` / `approve` | CRUD + 审批 |
| A4 | `apple:students:read` / `write` / `delete` | CRUD |

### 5.3 鉴权流程

```
请求 → FastAPI 中间件
         │
         ├─ get_current_user: 解析 JWT，查出 User 对象
         ├─ require_permission(code): 查 Role → Permissions，验证权限码
         │
         └─ 通过 → 执行端点逻辑
            失败 → 401 UNAUTHORIZED / 403 FORBIDDEN
```

---

## 6. API 规范

### 6.1 路由格式
- 前缀：`/api/v1`
- 模块前缀：`/api/v1/apple/{module}/`
- 通用服务：`/api/v1/files/`, `/api/v1/ocr/`, `/api/v1/audit/`

### 6.2 响应格式

成功：
```json
{ "code": 0, "message": "success", "data": {...} }
```

分页：
```json
{ "code": 0, "message": "success", "data": {"items": [...], "total": 100, "page": 1, "page_size": 20, "total_pages": 5} }
```

错误：
```json
{ "code": 50001, "message": "服务器内部错误: ...", "data": null }
```

---

## 7. 架构差异说明：A4 学生模块

A4 学生事务模块与其他模块存在架构差异，原因及影响如下：

| 对比维度 | A1/A2/A3（标准） | A4 学生（当前） |
|---------|:---------------:|:-------------:|
| 路由风格 | FastAPI Async | FastAPI Sync |
| 数据存储 | SQLite (SQLAlchemy ORM) | JSON 文件 (`apple_students_state.json`) |
| 权限校验 | `get_current_user` + `require_permission` | **无**（开放访问） |
| 审计日志 | `audit_logs` 表 (ORM) | `file_store.audit()` 自定义方法 |
| 数据库依赖 | 依赖 SQLAlchemy AsyncSession | 无数据库依赖 |
| 数据持久化 | SQLite 文件，可迁移至 PG | JSON 文件，需手动备份 |

### 差异原因

A4 模块由同学 4 独立开发，采用文件存储方案以降低对底座 SQLAlchemy 的依赖，实现了快速原型。演示阶段功能等价，但存在以下风险：

1. **权限缺失**：所有学生端点对外完全开放（P0）
2. **数据不互通**：A1 的获奖学生关联依赖 `apple_students` 表，但 A4 数据在 JSON 文件
3. **一致性**：与 A1/A2/A3 的异步路由 + ORM 风格不一致

### 迁移建议（V1.1）

- 将 A4 路由改为 Async，引入 `get_db` 依赖
- 数据从 JSON 迁移至 `apple_students` 表
- 添加 `require_permission` 装饰器
- 审计日志改用 `AuditLog` ORM

---

## 8. 部署方案

### 开发环境（当前）
```bash
# 后端
cd apps/api
uvicorn app.main:app --reload --port 8001

# 前端（新终端）
cd apps/web
npm run dev
```

### Docker 部署
```bash
cp .env.example .env
# 编辑 .env 填写 DATABASE_URL 等
docker compose up -d db redis
docker compose exec api alembic upgrade head
docker compose up -d --build api worker web
```

### 免费云部署（方案 A，调研中）
- Render Web Service (Docker)：合体 Next.js + FastAPI 为一个服务
- 数据库：Render 免费 Postgres 或 SQLite（临时磁盘）
- OCR Worker：免费版暂不部署（资源限制）

---

## 9. 环境变量参考

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./test.db` | 数据库连接 |
| `REDIS_URL` | `redis://localhost:6379/0` | Celery 队列 |
| `JWT_SECRET` | `dev-secret-change-in-production` | JWT 签名密钥 |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `DEBUG` | `true` | 调试模式 |
| `UPLOAD_DIR` | `uploads` | 文件上传目录 |
| `MAX_UPLOAD_SIZE_MB` | `10` | 上传大小限制 |
| `AI_API_URL` | — | AI 服务地址（可选） |
| `AI_API_KEY` | — | AI 服务 Key（可选） |

---

*文档版本：v1.0 · 编制日期：2026-07-21 · 负责人：同学 1（架构师/Leader）*
