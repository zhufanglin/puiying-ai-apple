# Apple 子系统部署指南

> **文档版本**: v2.0 | **更新日期**: 2026-07-23

---

## 1. 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Python | 3.12+ | 后端运行环境 |
| Node.js | 18+ | 前端构建环境 |
| Docker | 24+ | （可选）容器运行 |

## 2. 本地开发部署（推荐，SQLite 模式）

### 2.1 后端

```bash
cd apps/api

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（复制模板并填写百度 OCR Key）
cp ../../.env.example .env
```

编辑 `.env`，关键配置：

```
DATABASE_URL=sqlite+aiosqlite:///./test.db
BAIDU_OCR_ENABLED=true
BAIDU_OCR_API_KEY=你的百度OCR API Key
BAIDU_OCR_SECRET_KEY=你的百度OCR Secret Key
```

启动后端（首次启动会自动创建数据库表）：

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### 2.2 导入演示数据

后端启动后，新开终端执行：

```bash
cd apps/api
python scripts/seed_demo_data.py     # 角色/权限/管理员 + 50学生 + 100财务 + 200资产
python scripts/seed_awards_demo.py   # 3个奖项 + 50获奖学生 + 3条奖学金
```

演示账号：`admin` / `admin123`

### 2.3 前端

```bash
cd apps/web

# 安装依赖
npm install --legacy-peer-deps

# 配置后端地址
echo "NEXT_PUBLIC_API_URL=http://localhost:8001" > .env.local

# 启动
npm run dev
```

访问 http://localhost:3000

## 3. Docker Compose 部署

### 3.1 准备

```bash
git clone <repo-url> && cd puiying-ai-apple
cp .env.example .env
# 编辑 .env 填写 DATABASE_URL（PostgreSQL）、百度 OCR Key 等
```

### 3.2 启动

```bash
docker compose up -d db redis
docker compose up -d --build api
docker compose exec api alembic upgrade head
docker compose exec api python scripts/seed_demo_data.py
docker compose exec api python scripts/seed_awards_demo.py
docker compose up -d --build worker
docker compose up -d --build web
```

### 3.3 访问服务

| 服务 | 地址 |
|------|------|
| 前端页面 | http://localhost:3000 |
| API 文档 | http://localhost:8001/docs |
| API 健康检查 | http://localhost:8001/api/v1/health |

## 4. OCR 配置说明

OCR 使用三级降级策略：

| 引擎 | 依赖 | 优先级 | 本地 Windows | Linux 部署 |
|------|------|--------|-------------|-----------|
| PaddleOCR | paddleocr / paddlepaddle | 1（最高） | 不可用（Segfault） | ✅ 正常 |
| 百度 OCR | API Key + Secret Key | 2 | ✅ 推荐 | ✅ 备选 |
| Tesseract.js | 无（浏览器本地） | 3（兜底） | ✅ | ✅ |

无百度 Key 时也不影响演示，OCR 会降级为 Tesseract.js（浏览器离线识别），准确率较低但流程完整。

## 5. 演示账号

| 用户 | 密码 | 角色 | 权限范围 |
|------|------|------|---------|
| admin | admin123 | 超级管理员 | 全部 |
| wendy | demo123 | 德育主任 | 奖状+学生 |
| tommy | demo123 | 总务主任 | 财务+资产 |
| steven | demo123 | 财务人员 | 财务 |
| danielle | demo123 | 资产管理员 | 资产 |

## 6. 常见问题

| 问题 | 解决方法 |
|------|---------|
| 后端启动报端口占用 | `pkill -f uvicorn` 或换端口 |
| 前端连不上后端 | 检查 `.env.local` 中 NEXT_PUBLIC_API_URL 是否为 http://localhost:8001 |
| 数据库表缺失 | 首次启动后端会自动建表，或手动执行建表脚本 |
| 百度 OCR 返回空 | 检查 `.env` 中 AK/SK 是否正确，BAIDU_OCR_ENABLED=true |
| PaddleOCR segfault | Windows 上已知问题，不影响演示（自动降级百度/Tesseract） |

---

*文档版本: v2.0 · 更新日期: 2026-07-23*
