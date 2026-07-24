# A2 财务收支 + A3 资产盘点模块

> **文档版本**: v1.0 | **负责人**: 同学 3 | **工时**: 18 小时

---

## 1. A2 财务收支

### 1.1 用户与场景

- **目标用户**: 总务主任、财务人员
- **场景**:
  - 手写收据 → 拍照上传 → AI OCR 识别金额/日期/付款人 → 入账
  - 发票上传 → OCR 提取供应商/金额 → 支出审批
  - 报价单收集 → AI 分析异常（单一报价 / 未采纳最低报价）

### 1.2 核心功能

| 功能 | 说明 |
|------|------|
| 收入记录 | CRUD + 列表筛选（按状态/项目） |
| 支出记录 | CRUD + 列表筛选（按状态/供应商） |
| 报价单 | CRUD + 按项目名分组展示 |
| 收据 OCR 识别 | 拍照 → 百度 OCR → AI 结构化 → 自动填充表单 |
| 发票 AI 分析 | DeepSeek 提取发票字段 |
| 报价单 AI 分析 | 单一报价 / 非最低价中标分析 |
| 地址标签批量生成 | 按项目生成地址 LABEL |

### 1.3 数据模型（2 张表）

| 表名 | 说明 |
|------|------|
| pple_finance_records | 收支记录（type=income/expense） |
| pple_quotations | 报价单 |

### 1.4 API 端点（9 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /income | 收入列表 |
| POST | /income | 新增收入 |
| GET | /income/{id} | 收入详情 |
| PATCH | /income/{id} | 更新收入 |
| GET | /expense | 支出列表 |
| POST | /expense | 新增支出 |
| PATCH | /expense/{id} | 更新支出 |
| GET | /quotations | 报价单列表 |
| POST | /quotations/analyze | 报价 AI 分析 |

---

## 2. A3 资产盘点

### 2.1 用户与场景

- **目标用户**: 资产管理员、总务主任
- **场景**:
  - 拍照发票 → OCR 识别资产信息 → 自动填充表单 → 登记入库
  - 资产移动 → 记录移动历史 → 更新资产地点
  - 盘点 → 按地点分组 → 生成盘点报告

### 2.2 核心功能

| 功能 | 说明 |
|------|------|
| 资产 CRUD | 登记/修改/查询资产 |
| 资产移动 | 记录 from→to 地点变更 |
| 资产注销 | 状态变更 + 原因记录 |
| 盘点报告 | 按地点分组 + 各状态统计 |
| 资产发票 OCR | 百度 OCR 识别 → 结构化 → 自动填充 |

### 2.3 数据模型（2 张表）

| 表名 | 说明 |
|------|------|
| pple_assets | 资产主表 |
| pple_asset_movements | 资产移动记录 |

### 2.4 API 端点（9 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 资产列表 |
| POST | / | 新增资产 |
| GET | /{id} | 资产详情 |
| PATCH | /{id} | 更新资产 |
| POST | /{id}/writeoff | 资产注销 |
| GET | /{id}/movements | 移动记录 |
| POST | /stocktake | 盘点报告 |
| GET | /print-labels | 打印标签 |
| DELETE | /{id} | 删除资产 |

---

## 3. 通用特性

### 3.1 权限

| 权限码 | 预置角色 |
|--------|---------|
| apple:finance:read/write | 总务主任、财务人员 |
| apple:assets:read/write | 总务主任、资产管理员 |
| apple:finance:approve / assets:approve | 总务主任、校长 |

### 3.2 异常处理

| 场景 | 错误码 | 处理方式 |
|------|--------|---------|
| 手写收据难辨认 | — | 拍照 OCR 自动识别 |
| DeepSeek 不可用 | 502 | 显示原因并回退本地保守规则 |
| 发票含多项/数量大于 1 | — | 不自动回填，提示逐项拆分 |
| 资产找不到 | 20001 | 状态改为 missing |
| 资产重复注销 | 40005 | 提示"已注销，无需重复操作" |
| 移动地点相同 | 40003 | 拒绝 + 提示 |

### 3.3 审计日志

| 操作 | 记录内容 |
|------|---------|
| 新增收入/支出 | user_id, record_id, amount, project |
| 审批支出 | user_id, record_id, approver, result |
| 新增资产 | user_id, asset_no, name, category |
| 资产移动 | user_id, asset_no, from→to |
| 资产注销 | user_id, asset_no, reason |

---

## 4. 代码结构

`
apps/api/app/modules/apple/finance/
├── models.py           # FinanceRecord, Quotation
├── schemas.py          # Pydantic 模型
├── repository.py       # 数据访问
├── service.py          # 业务逻辑
├── router.py           # API 路由
├── permissions.py      # 模块权限
└── tests/
    └── test_finance.py

apps/api/app/modules/apple/assets/
├── models.py           # Asset, AssetMovement
├── schemas.py          # Pydantic 模型
├── repository.py       # 数据访问
├── service.py          # 业务逻辑
├── router.py           # API 路由
├── permissions.py      # 模块权限
└── tests/
    └── test_assets.py
`

---

## 5. 测试

`ash
# 财务模块测试
cd apps/api && python -m pytest app/modules/apple/finance/tests/test_finance.py -v
# 资产模块测试
cd apps/api && python -m pytest app/modules/apple/assets/tests/test_assets.py -v
`

---

*文档版本: v1.0 · 编制日期: 2026-07-19 · 负责人: 同学 3*
