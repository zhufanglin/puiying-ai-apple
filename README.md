# 培英中学 AI 数智化平台 — Apple 子系统

培英中学校务管理数字化平台，涵盖 **奖状奖学金（A1）、财务收支（A2）、资产盘点（A3）、学生事务（A4）** 四大模块，集成百度 OCR 智能识别与 DeepSeek AI 结构化能力。

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

启动：

```bash
npm run dev
```

访问 `http://localhost:3000`，用 `admin / admin123` 登录。

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

## 文档索引

| 文档 | 说明 |
|------|------|
| docs/deployment-guide.md | 部署指南（Docker + 本地） |
| docs/module-awards.md | 奖状奖学金模块 |
| docs/module-finance-assets.md | 财务 + 资产模块 |
| docs/module-students-ai.md | 学生事务 + AI Prompt |
| docs/ocr-worker.md | OCR Worker 文档 |
| docs/demo-guide.md | 演示手册 |
| docs/testing-report.md | 测试报告 |

---

*Copyright © 2026 培英中学 · AI 数智化平台 · Apple 子系统*
