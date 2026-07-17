# puiying-ai-apple

培英中学 AI 数智化平台 — Apple 子系统

## 模块

| 模块 | 说明 |
|------|------|
| A1 奖状奖学金 | 奖状模板管理、生成、审批 |
| A2 财务收支 | 收支记录、票据 OCR、分类统计 |
| A3 资产盘点 | 资产登记、盘点、折旧、报废 |
| A4 学生事务 | 学生档案、照片、考勤导入、成绩导出、证明申请 |

## 技术栈

- **后端**: Python 3.12 + FastAPI + SQLAlchemy + Celery
- **前端**: Next.js 15 + TypeScript + Tailwind CSS
- **数据库**: PostgreSQL 16
- **缓存/队列**: Redis 7
- **OCR**: 百度 OCR / PaddleOCR / Tesseract
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

## A4 学生事务、AI Prompt 与 OCR Worker

同学 4 只负责以下目录及其最小集成点：

```text
apps/api/app/modules/apple/students/       # 学生 CRUD、考勤、照片、成绩、证明及测试
apps/api/app/modules/apple/prompts/        # 4 个严格 JSON AI Prompt
apps/api/alembic/versions/20260717_01_add_students.py # A4 三表迁移
apps/api/data/apple_students_state.json    # A4 开发期模拟数据，不含真实学生资料
apps/api/templates/apple/                  # 在学证明模板及重建脚本
apps/web/app/(dashboard)/dashboard/apple/students/ # 学生总览及详情页
apps/web/lib/students-api.ts               # 仅包含学生页面实际调用的 API
apps/web/public/apple_attendance_import_test.xlsx # 跨学生考勤测试表
workers/ocr_worker/                        # Celery OCR Worker 与百度 OCR 适配器
docs/05-module-students-ai.md              # 学生事务与 Prompt 文档
docs/06-ocr-worker.md                      # OCR Worker 部署及测试文档
docs/07-student4-submission-checklist.md   # 同学 4 提交清单
```

学生 API 根路径为 `/api/v1/apple/students`。当前开发数据由 A4 专用 JSON 文件模拟；`Student`、`Attendance`、`CertificateRequest` 三张 PostgreSQL 表及 Alembic 迁移同时保留，后续可替换仓储而无需改变页面契约。

### A4 验证

```bash
cd apps/api
python -m unittest discover -s app/modules/apple/students/tests -p "test_*.py" -v

cd ../..
python -m unittest discover -s workers/ocr_worker/tests -p "test_*.py" -v

cd apps/web
npm run build
```

百度 OCR 真实测试所需的 `BAIDU_OCR_API_KEY` 与 `BAIDU_OCR_SECRET_KEY` 只能写入本机 `.env` 或服务器密钥管理，不得提交。详细命令见 `docs/06-ocr-worker.md`。

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
