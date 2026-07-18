# 04-module-finance-assets — A2 财务收支 + A3 资产盘点

> 负责人：同学 3 | 角色：中级全栈 | 总工时：18 小时
> 文档版本：v1.0 | 日期：2026-07-17 | 12 节标准模板

---

## 1. 用户与场景

### A2：财务收支（事项二）

- **频次**：收入每日多次、支出每月 2-3 次、报价单不定期
- **场景**：
  - 手写收据 → 拍照上传 → AI OCR 自动识别金额/日期/付款人 → 入账
  - 发票上传 → OCR 提取供应商/金额 → 支出审批
  - 报价单收集 → AI 分析异常（单一报价 / 未采纳最低报价）

### A3：资产盘点（事项三）

- **频次**：盘点一年一次（3-4 个月）、注销不定期、新增按发票
- **场景**：
  - 拍照发票 → OCR 识别资产信息 → 自动填充表单 → 登记入库
  - 资产搬移 → 记录搬移历史 → 更新资产地点
  - 盘点 → 按地点分组 → 生成盘点报告

---

## 2. 当前痛点

| 痛点 | 影响 | 解决 |
|------|------|------|
| 手写收据难辨认 | 手动输入易错，速度慢 | 拍照 OCR 自动识别 |
| 手动计算易错 | 收支统计不准确 | 系统自动汇总 |
| 手写 REMARKS 难懂 | 盘点记录无法读取 | 扫描上传 + AI 校对 |
| 盘点周期长 | 3-4 个月才能完成一次 | 按地点分组 + 一键清单 |

**预期节省**：A2 50-60%，A3 40-50%

---

## 3. MVP 范围（本次交付功能）

### A2 财务收支

- [x] 收入记录：CRUD + 列表筛选（按状态/项目）
- [x] 支出记录：CRUD + 列表筛选（按状态/供应商）
- [x] 报价单：CRUD + 按项目名分组展示
- [x] 收据 OCR 识别 + 自动填充表单
- [x] 报价单 AI 分析（单一报价 / 未采纳最低报价）
- [x] 地址 LABEL 批量生成

### A3 资产盘点

- [x] 资产登记：CRUD + 自动生成编号
- [x] 资产搬移：记录历史 + 更新地点
- [x] 盘点报告：按地点分组 + 状态统计
- [x] 资产注销：填写原因 → 审批
- [x] 发票 OCR 识别 + 自动填充表单
- [x] 批量打印资产标签

---

## 4. 暂不实现（V2 计划）

- [ ] 自动对账（银行流水 vs 系统记录）
- [ ] 预算预警（超预算自动提醒）
- [ ] 折旧计算（直线法/加速折旧）
- [ ] 二维码扫码盘点
- [ ] RFID 资产追踪
- [ ] 多币种支持

---

## 5. 页面设计

### 5.1 Finance 总览页 `/dashboard/apple/finance`

**3 个 Tab**：

| Tab | 统计卡 | 表格字段 | 操作 |
|-----|--------|---------|------|
| 收入 | 本月收入/待入账/已入账/单据数 | 日期/项目/金额/支付方式/经手人/状态 | 新增收入(OCR)/查看详情 |
| 支出 | 本月支出/待审批/已审批/单据数 | 发票号/供应商/项目/金额/审批人/状态 | 新增支出/上传发票 |
| 报价单 | — | 项目名/报价单位/报价金额/是否最低/备注 | 新增报价单/AI 分析 |

**高亮规则**：
- 🟡 黄色 `bg-[#fffaeb]`：单一报价
- 🔴 红色 `bg-[#fef3f2]`：未采纳最低报价

### 5.2 Assets 总览页 `/dashboard/apple/assets`

**3 个 Tab**：

| Tab | 分组方式 | 表格字段 | 操作 |
|-----|---------|---------|------|
| 盘点 | 按地点 | 资产编号/名称/类别/状态/备注 | 搬移记录/申请注销 |
| 注销 | — | 编号/名称/类别/原地/原因/状态 | 查看详情 |
| 新增 | — | 上传发票(OCR) / 手动填写表单 | 登记入库 |

**状态分类**：
- 🟢 正常 (active)
- 🟡 已搬移 (moved)
- ⚪ 已注销 (written_off)
- 🔴 找不到 (missing)

### 5.3 弹窗组件

| 组件 | 用途 | 流程 |
|------|------|------|
| `UploadReceiptDialog` | 收据拍照上传 | 上传 → OCR 识别 → 用户确认字段 → 入账 |
| `UploadAssetDialog` | 发票扫描登记 | 上传 → OCR 识别 → 自动填充 → 补充地点 → 入库 |
| `AssetMovementDialog` | 资产搬移记录 | 选资产 → 选目标地点 → 填日期/原因 → 确认 |

---

## 6. 数据模型

### 6.1 ER 图

```
┌─────────────────────┐     ┌─────────────────────┐
│ apple_finance_records│     │  apple_quotations    │
├─────────────────────┤     ├─────────────────────┤
│ id (PK)             │     │ id (PK)              │
│ record_type         │     │ project_name         │
│ date                │     │ vendor               │
│ project             │     │ amount               │
│ amount              │     │ is_lowest            │
│ payment_method      │     │ is_selected          │
│ handler             │     │ remark               │
│ invoice_no          │     │ created_by (FK)      │
│ supplier            │     │ created_at           │
│ approver            │     │ updated_at           │
│ status              │     └─────────────────────┘
│ attachment_file_id  │
│ created_by (FK)     │
│ created_at          │     ┌─────────────────────┐
│ updated_at          │     │   apple_assets       │
└─────────────────────┘     ├─────────────────────┤
                            │ id (PK)              │
                            │ asset_no (UNIQUE)    │
                            │ name                 │
                            │ category             │
┌──────────────────────┐   │ location             │
│ apple_asset_movements│   │ status               │
├──────────────────────┤   │ purchase_date        │
│ id (PK)              │   │ purchase_amount      │
│ asset_id (FK)        │──→│ remark               │
│ from_location        │   │ written_off_at       │
│ to_location          │   │ written_off_reason   │
│ movement_date        │   │ created_by (FK)      │
│ reason               │   │ created_at           │
│ operator             │   │ updated_at           │
│ created_at           │   └─────────────────────┘
└──────────────────────┘
```

### 6.2 字段说明

**FinanceRecord** (`apple_finance_records`) — 收入/支出合一:

| 字段 | 类型 | 说明 |
|------|------|------|
| record_type | VARCHAR(20) | income / expense |
| date | DATE | 日期 |
| project | VARCHAR(200) | 项目名称 |
| amount | INTEGER | 金额（HKD 元） |
| payment_method | VARCHAR(50) | 支付方式（收入专用） |
| handler | VARCHAR(50) | 经手人（收入专用） |
| invoice_no | VARCHAR(100) | 发票号（支出专用） |
| supplier | VARCHAR(200) | 供应商（支出专用） |
| approver | VARCHAR(50) | 审批人（支出专用） |
| status | VARCHAR(20) | pending/confirmed/approved/rejected |
| attachment_file_id | INTEGER | 关联收据/发票文件 |

**Quotation** (`apple_quotations`):

| 字段 | 类型 | 说明 |
|------|------|------|
| project_name | VARCHAR(200) | 项目名称 |
| vendor | VARCHAR(200) | 报价单位 |
| amount | INTEGER | 报价金额（HKD 元） |
| is_lowest | BOOLEAN | 是否最低报价 |
| is_selected | BOOLEAN | 是否采纳 |
| remark | TEXT | 备注/评审意见 |

**Asset** (`apple_assets`):

| 字段 | 类型 | 说明 |
|------|------|------|
| asset_no | VARCHAR(50) UNIQUE | 资产编号（自动生成） |
| name | VARCHAR(200) | 资产名称 |
| category | VARCHAR(50) | IT设备/家具/电器/办公设备/其他 |
| location | VARCHAR(100) | 存放地点 |
| status | VARCHAR(20) | active/moved/written_off/missing |
| purchase_date | DATE | 购买日期 |
| purchase_amount | INTEGER | 购买金额（HKD 元） |
| remark | TEXT | 备注 |
| written_off_at | TIMESTAMP | 注销日期 |
| written_off_reason | TEXT | 注销原因 |

**AssetMovement** (`apple_asset_movements`):

| 字段 | 类型 | 说明 |
|------|------|------|
| asset_id | FK→apple_assets | 关联资产 |
| from_location | VARCHAR(100) | 原地点 |
| to_location | VARCHAR(100) | 目标地点 |
| movement_date | DATE | 搬移日期 |
| reason | TEXT | 搬移原因 |
| operator | VARCHAR(50) | 操作人 |

---

## 7. API 设计

### A2 财务收支

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/apple/finance/income` | 收入列表（分页/筛选） | FINANCE_READ |
| POST | `/api/v1/apple/finance/income` | 新增收入（支持 OCR 预填） | FINANCE_WRITE |
| GET | `/api/v1/apple/finance/income/{id}` | 收入详情 | FINANCE_READ |
| PUT | `/api/v1/apple/finance/income/{id}` | 更新收入 | FINANCE_WRITE |
| DELETE | `/api/v1/apple/finance/income/{id}` | 删除收入 | FINANCE_DELETE |
| GET | `/api/v1/apple/finance/expense` | 支出列表 | FINANCE_READ |
| POST | `/api/v1/apple/finance/expense` | 新增支出 | FINANCE_WRITE |
| GET | `/api/v1/apple/finance/expense/{id}` | 支出详情 | FINANCE_READ |
| PUT | `/api/v1/apple/finance/expense/{id}` | 更新支出（含审批） | FINANCE_WRITE |
| DELETE | `/api/v1/apple/finance/expense/{id}` | 删除支出 | FINANCE_DELETE |
| GET | `/api/v1/apple/finance/quotations` | 报价单列表 | FINANCE_READ |
| POST | `/api/v1/apple/finance/quotations` | 新增报价单 | FINANCE_WRITE |
| POST | `/api/v1/apple/finance/quotations/analyze` | AI 分析报价单 | FINANCE_READ |
| POST | `/api/v1/apple/finance/address-labels` | 批量生成地址标签 | FINANCE_READ |

**请求示例 — POST /income**:
```json
{
  "record_type": "income",
  "date": "2026-07-15",
  "project": "中六畢業禮活動經費",
  "amount": 1500,
  "payment_method": "現金",
  "handler": "陳大明",
  "attachment_file_id": null
}
```

**响应格式**:
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "record_type": "income",
    "date": "2026-07-15",
    "project": "中六畢業禮活動經費",
    "amount": 1500,
    "status": "pending"
  }
}
```

### A3 资产盘点

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/apple/assets` | 资产列表（多种筛选） | ASSETS_READ |
| POST | `/api/v1/apple/assets` | 登记新资产 | ASSETS_WRITE |
| GET | `/api/v1/apple/assets/{id}` | 资产详情 | ASSETS_READ |
| PUT | `/api/v1/apple/assets/{id}` | 更新资产 | ASSETS_WRITE |
| DELETE | `/api/v1/apple/assets/{id}` | 删除资产 | ASSETS_DELETE |
| GET | `/api/v1/apple/assets/{id}/movements` | 搬移历史 | ASSETS_READ |
| POST | `/api/v1/apple/assets/{id}/movements` | 记录搬移 | ASSETS_WRITE |
| POST | `/api/v1/apple/assets/stocktake` | 盘点报告 | ASSETS_READ |
| POST | `/api/v1/apple/assets/{id}/writeoff` | 注销资产 | ASSETS_APPROVE |
| POST | `/api/v1/apple/assets/print-labels` | 批量打印标签 | ASSETS_READ |
| POST | `/api/v1/ocr/invoice/structure` | OCR 后的资产发票字段结构化（可选 DeepSeek） | 登录用户 |

---

## 8. AI / OCR 流程

### 8.1 收据 OCR 流程

```
用户拍照/上传收据图片
  ↓
POST /api/v1/files/upload → files 表记录
  ↓
POST /api/v1/ocr/jobs (file_id, module=finance, job_type=receipt)
  ↓
Celery ocr.process(job_id):
  1. 查 files 表获取共享卷文件路径
  2. 更新 OCRJob (pending → processing)
  3. 调用百度手写文字识别 → raw_text
  4. 写入 OCR 行、置信度和 raw_text，并标记 completed
  5. 前端轮询取得 OCR 结果
  ↓
用户启用 DeepSeek 时：
  POST /api/v1/ocr/receipt/structure
  → receipt_extract_zh_hk.md
  → 白名单归一化 + OCR 原文证据校验
  → {amount, currency, date, payer, purpose, confidence, warnings, raw_text}
  ↓
前端展示结果 → 用户确认/修正 → POST /income（带 file_id）

用户选择「仅本地规则」或 DeepSeek 不可用时 → 浏览器保守解析并提示回退原因
API/Worker/百度不可用时 → 浏览器 Tesseract.js 回退，再执行所选结构化方式
```

> OCR Worker 只负责调用百度 OCR、保存文字及任务状态，不在 Celery 任务内调用 DeepSeek。DeepSeek 是浏览器取得 OCR 文字后发起的独立同步 API。

### 8.2 资产发票 OCR 与字段结构化流程

```text
用户在资产盘点页上传发票
  ↓
POST /api/v1/files/upload（module=assets, entity_type=invoice）
  ↓
POST /api/v1/ocr/jobs（module=assets, job_type=invoice）
  ↓
Celery ocr.process(job_id)
  → 百度 general_basic 只提取文字、行及置信度
  → 写入 ocr_jobs.result_text / result_json
  → 前端轮询取得 OCR 结果
  ↓
用户选择字段结构化方式：
  ├─ DeepSeek
  │   → POST /api/v1/ocr/invoice/structure
  │   → invoice_asset_extract_zh_hk.md
  │   → JSON 白名单归一化
  │   → OCR 原文证据校验
  │   → 最多一次格式重试
  └─ 仅本地规则
      → 浏览器保守解析，不发送 OCR 文字给模型
  ↓
预填候选字段 → 用户对照原图复核/修改 → 补充资产地点 → POST /api/v1/apple/assets
```

同步结构化响应只允许以下候选字段：

```json
{
  "fields": {
    "asset_name": "筆記本電腦",
    "category": "IT設備",
    "amount": 3280.0,
    "currency": "HKD",
    "purchase_date": "2026-07-15",
    "vendor": "示例供应商有限公司",
    "invoice_no": "INV-20260715-01",
    "multiple_items": false
  },
  "confidence": "medium",
  "warnings": [],
  "raw_text": "由服务端补回的 OCR 原文"
}
```

字段回填遵守以下安全规则：

- `asset_name` 必须能在 OCR 原文中找到对应货品描述；类别只允许映射到系统白名单，不能由模型自由增加。
- `amount` 表示整张发票的购买总额，优先采用 `Grand Total`、`Invoice Total`、`Total Amount`，其次才是普通 `Total`、`总额` 或 `合计`；`Amount Due`、`Balance Due` 是未付余额，只有完全没有发票总额且没有已付款、订金或贷项上下文时才可保守采用。小计、税款、折扣、订金和单价不能当作资产金额；Credit Note／Memo／Advice、贷项通知、半角或全角括号会计负数、前后置负号及 `CR` 金额不得转成正数回填。
- `currency` 必须有 `HKD`、`HK$`、`港币` 或 `港元` 证据；裸 `$` 不足以确认港币。
- `purchase_date` 优先采用明确的发票日期；到期日、送货日和付款日不能代替。日月均不大于 12 的斜杠日期视为有歧义并留空。
- `vendor` 只能是卖方/供应商；`Bill To`、`Sold To`、`Ship To`、客户、买方或收货人不能误填为供应商。
- `invoice_no` 只能来自发票编号标签附近，不得当作金额或系统资产编号。
- 只有明细区恰好一项且数量明确为 1 时才允许单项预填；检测到多项、数量大于 1 或缺少可靠数量证据时，`multiple_items=true`，系统不把整张发票总额自动回填到一项资产，也不自动确定单一资产名称/类别；前端以低置信度警告用户逐项拆分登记。
- 模型输出缺乏原文证据、字段冲突或格式异常时，对应字段置空并降低 `confidence`。所有结果都必须人工确认后才能入库，资产地点始终由用户填写。

DeepSeek 模式下，API Key 只保存在当前浏览器会话，并通过 `X-AI-API-Key` 请求头发送给同步接口；不进入 JSON body、数据库、日志、Redis、Celery 或 Git。只发送 OCR 文字，不发送发票原图。用户可随时选择「仅本地规则」。DeepSeek 鉴权、余额、限流或网络失败时不进行格式重试；JSON 格式错误最多重试一次，之后自动回退本地保守规则并显示原因。

### 8.3 报价单分析流程

```
POST /quotations/analyze
  ↓
quotation_analyze():
  1. 按 project_name 分组所有报价单
  2. 对每组:
     - 1家报价 → is_single_bid=true, warning:"建议增加比价"
     - 最低未被采纳 → non_lowest_selected=true, warning:"未采纳最低报价"
  3. 返回分析报告 + 统计摘要
```

### 8.4 OCR 引擎架构

**双层支持**（按优先级）:
1. **百度智能云 OCR**（Worker 主引擎）— `workers/ocr_worker/services/ocr_engine.py`
2. **Tesseract.js**（浏览器端回退）— `apps/web/lib/ocr-engine.ts`

**引擎选择逻辑**:
```text
receipt → 百度 handwriting
invoice/certificate/document → 百度 general_basic
服务器链路失败 → 浏览器 Tesseract.js
```

---

## 9. 权限规则

### A2 财务收支

| 权限码 | 说明 | 预置角色 |
|--------|------|---------|
| `apple:finance:read` | 查看收入/支出/报价单 | 总务主任、校长、财务人员 |
| `apple:finance:write` | 新增/修改收支记录 | 总务主任、财务人员 |
| `apple:finance:delete` | 删除收支记录 | 总务主任 |

### A3 资产盘点

| 权限码 | 说明 | 预置角色 |
|--------|------|---------|
| `apple:assets:read` | 查看资产/搬移/盘点 | 总务主任、校长、资产管理员 |
| `apple:assets:write` | 登记/修改资产 | 总务主任、资产管理员 |
| `apple:assets:delete` | 删除资产 | 总务主任 |
| `apple:assets:approve` | 审批资产注销 | 总务主任、校长 |

**使用方式**:
```python
from app.core.permissions import require_permission, Permissions
_ = Depends(require_permission(Permissions.FINANCE_READ))
```

---

## 10. 审计日志

以下关键操作必须记录审计日志：

| 操作 | 模块 | 记录内容 |
|------|------|---------|
| 新增收入 | finance | user_id, record_id, amount, project |
| 新增支出 | finance | user_id, record_id, amount, supplier |
| 审批支出 | finance | user_id, record_id, approver, result |
| 新增资产 | assets | user_id, asset_no, name, category |
| 资产搬移 | assets | user_id, asset_no, from→to |
| 资产注销 | assets | user_id, asset_no, reason |
| OCR 任务 | ocr | user_id, file_id, result |

**实现**:
```python
from app.modules.audit.models import AuditLog
log = AuditLog(
    user_id=user.id, username=user.display_name,
    action="create", module="finance",
    entity_type="income", entity_id=record.id,
)
db.add(log)
```

---

## 11. 异常处理

| 异常场景 | 错误码 | 处理方式 |
|---------|--------|---------|
| 文件不存在 | 20001 | 返回 NOT_FOUND + 提示 |
| OCR 引擎不可用 | 40002 | 回退到浏览器端 Tesseract.js |
| OCR 识别信心低 | — | warnings 说明 + confidence=low |
| DeepSeek 不可用 | 502/上游错误 | 显示原因并回退本地保守规则，保留 OCR 原文供复核 |
| 发票包含多项、数量大于 1 或数量证据缺失 | — | 不自动回填单一资产，提示逐项拆分登记 |
| 发票字段缺乏原文证据 | — | 清空对应候选值 + confidence=low + warning |
| 报价单格式异常 | 40001 | 跳过该项 + warning 记录 |
| 资产找不到 | 20001 | 状态改为 missing |
| 资产重复注销 | 40005 | 提示"已注销，无需重复操作" |
| 搬移地点相同 | 40003 | 拒绝 + 提示"目标地点不能与当前地点相同" |
| 搬移地点不一致 | 40002 | 拒绝 + 提示当前实际地点 |
| 参数校验失败 | 30001 | 返回 VALIDATION_ERROR + 字段详情 |

---

## 12. 验收标准

### 功能验收

- [ ] Finance 页面：3 个 Tab 切换正常，筛选可用
- [ ] Assets 页面：3 个 Tab 切换正常，按地点分组正确
- [ ] 上传收据 → OCR 识别 → 字段自动填充 → 确认入账全流程走通
- [ ] 上传发票 → 百度 OCR 提字 → DeepSeek 或本地规则结构化 → 人工复核 → 登记入库全流程走通
- [ ] DeepSeek 模式只发送 OCR 原文，Key 仅在会话与 `X-AI-API-Key` 请求头内存在
- [ ] 「仅本地规则」无需模型 Key，可完成保守预填并允许人工修改
- [ ] 多行、多数量或数量证据缺失的发票不会把整张总额自动登记为一项资产
- [ ] 报价单 AI 分析：单一报价黄底、未采纳最低红底高亮正确
- [ ] 资产搬移：地点更新 + 搬移历史记录正确
- [ ] 资产注销：状态变更 + 原因记录正确
- [ ] 盘点报告：按地点分组 + 各状态统计正确

### 测试验收

- [ ] 单元测试 ≥ 8 个全部通过
- [ ] finance 模块测试 ≥ 4 个
- [ ] assets 模块测试 ≥ 4 个
- [ ] OCR Worker 测试 ≥ 1 个
- [ ] 资产发票结构化测试覆盖白名单归一化、原文证据、格式重试、保守回退与 Key 脱敏

### 代码验收（design.md §11.4）

- [1] 目录规范：文件在正确位置
- [2] 权限校验：每个端点有 `Depends(require_permission(...))`
- [3] 错误处理：使用统一错误码
- [4] 空/加载状态：DataTable/EmptyState 组件支持
- [5] 审计日志：关键操作已记录
- [6] 无硬编码密钥：使用环境变量
- [7] API 文档更新：本文件即为 API 文档
- [8] 基本测试：≥8 个单元测试

---

*文档版本：v1.0 · 编制日期：2026-07-17 · 负责人：同学 3*
