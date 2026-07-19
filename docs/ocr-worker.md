# OCR Worker 技术文档

> **文档版本**: v1.0 | **负责人**: 同学 4 | **日期**: 2026-07-19

---

## 1. 模块目标

OCR 链路用于财务收据、资产发票、奖状证书和普通文档识别。主引擎为**百度智能云 OCR**；浏览器端 Tesseract.js 仅在 API、Redis、Worker 或百度服务不可用时自动回退。

## 2. 架构

`
浏览器选择图片/PDF
   ↓ POST /api/v1/files/upload
   ↓ files 表 + uploads 共享卷
   ↓ POST /api/v1/ocr/jobs
   ↓ Redis: ocr.process(job_id)
   ↓ Celery Worker 读取文件
   ↓ 百度 handwriting/general_basic
   ↓ OCR 文字、行和置信度写入 ocr_jobs
   ↓ 浏览器轮询 GET /api/v1/ocr/jobs/{id}
   ↓ 用户选择字段结构化方式
       ├── 收据 DeepSeek: POST /api/v1/ocr/receipt/structure
       ├── 资产发票 DeepSeek: POST /api/v1/ocr/invoice/structure
       └── 仅本地规则：浏览器保守解析，不请求模型
   ↓ 对 DeepSeek JSON 做白名单归一化 + OCR 原文证据校验
   ↓ 预填表单并人工确认
`

## 3. 文件结构

`
workers/ocr_worker/
├── main.py              # Celery 应用入口
├── tasks.py             # Celery 异步任务定义
├── cli.py               # 命令行工具
├── handlers/
│   ├── receipt_handler.py      # 收据处理
│   ├── document_handler.py     # 文档处理
│   ├── certificate_handler.py  # 证书处理
│   └── prompt_loader.py        # Prompt 加载
├── services/
│   └── ocr_engine.py           # 百度 OCR 引擎封装
└── tests/
    └── test_ocr_worker.py      # Worker 单元测试
`

## 4. 百度 OCR 配置

配置在根目录 .env 中：

`ini
BAIDU_OCR_API_KEY=your_api_key
BAIDU_OCR_SECRET_KEY=your_secret_key
BAIDU_OCR_ACCESS_TOKEN=optional_token
BAIDU_OCR_RECEIPT_MODE=handwriting
BAIDU_OCR_DOCUMENT_MODE=general_basic
BAIDU_OCR_TIMEOUT=20
`

- 百度 AK/SK 只配置在服务器 .env 或部署平台密钥管理中
- 不使用 NEXT_PUBLIC_* 暴露给浏览器
- 已有 access token 时可直接填写，与 AK/SK 二选一

## 5. 安全注意事项

- DeepSeek Key 仅保存在当前浏览器标签页会话，通过单次请求头使用
- 不会写入数据库、日志、Redis、Celery 或 Git
- DeepSeek 仅接收 OCR 文字，不接收原图
- 启用后只发送 OCR 文字，所有候选字段仍须人工确认
- 多项或数量不明确的资产发票不会自动折叠成一项资产

## 6. 回退策略

| 故障场景 | 处理方式 |
|---------|---------|
| 百度 OCR 不可用 | 浏览器 Tesseract.js 本地识别 |
| DeepSeek 连接失败 | OCR 原文 + 浏览器保守解析 |
| DeepSeek 连续两次格式异常 | OCR 原文 + 浏览器保守解析 |
| 用户选择"仅本地规则" | 不请求模型，纯前端解析 |

## 7. 测试

`ash
cd workers/ocr_worker && python -m pytest tests/ -v
`

---

*文档版本: v1.0 · 编制日期: 2026-07-19 · 负责人: 同学 4*
