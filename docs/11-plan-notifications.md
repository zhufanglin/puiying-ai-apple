# 规划文档：案例一 家校沟通——中英文通告 + WhatsApp 推送

> 来源：需求收集表「示范案例一」
> 执行原则：AI 边开发边测试，一个模块没走通不进入下一阶段

---

## 模块依赖总图

```
模块 1.1 数据表 → 模块 1.2 API + 模板 → 模块 1.3 AI 生成
  → 模块 1.4 前端页面 → 模块 1.5 WhatsApp → 模块 1.6 状态追踪
```

**前置依赖：**
- 模块 1.1 → 无（新建表）
- 模块 1.2 → 依赖 1.1
- 模块 1.3 → 依赖 1.2（模板数据就绪）
- 模块 1.4 → 依赖 1.2、1.3
- 模块 1.5 → 依赖 1.4（前端发送按钮就绪）
- 模块 1.6 → 依赖 1.5（WhatsApp 消息发出后）

---

## 模块 1.1：数据表（0.5 天）

**任务：** 新建两张数据库表

### apple_notice_templates（通告模板表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| name | varchar(100) | 模板名称（如"考试通知""家长会通知"） |
| category | varchar(50) | 分类（考试/活动/放假/其他） |
| zh_content_template | text | 中文内容模板（含占位符如 {{date}}） |
| en_content_template | text | 英文内容模板 |
| is_active | bool | 是否启用 |
| created_at | datetime | |
| updated_at | datetime | |

### apple_notifications（发送记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| template_id | int FK | 关联模板 |
| title_zh | varchar(200) | 中文标题 |
| title_en | varchar(200) | 英文标题 |
| content_zh | text | AI 生成的中文正文 |
| content_en | text | AI 生成的英文正文 |
| target_classes | text | 目标班级（JSON 数组格式） |
| status | varchar(20) | draft / sent / partial / failed |
| pdf_path | varchar(500) | 导出的 PDF 路径 |
| sent_at | datetime | 发送时间 |
| created_by | int FK | 创建人 |
| created_at | datetime | |

### apple_notification_logs（发送日志表——每条消息的追踪）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| notification_id | int FK | 关联发送记录 |
| parent_phone | varchar(20) | 家长 WhatsApp 号 |
| student_name | varchar(100) | 学生姓名 |
| message_status | varchar(20) | sent / delivered / read / failed |
| error_msg | varchar(500) | 失败原因 |
| status_updated_at | datetime | 状态更新时间 |
| created_at | datetime | |

**验收标准：**
- [ ] 三张表可通过 `Base.metadata.create_all` 生成
- [ ] 表关系正确（FK 指向正确）

**与现有系统的关系：**
- 学生模块的 `parent_phone` 字段已存在，`notification_logs.parent_phone` 直接对应
- 建议放在 `apps/api/app/modules/apple/notifications/models.py`

**测试：**
- 建表后插入一条测试数据，查询正常

---

## 模块 1.2：后端 API（0.5 天）

**任务：** 通告模块 CRUD API

### 文件结构

```
apps/api/app/modules/apple/notifications/
├── __init__.py
├── router.py
├── schemas.py
├── models.py       ← 模块 1.1
├── service.py
├── repository.py
```

### 端点清单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /apple/notifications/templates | 模板列表 |
| POST | /apple/notifications/templates | 新增模板 |
| PUT | /apple/notifications/templates/{id} | 编辑模板 |
| DELETE | /apple/notifications/templates/{id} | 删除模板 |
| GET | /apple/notifications | 发送记录列表 |
| POST | /apple/notifications | 新建通告（选模板 + 填占位符 + 选班级） |
| GET | /apple/notifications/{id} | 通告详情 |
| POST | /apple/notifications/{id}/send | 发送 WhatsApp |
| GET | /apple/notifications/{id}/logs | 发送日志（状态追踪） |

### 权限

- apple:notifications:read
- apple:notifications:write
- apple:notifications:send

### 验收标准
- [ ] 模板 CRUD 正常
- [ ] 新建通告后状态为 draft
- [ ] 发送后日志表写入记录

**与现有系统的关系：**
- 权限码参考 `apple:awards:read` 格式
- 审计日志参考 `AuditLog` 用法

**测试：**
- 每个端点至少一个正常用例 + 一个错误用例

---

## 模块 1.3：AI 中英文通告生成（0.5 天）

**任务：** 编写 Prompt + 后端调用 DeepSeek

### Prompt 文件

路径：`apps/api/app/modules/apple/prompts/notice_bilingual_zh_hk.md`

输入参数：
- 活动名称、日期、时间、地点
- 注意事项列表
- 回执要求（如需）

输出格式：
```json
{
  "fields": {
    "title_zh": "考试通知",
    "title_en": "Examination Notice",
    "content_zh": "尊敬的家长：...（正文，繁体中文）",
    "content_en": "Dear Parent, ...（正文，英文）",
    "reply_required": true
  },
  "confidence": "high|medium|low",
  "warnings": []
}
```

### 后端调用

- 文件：`apps/api/app/modules/apple/notifications/service.py`
- 函数：`generate_notice_with_ai(template_id, placeholders)`
- 流程：读取模板 → 填入用户输入 → 调 DeepSeek → 返回中英文文本

**验收标准：**
- [ ] AI 能正确生成中英文版本
- [ ] 内容一致，语气正式
- [ ] confidence 标注准确

**与现有系统的关系：**
- 参考 `receipt_extract_zh_hk.md` 的 Prompt 格式
- 参考现有 AI 调用链路（ocr-engine 或其他）

**测试：**
- 用实际模板调 DeepSeek，至少 3 次测试输出质量

---

## 模块 1.4：前端通告页面（1 天）

**任务：** 三个页面

### 页面 A：模板管理

路径：`apps/web/app/(dashboard)/dashboard/apple/notifications/templates/`

- 模板列表（名称 / 分类 / 启用状态）
- 新建模板：表单（名称 + 分类 + 中文模板 + 英文模板）
- 编辑/删除模板

### 页面 B：新建通告

路径：`apps/web/app/(dashboard)/dashboard/apple/notifications/create/`

- 选模板 → 填写占位符（日期/地点等）
- 点"AI 生成"→ 显示中英文预览
- 可选修改文本框内容
- 选择发送班级（多选）
- 草稿保存 / 发送

### 页面 C：发送记录

路径：`apps/web/app/(dashboard)/dashboard/apple/notifications/`

- 记录列表（标题 / 状态 / 发送时间 / 已读率）
- 点击详情：发送日志列表（每个家长的送达状态）
- 统计卡片：总发送 / 已读 / 未读 / 失败

**验收标准：**
- [ ] 页面 A：模板增删改查正常
- [ ] 页面 B：AI 生成后预览正常，可修改
- [ ] 页面 C：发送记录 + 状态统计显示正常

**与现有系统的关系：**
- 使用现有通用组件（DataTable、PageHeader、StatsCard）
- 侧边栏新增「通告管理」入口

**测试：**
- 每个页面手动操作一遍确认无报错

---

## 模块 1.5：WhatsApp 消息发送（1 天）

**任务：** 接入 WhatsApp Business API 发送消息

### 实现方案

有两种接入方式可选：

**方案 A：WhatsApp Business API（推荐）**
- 注册 Meta Business 账号 → 创建 WhatsApp Business 应用
- 配置 Webhook 接收状态回调
- 发送接口：`POST /{{version}}/{{phone-number-id}}/messages`
- 消息类型：template（需预先审核模板）或 text（免审核）

**方案 B：第三方服务（如 WATI / Twilio）**
- 申请 API Key → 直接调发送接口
- 支持自定义消息内容，无需预审模板
- 缺点：额外费用

### 后端实现

- 文件：`apps/api/services/whatsapp_client.py`
- 类：`WhatsAppClient`
- 方法：
  - `send_text(phone, text)` — 发送文本
  - `send_template(phone, template_name, params)` — 发送模板消息
  - `handle_webhook(payload)` — 处理送达/已读回执

### Webhook 处理流程

```
WhatsApp 回执 → POST /api/v1/webhooks/whatsapp
  → 解析 message_status（sent/delivered/read/failed）
  → 更新 apple_notification_logs.status_updated_at
```

### 消息队列

- 发送大批量（如整个年级）时用 Celery 任务异步处理
- 文件：`apps/api/app/modules/apple/notifications/tasks.py`
- 避免发送速率超限（WhatsApp 有频率限制）

**验收标准：**
- [ ] 能发送测试消息到真实 WhatsApp 号
- [ ] Webhook 能接收并解析回执
- [ ] 发送失败时更新状态并记录错误

**与现有系统的关系：**
- `parent_phone` 来自学生模块
- Celery 已有基础设施（参考 OCR Worker）
- Webhook 路由参考现有 router 模式

**测试：**
- 发送 1 条消息到真实手机
- 模拟 Webhook 回执确认状态更新
- 模拟发送失败场景

---

## 模块 1.6：发送状态统计看板（0.5 天）

**任务：** 前端展示发送统计

### 在发送记录详情页加入

- 统计卡片
  - ✅ 已读：X 人
  - 📨 已送达未读：X 人
  - ❌ 发送失败：X 人
- 明细列表（每人一条：学生姓名 / 家长号码 / 状态 / 时间）

**验收标准：**
- [ ] 状态统计数字正确
- [ ] 列表筛选正常（按状态筛选）

---

## 执行顺序建议

```
Day 1 上午       Day 1 下午       Day 2 上午       Day 2 下午
模块 1.1 → 模块 1.2 → 模块 1.3 → 模块 1.4 → 模块 1.5 → 模块 1.6
（0.5天）  （0.5天）  （0.5天）  （1天）    （1天）    （0.5天）
```

**⚠️ 关键规则：**
1. 每完成一个模块，必须通过验收测试才能进入下一个
2. 模块 1.5（WhatsApp）若因企业认证无法完成，可用模拟实现替代，标注"待接入"
3. AI 开发过程中如遇卡点（Prompt 效果差），不要跳过，先调试通过再继续
