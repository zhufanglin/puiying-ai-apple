# API 设计规范

> Apple 子系统统一接口规范 — 架构师/Leader 定稿

## 1. 基础约定

| 项目 | 值 |
|------|-----|
| API 前缀 | `/api/v1` |
| 请求格式 | `application/json`（文件上传除外） |
| 响应格式 | `{"code": 0, "message": "ok", "data": {...}}` |
| 认证方式 | `Authorization: Bearer <JWT token>` |
| 状态码 | HTTP 200 + code 字段区分业务状态 |

## 2. 响应结构

```json
{
  "code": 0,
  "message": "ok",
  "data": { }
}
```

### 业务码

| code | 含义 |
|------|------|
| 0 | 成功 |
| 10001-10100 | 参数校验错误 |
| 20001-20100 | 鉴权错误 |
| 30001-30100 | 业务错误（如重复、状态不符） |
| 50001 | 服务器内部错误 |

## 3. 认证流程

```
POST /api/v1/auth/login
Body: { "username": "admin", "password": "..." }
→ { "code": 0, "data": { "access_token": "eyJ...", "role": "super_admin" } }
```

后续请求携带 `Authorization: Bearer <access_token>`。

## 4. 已注册 API 路由

| 前缀 | 模块 | 标签 | 负责 |
|------|------|------|------|
| `/api/v1/auth` | 认证 | Auth | Leader |
| `/api/v1/files` | 文件管理 | Files | Leader |
| `/api/v1/ocr` | OCR 任务 + 识别 | OCR | 同学4 |
| `/api/v1/apple/awards` | 奖状奖学金 | Apple | 同学2 |
| `/api/v1/apple/finance` | 财务收支 | Apple | 同学3 |
| `/api/v1/apple/assets` | 资产盘点 | Apple | 同学3 |
| `/api/v1/apple/students` | 学生事务 | Apple | 同学4 |

## 5. 关键端点

### 5.1 OCR（本地 PaddleOCR）

```
POST /api/v1/ocr/recognize
Content-Type: multipart/form-data
Body: file=<图片>

→ {"text":"...", "confidence":0.956, "engine":"paddleocr", "lines":[...]}
```

无需 API Key，本地引擎。

### 5.2 OCR（AI 结构化）

```
POST /api/v1/ocr/receipt/structure
Header: X-AI-API-Key: <DeepSeek Key>
Body: { "provider":"deepseek", "model":"deepseek-v4-flash", "ocr_text":"...", ... }

→ { "fields": { "amount":115, "currency":"CNY", ... }, "confidence":"high" }
```

### 5.3 财务收入

```
GET    /api/v1/apple/finance/income      → 收入列表
POST   /api/v1/apple/finance/income      → 新增收入
GET    /api/v1/apple/finance/income/:id  → 收入详情
```

### 5.4 资产

```
GET    /api/v1/apple/assets              → 资产列表
POST   /api/v1/apple/assets              → 登记入库
PUT    /api/v1/apple/assets/:id/move     → 搬移记录
POST   /api/v1/apple/assets/:id/writeoff → 申请注销
```

## 6. 权限控制

通过 `role_id` + `role_permissions` 表控制。各模块 `permissions.py` 定义权限码，后端 `Depends(get_current_user)` 注入当前用户。

```python
# 权限示例
apple:awards:read    # 查看奖状
apple:awards:write   # 创建/编辑奖状
apple:finance:read   # 查看财务
apple:finance:write  # 新增收支
```

## 7. 命名约定

| 层 | 文件名 | 职责 |
|----|--------|------|
| 路由 | `router.py` | 定义端点、参数校验、调用 service |
| 数据模型 | `models.py` | SQLAlchemy 表定义 |
| 校验 | `schemas.py` | Pydantic 请求/响应模型 |
| 业务 | `service.py` | 核心业务逻辑 |
| 仓库 | `repository.py` | 数据库读写封装 |
| 权限 | `permissions.py` | 模块级权限定义 |
| 测试 | `tests/test_<module>.py` | pytest 用例 |
