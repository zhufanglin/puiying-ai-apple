# OCR Worker 技术文档

## 1. 用户与场景

OCR Worker 服务于 Apple 子系统的手写收据、学生证明及一般扫描文件。它是后台异步处理组件，不向终端用户直接开放界面。Apple 在业务页面查看候选字段并完成人工确认。

## 2. 当前痛点

- 图片 OCR 耗时，不应阻塞 FastAPI 请求线程。
- 百度 OCR、PaddleOCR 与 Tesseract 的鉴权、安装和输出结构不同。
- OCR 文字与结构化 Prompt 结果容易混在一起，难以追溯来源。
- 学生及财务数据敏感，低信心结果不可自动入库。
- 任务失败、重试和人工复核状态缺少统一契约。

## 3. MVP 范围

- Celery 任务 `ocr.process_job`／函数 `process_ocr_job(job_id)`。
- 状态：`pending → running → needs_review`，失败进入 `failed`。
- 文本、JSON、CSV 直接读取，文字型 PDF 使用 `pypdf`。
- 图片可选择百度 OCR、PaddleOCR 或 Tesseract；`auto` 默认只使用本地引擎，避免意外把敏感图片发送到外部服务。
- 收据、学生证明和一般文档三个 Handler。
- Prompt 从统一目录加载，不散落在任务代码。
- 结果和审计信息写入 `aiJobs`／正式环境 `ai_jobs`。

## 4. 暂不实现

- 不在 Worker 中保存或读取前端大模型 API Key。百度 OCR 的 AK/SK 只允许作为 Worker 服务器环境变量注入。
- 不直接调用未经学校批准的外部 LLM。
- 不自动确认金额、姓名、学号、考勤状态或证明内容。
- 不在文件型开发存储中承诺多 Worker 并发强一致；生产环境使用 PostgreSQL 行锁或任务表。
- PaddleOCR 模型权重不放入仓库，按部署环境安装。

## 5. 目录与组件

```text
workers/ocr_worker/
├─ main.py
├─ tasks.py
├─ job_store.py
├─ cli.py
├─ .env.example
├─ handlers/
│  ├─ receipt_handler.py
│  ├─ certificate_handler.py
│  ├─ document_handler.py
│  └─ prompt_loader.py
├─ services/
│  └─ ocr_engine.py
└─ tests/
```

`ocr_engine.py` 只负责文字提取；Handler 负责结构化候选；`tasks.py` 负责任务状态、审计和异常处理。

## 6. 任务数据模型

```json
{
  "id": "job_xxx",
  "jobType": "ocr.extract_receipt",
  "module": "apple",
  "sourceFileId": "file_xxx",
  "status": "pending",
  "ocr": null,
  "result": null,
  "humanReviewRequired": true
}
```

`ocr` 保存引擎、平均信心、页数、原文和引擎警告；`result` 保存 `fields`、`confidence`、`warnings`、`raw_text` 及使用的 Prompt 名称。

## 7. 调用设计

同步测试或调试：

```python
from workers.ocr_worker.tasks import process_ocr_job_sync

result = process_ocr_job_sync("job_xxx")
```

生产异步调用：

```python
from workers.ocr_worker.tasks import process_ocr_job

process_ocr_job.delay("job_xxx")
```

上游 API 必须先保存文件并创建 `pending` 任务，再把 `job_id` 放入 Redis。Worker 只接收 `job_id`，不接收原始文件内容或 API Key。

## 8. OCR 与 Prompt 流程

```text
读取 ai_jobs
  → 标记 running
  → 根据 source_file_id 获取文件
  → Direct／百度 OCR／PaddleOCR／Tesseract 提取文字
  → 按 job_type 选择 Handler
  → 加载统一 Prompt
  → 产生结构化候选
  → 标记 needs_review
  → Apple 人工确认
```

`OCR_ENGINE=auto` 时默认依次尝试 PaddleOCR、Tesseract。只有明确设置 `BAIDU_OCR_ENABLED=true` 才会在 `auto` 模式加入百度；建议生产环境直接设置 `OCR_ENGINE=baidu` 或本地引擎名称。PDF 如能直接提取文字，不启动图片 OCR。Handler 不得把低信心字段补成看似合理的值。

百度模式：

- `BAIDU_OCR_MODE=handwriting`：手写收据，调用 `/rest/2.0/ocr/v1/handwriting`。
- `BAIDU_OCR_MODE=accurate_basic`：印刷文件高精度识别。
- AK/SK 用于换取 access token；Worker 会在进程内按有效期缓存。
- 也可由密钥管理系统直接设置 `BAIDU_OCR_ACCESS_TOKEN`。
- 请求采用 `application/x-www-form-urlencoded`，图片以不带 data URI 头的 Base64 发送。

官方参考：

- `https://cloud.baidu.com/doc/OCR/s/Ck3h7y2ia`
- `https://cloud.baidu.com/doc/OCR/s/hk3h7y2qq`
- `https://cloud.baidu.com/doc/OCR/s/1k3h7y3db`

## 9. Prompt 设计规范

所有 Prompt 必须包含：

1. 适用模块与用途；
2. 输入字段；
3. 唯一合法 JSON 输出 Schema；
4. 处理规则；
5. 安全限制；
6. 示例输入；
7. 示例输出。

统一输出至少包含 `fields`、`confidence`、`warnings` 和 `raw_text`。不确定金额返回 `null`，无法识别姓名时不得猜测，报价分析不得替代采购审批。

## 10. 安全、审计与可观测性

- `ocr_job.started`、`ocr_job.needs_review`、`ocr_job.failed` 写入审计日志。
- 日志记录 job ID、引擎、信心及错误摘要，不记录 API Key。
- 日志及 `aiJobs` 不得记录百度 AK、SK、access token 或带 token 的完整请求 URL。
- 来源文件必须位于受控存储，正式环境使用短期签名 URL 或 Worker 专用服务账户。
- OCR 原文只对获授权 Apple／reviewer 角色开放。
- 建议监控任务等待时间、处理时间、失败率、低信心率和人工退回率。

## 11. 异常、重试与幂等

- 文件不存在、任务不存在：立即失败，不重试业务错误。
- 暂时性 I/O 错误：Celery 指数退避，最多三次。
- OCR 引擎未安装：记录可操作错误；`auto` 模式尝试下一个引擎。
- 百度鉴权失败或返回业务错误：任务失败并保存错误码摘要；不得保存密钥。
- 百度网络超时、DNS 或 HTTP 暂时错误：转换为 `OSError`，由 Celery 最多重试三次。
- 无文字结果：保存警告并进入人工处理或失败队列，不编造结构化字段。
- 已是 `running`、`needs_review` 或 `confirmed` 的任务再次调用时直接返回，避免重复处理。
- 正式数据库应以任务 ID 和状态条件更新保证幂等。

## 12. 部署与验收

基础 Tesseract Worker：

```bash
docker compose up --build redis worker
```

本地运行：

```bash
pip install -r workers/ocr_worker/requirements.txt
celery -A workers.ocr_worker.main.celery_app worker --loglevel=INFO
```

PaddleOCR 部署：

```bash
pip install -r workers/ocr_worker/requirements-paddle.txt
# 再按 CPU／GPU 环境安装匹配版本的 paddlepaddle
set OCR_ENGINE=paddleocr
```

### 百度 OCR 本地冒烟测试

先在百度智能云控制台开通文字识别应用并取得 API Key 与 Secret Key。不要把密钥写入仓库。

PowerShell：

```powershell
$env:OCR_ENGINE="baidu"
$env:BAIDU_OCR_MODE="handwriting"
$env:BAIDU_OCR_API_KEY="你的API Key"
$env:BAIDU_OCR_SECRET_KEY="你的Secret Key"
python -m workers.ocr_worker.cli "C:\path\receipt.jpg" --engine baidu
```

Bash：

```bash
export OCR_ENGINE=baidu
export BAIDU_OCR_MODE=handwriting
export BAIDU_OCR_API_KEY='你的API Key'
export BAIDU_OCR_SECRET_KEY='你的Secret Key'
python -m workers.ocr_worker.cli ./receipt.jpg --engine baidu
```

成功时输出 `engine=baidu_ocr`、识别文字、平均置信度及警告。手写接口请求编码后上限为 8MB，图片最短边至少 15px、最长边不超过 4096px；测试图建议使用清晰 JPG/PNG。

### 无真实密钥的自动测试

```bash
python -m unittest discover -s workers/ocr_worker/tests -p "test_*.py" -v
```

测试会模拟百度 token 和 OCR HTTP 响应，不访问外网，也不需要真实 AK/SK。

### Celery 端到端测试

1. 启动 Redis 与 Worker。
2. 在 `apps/api/data/apple_students_state.json` 的 `files` 中保存测试文件记录，在 `aiJobs` 中建立 `status=pending` 的任务。
3. 调用 `process_ocr_job.delay(job_id)`。
4. 验证状态为 `pending → running → needs_review`，并检查 `ocr.engine=baidu_ocr`、`result`、`humanReviewRequired=true` 和审计日志。

验收要求：文本直接提取、收据字段结构化、低信心不编造、任务状态和审计更新、失败重试、Prompt 可追踪、API Key 不进入 Worker，以及全部 Worker 测试通过。
