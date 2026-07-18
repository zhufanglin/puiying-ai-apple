# OCR Worker 技术文档（百度 OCR）

## 1. 模块目标

OCR 链路用于财务收据、资产发票、奖状证书和普通文档识别。主引擎为百度智能云 OCR；浏览器端 Tesseract.js 仅在 API、Redis、Worker 或百度服务不可用时自动回退。

财务收据可在 OCR 后优先调用 `receipt_extract_zh_hk.md` 和用户选择的 DeepSeek 模型做语义结构化，以解决“文字识别正确但字段映射错误”的问题。DeepSeek 仅接收 OCR 文字，不接收原图。

系统不会把百度 AK、SK 或 access token发送到浏览器，也不会写入 `files`、`ocr_jobs`、日志或 Git。

## 2. 端到端架构

```text
浏览器选择图片/PDF
  → POST /api/v1/files/upload
  → files 表 + uploads 共享卷
  → POST /api/v1/ocr/jobs
  → Redis: ocr.process(job_id)
  → Celery Worker 读取文件
  → 百度 handwriting/general_basic
  → 结构化结果写入 ocr_jobs
  → 浏览器轮询 GET /api/v1/ocr/jobs/{id}
  → POST /api/v1/ocr/receipt/structure（用户启用 DeepSeek 时）
  → Prompt JSON + 原文证据校验
  → 收据/发票预填表单并人工确认

任一服务器步骤失败
  → 浏览器 Tesseract.js 本地识别
  → DeepSeek 仍可只处理 OCR 文字

DeepSeek 不可用或用户选择「仅本地规则」
  → OCR Worker 结构化结果 + 浏览器保守解析
  → 不把纯数字收据编号猜成金额
  → 显示回退原因，继续允许人工复核
```

## 3. 文件结构

```text
apps/api/app/modules/files/
├─ models.py                 # files ORM
├─ schemas.py                # 文件元数据响应
├─ service.py                # 文件校验和受控存储
└─ router.py                 # 上传、元数据查询

apps/api/app/modules/ocr/
├─ models.py                 # ocr_jobs ORM
├─ schemas.py                # OCR 任务及 DeepSeek 结构化契约
├─ celery_client.py          # API 仅发送命名任务，不导入 Worker
├─ receipt_ai_service.py     # Prompt 加载、DeepSeek 调用和证据校验
├─ router.py                 # 创建、查询 OCR 任务及同步 AI 结构化
└─ tests/
   └─ test_receipt_ai_service.py

workers/ocr_worker/
├─ main.py                   # Celery 应用
├─ tasks.py                  # 数据库任务生命周期
├─ cli.py                    # 百度 OCR 单文件冒烟测试
├─ handlers/
│  ├─ receipt_handler.py     # 收据字段提取
│  ├─ certificate_handler.py # 证书字段提取
│  └─ document_handler.py    # 通用文档结果
├─ services/
│  └─ ocr_engine.py          # 百度鉴权、请求和 token 缓存
└─ tests/
   └─ test_ocr_worker.py     # 9 个无网络单元测试

apps/web/lib/ocr-api.ts      # 上传、创建任务、轮询、前端回退
apps/web/lib/ocr-engine.ts   # Tesseract.js 本地识别
apps/web/lib/receipt-ai.ts   # 会话配置及 DeepSeek Prompt 请求
apps/web/lib/receipt-parser.ts # 无模型时的保守字段解析
```

## 4. 数据表

### files

保存原文件名、服务器路径、MIME、大小、业务模块、上传用户和可选业务实体。文件实际内容保存在 `uploads` 共享卷。

### ocr_jobs

主要字段：

| 字段 | 说明 |
|---|---|
| `file_id` | 关联 `files.id` |
| `module` | `finance/assets/awards/students` |
| `job_type` | `receipt/invoice/certificate/document` |
| `status` | `pending/processing/completed/failed` |
| `result_text` | OCR 原始文字 |
| `result_json` | OCR 行、置信度和结构化字段 |
| `error_message` | 最多 500 字的失败原因 |
| `created_by` | 创建任务的用户 |

迁移文件：`apps/api/alembic/versions/20260719_01_add_files_ocr.py`。

## 5. API

所有接口都需要 Bearer Token。

### 上传文件

```http
POST /api/v1/files/upload
Content-Type: multipart/form-data

file=<binary>
module=finance
entity_type=receipt
```

支持 JPG、JPEG、PNG、BMP 和 PDF，服务器默认最大 10MB。百度接口还会按 URL 编码后的实际限制二次校验。

### 创建任务

```http
POST /api/v1/ocr/jobs
Content-Type: application/json

{
  "file_id": 12,
  "module": "finance",
  "job_type": "receipt"
}
```

成功返回 HTTP 202。API 会先提交数据库事务，再向 Redis 发送 `ocr.process`，防止 Worker 查询不到新任务。

### 查询任务

```http
GET /api/v1/ocr/jobs/36
```

只有任务创建者可以查询。前端每秒轮询一次，最长等待 60 秒。

### DeepSeek 收据结构化

```http
POST /api/v1/ocr/receipt/structure
Authorization: Bearer <登录令牌>
X-AI-API-Key: <用户本次会话输入的 DeepSeek Key>
Content-Type: application/json

{
  "provider": "deepseek",
  "model": "deepseek-v4-flash",
  "source_file_id": 12,
  "ocr_engine": "baidu_ocr",
  "ocr_text": "收據\nN°\n8865431...",
  "ocr_confidence": 93.0,
  "page": 1,
  "lines": [
    {"line_no": 1, "text": "收據", "confidence": 98.0}
  ]
}
```

API Key 不得放入 JSON body，避免请求校验错误回显；接口不会建立 `AIJob`，也不会把 Key 送进 Redis/Celery。DeepSeek 使用 JSON Output，返回后由 Pydantic 和原文证据规则二次校验。金额只有在 OCR 原文存在货币符号或金额标签时才可自动回填。

## 6. 百度 OCR 模式

| 任务类型 | 默认接口 | 环境变量 |
|---|---|---|
| `receipt` | 手写文字识别 `handwriting` | `BAIDU_OCR_RECEIPT_MODE` |
| 其他 | 通用文字识别 `general_basic` | `BAIDU_OCR_DOCUMENT_MODE` |

可将普通文档模式改为 `accurate_basic`，但必须确认对应百度应用已开通该能力和计费资源。

百度请求采用 `application/x-www-form-urlencoded`，文件先 Base64，再由客户端 URL 编码。手写接口编码后限制 8MB；本实现会在发送前拒绝超限请求。

## 7. 密钥配置

复制根目录示例：

```powershell
Copy-Item .env.example .env
```

填写其中一种方式：

```dotenv
# 方式一：Worker 自动获取并缓存 access token
BAIDU_OCR_API_KEY=你的APIKey
BAIDU_OCR_SECRET_KEY=你的SecretKey

# 方式二：已有 access token
BAIDU_OCR_ACCESS_TOKEN=你的AccessToken
```

其他配置：

```dotenv
BAIDU_OCR_RECEIPT_MODE=handwriting
BAIDU_OCR_DOCUMENT_MODE=general_basic
BAIDU_OCR_TIMEOUT=20
```

不要把 `.env` 提交到 Git，不要建立 `NEXT_PUBLIC_BAIDU_*` 变量。

## 8. 部署与启动

```powershell
docker compose up -d db redis
docker compose up -d --build api worker
docker compose exec api alembic upgrade head
docker compose up -d --build web
```

检查服务：

```powershell
docker compose ps
docker compose logs -f worker
```

Worker 容器同时挂载：

- `/app/app`：后端模型和数据库会话；
- `/app/workers`：Worker 包；
- `/app/uploads`：与 API 共享的上传文件卷。

## 9. 单文件百度冒烟测试

不启动 Celery，直接验证真实百度账号：

```powershell
$env:BAIDU_OCR_API_KEY="你的APIKey"
$env:BAIDU_OCR_SECRET_KEY="你的SecretKey"
python -m workers.ocr_worker.cli "C:\path\receipt.jpg" --job-type receipt
```

预期输出包含：

```json
{
  "engine": "baidu_ocr",
  "raw_text": "...",
  "confidence": 90.0,
  "lines": []
}
```

若使用 PDF，默认只识别第 1 页，可通过 `BAIDU_OCR_PDF_PAGE` 修改。

## 10. 自动测试

安装依赖：

```powershell
pip install -r apps/api/requirements.txt -r workers/ocr_worker/requirements.txt
```

运行无网络测试：

```powershell
python -m unittest discover -s workers/ocr_worker/tests -p "test_*.py" -v
cd apps/api
python -m unittest app.modules.ocr.tests.test_receipt_ai_service -v
cd ../..
```

测试使用模拟百度和 DeepSeek 响应，不需要真实 AK/SK 或模型 Key，覆盖鉴权、token 缓存、错误处理、置信度、收据编号排除、模型幻觉字段清除、Key 脱敏和前端结果契约。

前端类型检查：

```powershell
cd apps/web
npm ci
npx tsc --noEmit --incremental false
```

## 11. 异常与安全

- 百度网络错误由 Celery 最多重试 3 次；业务错误直接记录为 `failed`。
- 已完成任务重复消费时直接返回已有结果，避免重复计费。
- 金额不确定时返回 `null`，不会猜测。
- 低置信度结果带 `warnings`，前端必须允许人工修改。
- Worker 错误只保存摘要，不保存百度 token 或完整请求 URL。
- 浏览器回退发生时会显示原因；Tesseract.js 结果不会冒充百度结果。
- DeepSeek Key 只在浏览器会话和单次同步请求内存在，不得进入数据库、日志、Redis 或 Celery。
- DeepSeek 只接收 OCR 文字而非原图；启用前界面向用户说明第三方处理范围。
- 模型输出不能直接入库；缺乏 OCR 原文证据的金额、付款人和用途必须清空。

## 12. 验收清单

- [ ] `alembic upgrade head` 创建 `files` 和 `ocr_jobs`。
- [ ] `.env` 已配置百度 AK/SK 或 access token。
- [ ] Worker 日志显示已注册 `ocr.process`。
- [ ] 财务收据上传后任务状态按 `pending → processing → completed` 变化。
- [ ] `result_json.ocr.engine` 为 `baidu_ocr`。
- [ ] 资产发票保存时带有 `file_id`。
- [ ] 停止 Worker 后，前端能自动回退 Tesseract.js 并显示提示。
- [ ] 9 个 Worker 单元测试通过。
- [ ] 5 个 DeepSeek 结构化服务单元测试通过。
- [ ] 截图回归文本中的 `8865431` 不会成为金额，付款人为「張三」。
- [ ] 浏览器关闭当前标签页后不会继续保留 DeepSeek Key。
- [ ] TypeScript 无输出检查通过。
