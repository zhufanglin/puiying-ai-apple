# 培英中学 AI 数智化平台 — Apple 子系统

培英中学校务管理数字化平台，涵盖 **奖状奖学金（A1）、财务收支（A2）、资产盘点（A3）、学生事务（A4）、成绩评语 WhatsApp（A5）** 等校务模块，集成 OCR 智能识别、DeepSeek AI 评语生成与 WhatsApp 家校推送能力。

当前 `main` 已达到演示交付状态：前端工作台、后端 API、SQLite 演示数据、成绩评语工作流、通告管理和 WhatsApp 公共客户端均已完成基础联调。

---

## 项目结构

```
puiying-ai-apple/
├── apps/
│   ├── api/              # FastAPI 后端（端口 8001）
│   │   ├── app/core/     # 配置/安全/权限
│   │   ├── app/db/       # ORM 会话/基类
│   │   └── app/modules/  # 各业务模块
│   └── web/              # Next.js 前端（端口 3000）
├── workers/
│   └── ocr_worker/       # OCR Worker
├── docs/                 # 项目文档
├── docker-compose.yml    # Docker 编排
├── .env.example          # 环境变量模板
└── README.md
```

## 快速开始（本地开发，SQLite 模式）

### 前置要求

- Python 3.12+
- Node.js 18+
- 百度 OCR API Key（可选，不配则用浏览器 Tesseract 降级）
- DeepSeek API Key（可选，仅成绩评语生成时由页面临时填写）
- WhatsApp Cloud API 配置（可选；演示可使用 mock mode）

### 1. 后端启动

```bash
cd apps/api
pip install -r requirements.txt
```

复制环境变量并填写百度 OCR Key：

```bash
cp ../../.env.example .env
# 编辑 .env，填写：
# BAIDU_OCR_API_KEY=你的Key
# BAIDU_OCR_SECRET_KEY=你的Secret
# BAIDU_OCR_ENABLED=true
```

（可选）如无百度 Key，OCR 会降级为浏览器 Tesseract.js，准确率较低，但不影响演示。

启动后端：

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

首次启动会自动创建 SQLite 数据库和表。

### 2. 导入演示数据

后端启动后，新开一个终端：

```bash
cd apps/api
python scripts/seed_demo_data.py     # 创建角色/权限/管理员 + 50名学生/100条财务/200件资产
python scripts/seed_awards_demo.py   # 创建3个奖项 + 50名获奖学生 + 3条奖学金申请
```

演示账号：`admin` / `admin123`

### 3. 前端启动

```bash
cd apps/web
npm install --legacy-peer-deps
```

创建 `.env.local`：

```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

当前前端主要通过 Next.js rewrites 代理 `/api/v1/*` 到 `http://127.0.0.1:8001/api/v1/*`，`.env.local` 保留给需要直接读取 API 地址的页面或后续部署使用。

启动：

```bash
npm run dev
```

访问 `http://localhost:3000`，用 `admin / admin123` 登录。

如果刚运行过 `npm run build` 后再切回 `npm run dev`，遇到 React/Next development 与 production bundle 不匹配的报错，停止前端服务并清理 `apps/web/.next` 后重新启动。

## 功能模块

| 模块 | 路径 | 状态 |
|------|------|------|
| Apple 总览 | `/dashboard/apple` | 已完成 |
| 奖状奖学金 | `/dashboard/apple/awards` | 已完成 |
| 财务收支 | `/dashboard/apple/finance` | 已完成，收入入库刷新与分页交互已修复 |
| 资产盘点 | `/dashboard/apple/assets` | 已完成 |
| 学生事务 | `/dashboard/apple/students` | 已完成 |
| 通告管理 | `/dashboard/apple/notifications` | 已完成，加载错误会明确提示 |
| 成绩评语 WhatsApp | `/dashboard/apple/scores` | 已完成：导入、统计、AI 评语审阅、确认、推送入口 |

## 演示账号

| 用户 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 超级管理员（全部权限） |
| wendy | demo123 | 德育主任（奖状+学生） |
| tommy | demo123 | 总务主任（财务+资产） |
| steven | demo123 | 财务人员 |
| danielle | demo123 | 资产管理员 |

## OCR 识别说明

OCR 使用三级降级策略，无需额外配置即可演示：

| 引擎 | 说明 | 本地 Windows | 部署 Linux |
|------|------|-------------|-----------|
| PaddleOCR | 本地高性能引擎 | 不可用（Segfault） | ✅ 正常 |
| 百度 OCR | HTTP API（配 Key） | ✅ 首选 | ✅ 备选 |
| Tesseract.js | 浏览器离线 | ✅ 兜底 | ✅ 兜底 |

有百度 Key 时自动启用，无 Key 时走 Tesseract.js，不影响基础流程演示。

## 成绩评语与 WhatsApp

成绩评语模块支持 `.xlsx` 长表/宽表导入、班级统计、科目平均、分数段、排名、DeepSeek 生成繁体中文评语、教师审阅确认，以及 WhatsApp 推送状态追踪。

关键安全约束：

- DeepSeek Key 只通过单次请求头传入，不落库、不写日志。
- WhatsApp Token 通过后端环境变量配置，前端不保存 Token。
- 真实发送前配置 `WHATSAPP_PHONE_NUMBER_ID`、`WHATSAPP_ACCESS_TOKEN`；演示环境可使用 mock mode。

## 验证结果

最新收口日期：2026-07-24。

| 检查项 | 结果 |
|------|------|
| 前端构建 | `npm run build` 通过 |
| 成绩模块单元测试 | 11 个通过 |
| WhatsAppClient 单元测试 | 6 个通过 |
| OpenAPI | 已重新生成，包含 9 个 `/api/v1/apple/scores/*` 接口 |
| 浏览器验收 | 通告页、成绩页可打开；成绩页 Tab 正常；通告页数据加载正常 |

完整结果见 `docs/testing-report.md` 和 `docs/acceptance-checklist.md`。

## 文档索引

| 文档 | 说明 |
|------|------|
| docs/deployment-guide.md | 部署指南（Docker + 本地） |
| docs/module-awards.md | 奖状奖学金模块 |
| docs/module-finance-assets.md | 财务 + 资产模块 |
| docs/module-students-ai.md | 学生事务 + AI Prompt |
| docs/08-module-scores.md | 成绩分析 + AI 评语 + WhatsApp 推送 |
| docs/ocr-worker.md | OCR Worker 文档 |
| docs/demo-guide.md | 演示手册 |
| docs/testing-report.md | 测试报告 |
| docs/acceptance-checklist.md | 验收清单 |
| docs/code-review-report.md | Leader 代码评审报告 |
| docs/openapi.json | OpenAPI 接口文档 |

---

*Copyright © 2026 培英中学 · AI 数智化平台 · Apple 子系统*
