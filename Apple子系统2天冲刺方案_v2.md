# 培英中学 AI 数智化平台 - Apple 子系统 2 天冲刺方案（v2）

> **文档版本**: v2.0（修订：5 人并行独立承担模块，不包含小陶老师统筹角色）  
> **适用场景**: 5 人小团队 2 天完成 Apple 子系统可演示版本  
> **配套材料**: Apple 需求收集表 + design.md 多人协作规范 + Tommy Demo 样板  
> **统筹说明**: 小陶老师不做执行，由同学 1 兼任 Leader；同学 5 承担汇总与质量把控

---

## 0. 总体目标

**2 天（48 小时）内交付 Apple 子系统可独立演示版本**

Apple 子系统包含 4 个功能模块：
- **A1**：奖状奖学金模块（事项一）
- **A2**：财务收支模块（事项二）
- **A3**：资产盘点模块（事项三）
- **A4**：学生事务模块（5 项核心职责的学生部分）

**人员分工**：5 人并行（其中同学 1 兼任 Leader，同学 5 兼任汇总）

---

## 1. 同学 1：架构师 / Leader（⭐⭐⭐⭐⭐ 统筹型）

**双重身份**：架构师（个人贡献）+ Leader（团队协调）

### Day 1（09:00～18:00，共 9 小时）

#### 上午 4 小时：项目初始化 + 架构底座

**09:00～09:30** 创建 monorepo 仓库结构
- 任务：建立 `school-ai-platform/` 目录
- 文件：`README.md`, `.gitignore`, `docker-compose.yml`
- 验收：可 git push 的空仓库
- ⚡ **优先级最高**：所有同学等待此步完成才能开始业务开发

**09:30～10:30** 搭建 FastAPI 后端骨架
- 路径：`apps/api/`
- 文件结构：
  ```
  apps/api/
  ├─ app/main.py             # FastAPI 入口
  ├─ app/core/
  │  ├─ config.py            # 环境变量
  │  ├─ security.py          # JWT 认证
  │  ├─ permissions.py       # 权限装饰器
  │  └─ logging.py           # 日志配置
  ├─ app/db/
  │  ├─ session.py           # SQLAlchemy session
  │  └─ base.py              # ORM 基类
  └─ app/common/
     ├─ schemas.py           # 通用 Pydantic
     ├─ pagination.py        # 分页
     └─ errors.py            # 错误码
  ```
- 验收：`uvicorn app.main:app --reload` 能启动

**10:30～11:30** 共用基础数据模型
- 路径：`apps/api/app/modules/`
- 文件清单：
  - `accounts/models.py`（users, roles, permissions）
  - `files/models.py`（files 表）
  - `ocr/models.py`（ocr_jobs 表）
  - `ai/models.py`（ai_jobs 表）
  - `audit/models.py`（audit_logs 表）
  - `approvals/models.py`（approvals 表）
- 验收：`alembic upgrade head` 能建表

**11:30～12:00** 全局权限规则 + 角色配置
- 文件：`apps/api/app/core/permissions.py`
- 角色定义（9 种）：admin / apple / danielle / steven / tommy / wendy / leung / reviewer
- 权限格式：`{module}:{resource}:{action}`
- Apple 模块权限列表：
  - `apple:awards:read` / `write` / `approve`
  - `apple:finance:read` / `write` / `approve`
  - `apple:assets:read` / `write` / `approve`
  - `apple:students:read` / `write` / `approve`

#### 下午 5 小时：4 个模块骨架 + 通用 API 规范 + Leader 协调

**13:00～14:30** 创建 Apple 4 个子模块目录骨架

路径：`apps/api/app/modules/apple/`

每个子模块结构：
```
apple/{module_name}/
├─ router.py        # API 路由
├─ schemas.py       # Pydantic 模型
├─ models.py        # SQLAlchemy ORM
├─ service.py       # 业务逻辑
├─ repository.py    # 数据访问
├─ permissions.py   # 模块权限
├─ tests/           # 单元测试
└─ prompts/         # AI Prompt 文件夹（同学 4 填充）
```

Apple 4 个子模块的数据库表：
- `apple_awards`（奖项主表）
- `apple_award_recipients`（奖项-学生关联表）
- `apple_finance_records`（收支记录表）
- `apple_quotations`（报价单表）
- `apple_assets`（资产表）
- `apple_asset_movements`（资产移动记录表）
- `apple_students`（学生信息表）
- `apple_attendance`（考勤表）
- `apple_certificate_requests`（证明申请表）

**14:30～16:00** 共用 API 接口规范（设计文档形式，不写代码）

文件：`docs/api.md`（OpenAPI 规范文档）

- 通用路由格式：`/api/v1/{module}/{resource}`
- 返回格式：
  - 成功：`{data, meta:{request_id}}` 或 `{data, pagination}`
  - 错误：`{error, meta}`
- 错误码：`VALIDATION_ERROR` / `UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND`

Apple 4 个模块的 API 清单（详见同学 2-4 任务卡）：

**通用接口**（同学 1 实现）：
- `POST   /api/v1/files/upload`
- `POST   /api/v1/ocr/jobs`
- `GET    /api/v1/ocr/jobs/{job_id}`
- `POST   /api/v1/ai/generate`
- `GET    /api/v1/audit/logs`

**16:00～17:00** Next.js 前端基础 + 通用组件库（设计文档 + 骨架）

路径：`apps/web/`

技术栈：Next.js 15 + TypeScript + Tailwind CSS

文件清单：
- `app/(dashboard)/layout.tsx`（Dashboard 布局）
- `components/layout/Sidebar.tsx`（按角色隔离的侧边栏）
- `components/layout/Topbar.tsx`
- `app/(dashboard)/dashboard/apple/page.tsx`（Apple 总览页）
- `components/ui/` 下 11 个通用组件（`PageHeader` / `StatsCard` / `DataTable` / `FilterBar` / `UploadDropzone` / `TaskStatusBadge` / `AiReviewPanel` / `ConfirmDialog` / `AuditTimeline` / `FormSection` / `EmptyState`）

**17:00～18:00** 编写模块设计文档模板 + Vibe Coding 任务卡模板
- 文件 1：`docs/module-template.md`（12 节标准模板，参考 design.md §13）
- 文件 2：`docs/vibe-coding-task.md`（10 项任务说明模板）

**Leader 协调任务**（贯穿全天）：
- 09:00 召集 5 人 kickoff（30 分钟，明确分工）
- 中午 12:00、下午 16:00 巡视各同学进度
- 18:00 召开 Day 1 总结会（15 分钟）

### Day 2（09:00～18:00，共 9 小时）

#### 上午 4 小时：评审 + 答疑 + 联调支持

**09:00～10:30** 评审同学 2-4 Day 1 代码

PR 检查项（参考 design.md §11.4）：
1. 目录规范
2. 权限校验
3. 错误处理
4. 空 / 加载状态
5. 审计日志
6. 无硬编码密钥
7. API 文档更新
8. 基本测试

**10:30～12:00** 处理联调阻塞 + 代码合并
- 处理 4 个模块的路由冲突
- 处理权限规则统一
- 处理审计日志格式统一
- 处理通用组件复用问题

#### 下午 5 小时：最终集成 + 文档收口

**13:00～15:00** 最终集成 + docker-compose 联调
- 确保 `docker-compose up` 可启动全栈
- 修复集成遗留 bug

**15:00～16:00** README + 演示数据脚本
- 文件：`scripts/seed_demo_data.py`（生成演示数据：3 个奖项 + 50 个学生 + 100 条收支 + 200 个资产）

**16:00～17:00** API 文档收口
- 生成完整 OpenAPI 文档（`docs/openapi.json`）

**17:00～18:00** 召集 Day 2 收尾会 + 演示彩排
- 5 人依次演示负责模块（5 分钟/人）
- 标记最终发布阻塞

### 同学 1 交付清单

- [ ] monorepo 完整骨架（含 Docker Compose）
- [ ] FastAPI 后端 + Next.js 前端可启动
- [ ] 通用组件库（11 个）+ 共用数据库表（6 张）
- [ ] Apple 4 个子模块的目录骨架（不写业务代码）+ 数据库表（9 张）
- [ ] 权限规则 + 审计日志机制
- [ ] 5 个通用 API（files / ocr / ai / audit / approvals）
- [ ] `docs/api.md` + `docs/module-template.md` + `docs/vibe-coding-task.md`
- [ ] 最终 README + 演示数据
- [ ] 代码评审报告（`docs/07-code-review-report.md`）
- [ ] 全栈集成成功

---

## 2. 同学 2：A1 奖状奖学金模块负责人（⭐⭐⭐⭐ 全栈型）

**角色**：A1 模块全栈负责人 + 前端负责人（兼管前端规范）

### 业务背景
- **频次**：一年 3 次（上学期 / 中六毕业礼 / 下学期）
- **痛点**：手动 Excel + Word 制作奖状、奖学金计算易错
- **AI 期望**：一键生成各类清单 + AI 校对文字数字
- **节省**：50-60%

### 前端交付物（4 个页面）

#### 页面 1：`/dashboard/apple/awards`（奖项总览）

路径：`apps/web/app/(dashboard)/dashboard/apple/awards/page.tsx`

- 顶部 4 个统计卡（本学期奖项数 / 待审核 / 已发奖学金 / 历史总额）
- 主表格（5 字段）：
  - 奖项名称 / 类别（學業 / 品行 / 服務 / 體育）/ 奖金金额 / 覆盖学生数 / 状态
- 行操作：[查看获奖名单] [核算奖学金] [生成奖状] [导出]
- 顶部主按钮：[+ 新增奖项]

#### 页面 2：`/dashboard/apple/awards/[id]`（奖项详情 + 奖学金核算）

路径：`apps/web/app/(dashboard)/dashboard/apple/awards/[id]/page.tsx`

- 三栏布局：
  - 左：获奖学生列表（学号 / 姓名 / 班级 / 科目成绩 / 排名）
  - 中：奖学金核算面板（输入金额 → 自动生成汇总表）
  - 右：AI 结果确认区
    - 字段来源：OCR 抽取「獎學金金額：HK$ 1,000」
    - 置信度：高 / 中 / 低
- 操作：
  - 上传获奖名单 Excel → AI 提取 → 用户确认
  - 一键核算奖学金（按规则：学业奖 1000、品行奖 500 等）
  - 生成 Excel 发放清单 + 回条（Word 模板）

#### 页面 3：`/dashboard/apple/awards/generate`（奖状批量生成）

路径：`apps/web/app/(dashboard)/dashboard/apple/awards/generate/page.tsx`

- 选择奖项 + 选择获奖学生（多选）
- 奖状模板预览（左侧实时预览，右侧表单）
- 字段：学校名 / 学生姓名 / 奖项名 / 颁奖日期 / 校长签名
- 主操作：[一键生成 N 张奖状 PDF] [打包下载 ZIP]
- 自动按读稿顺序排列（按級 / 班 / 學號）

#### 弹窗 - 奖状读稿制作

路径：`apps/web/components/modules/apple/AwardsScriptDialog.tsx`

- 字段：
  - 选择分类（按級 / 按班 / 按學號）
  - 预览读稿文本
- 主操作：[复制到剪贴板] [导出 Word]

### 后端交付物（API + 数据模型 + 服务）

#### 路径：`apps/api/app/modules/apple/awards/`

**文件 router.py（5 个端点）**：

```python
GET    /api/v1/apple/awards                          # 列表
POST   /api/v1/apple/awards                          # 新增
GET    /api/v1/apple/awards/{id}                     # 详情
PATCH  /api/v1/apple/awards/{id}                     # 更新
DELETE /api/v1/apple/awards/{id}                     # 删除
POST   /api/v1/apple/awards/{id}/recipients          # 添加获奖学生
POST   /api/v1/apple/awards/{id}/calculate           # 计算奖学金
POST   /api/v1/apple/awards/{id}/certificates        # 生成奖状 PDF
GET    /api/v1/apple/awards/{id}/script              # 生成读稿
```

**文件 schemas.py**：

```python
class AwardCreate(BaseModel):
    name: str                  # 奖项名
    category: str              # 學業 / 品行 / 服務 / 體育
    amount: Decimal            # 奖学金金额
    semester: str              # 上學期 / 下學期 / 畢業禮
    year: int

class AwardRecipientCreate(BaseModel):
    student_id: str
    score: Optional[float] = None
    ranking: Optional[int] = None

class CertificateRequest(BaseModel):
    template_id: str
    recipient_ids: List[str]
    signatory: str

class ScriptRequest(BaseModel):
    award_id: str
    group_by: Literal["grade", "class", "student_no"]
```

**文件 models.py**：

```python
class Award(Base):
    __tablename__ = "apple_awards"
    id, name, category, amount, semester, year
    created_at, updated_at, status

class AwardRecipient(Base):
    __tablename__ = "apple_award_recipients"
    id, award_id, student_id, score, ranking, status
    certificate_generated, certificate_pdf_url
```

**文件 service.py（核心业务逻辑）**：
- `calculate_scholarship()`：根据规则批量计算
- `generate_certificates()`：套用 Word 模板生成 PDF（使用 `docxtpl` 库）
- `generate_script()`：按 `group_by` 排序生成读稿文本
- 模板路径：`apps/api/templates/apple/certificate.docx`

### 文档交付物

路径：`docs/03-module-awards.md`

内容（12 节）：
1. 用户与场景（事项一业务背景）
2. 当前痛点
3. MVP 范围（本次交付功能）
4. 暂不实现（V2 计划）
5. 页面设计（4 个页面截图占位 + 设计说明）
6. 数据模型（ER 图 + 字段说明）
7. API 设计（5 个端点 + 请求 / 响应示例）
8. AI / OCR 流程（如有）
9. 权限规则（apple:awards:*）
10. 审计日志（关键操作记录）
11. 异常处理（失败场景）
12. 验收标准（用户验收清单）

### Day 1 任务分配

- **09:00**：参加 kickoff，确认分工
- **10:00～12:00**（等底座）：阅读 design.md，抄录同学 2 任务清单
- **13:00～14:30**（底座交付后）：前端页面 1（总览）+ 页面 2（详情）
- **14:30～16:30**：前端页面 3（生成）+ 弹窗
- **16:30～18:00**：mock 演示数据接入（3 个奖项 + 50 个学生）

### Day 2 任务分配

- **09:00～10:30**：后端 `router.py`（5 个端点）+ `schemas.py` + `models.py`
- **10:30～12:00**：`permissions.py` + 单元测试（≥5 个）
- **13:00～14:30**：`service.py`（`calculate_scholarship` + `generate_certificates`）
- **14:30～15:30**：`certificate.docx` 模板（docxtpl）
- **15:30～16:30**：联调 + 修复 bug
- **16:30～18:00**：编写 `docs/03-module-awards.md` + 验收测试

### 同学 2 交付清单

- [ ] awards 总览页 + 详情页 + 批量生成页 + 读稿弹窗
- [ ] 后端 5 个 API + 2 个数据模型
- [ ] 奖状 PDF 生成服务（docxtpl）
- [ ] 单元测试（至少 5 个）
- [ ] mock 演示数据（3 个奖项 + 50 学生获奖记录）
- [ ] `docs/03-module-awards.md` 模块文档

---

## 3. 同学 3：A2 财务 + A3 资产模块负责人（⭐⭐⭐ 中级全栈）

**角色**：A2 + A3 双模块全栈负责人

### 业务背景

#### A2：财务收支
- **频次**：收入每日多次、支出每月 2-3 次、报价单不定期
- **痛点**：手写收据难辨认、手动输入易错
- **AI 期望**：拍照 OCR 自动识别 + 一键生成清单
- **节省**：50-60%

#### A3：资产盘点
- **频次**：盘点一年一次（3-4 个月）、注銷不定期、新增按发票
- **痛点**：手写 REMARKS 难懂、盘点周期长
- **AI 期望**：扫描上传 + AI 校对 + 一键清单
- **节省**：40-50%

### 前端交付物（5 个页面 + 3 个弹窗）

#### 页面 1：`/dashboard/apple/finance`（财务总览）

Tabs：[收入] [支出] [报价单]

- **收入 Tab**：
  - 顶部 4 个统计卡（本月收入 / 待入账 / 已入账 / 单据数）
  - 主表格：日期 / 项目 / 金额 / 支付方式 / 经手人 / 状态
  - 操作：拍照上传收据 → AI OCR → 自动填充表单
- **支出 Tab**：
  - 表格：发票号 / 供应商 / 项目 / 金额 / 审批人 / 状态
  - 操作：上传发票 → OCR 提取
- **报价单 Tab**：
  - 表格：项目名 / 报价单位 / 报价金额 / 是否最低 / 备注
  - 自动高亮：单一报价、未采纳最低报价

#### 页面 2：`/dashboard/apple/assets`（资产总览）

Tabs：[盘点] [注銷] [新增]

- **盘点 Tab**：
  - 按地点分组（如：3 楼教員室、地下校務處）
  - 表格：资产编号 / 名称 / 类别 / 状态 / 备注
  - 状态分类：註銷 / 搬移 / 找不到
- **注銷 Tab**：
  - 表格：编号 / 名称 / 注銷原因 / 审批日期
- **新增 Tab**：
  - 上传发票 → 表单（自动填充）

#### 弹窗组件

- `UploadReceiptDialog`（手写收据 OCR 上传）
- `UploadAssetDialog`（资产扫描上传）
- `AssetMovementDialog`（资产搬移记录）

### 后端交付物（API + 数据模型 + 服务）

#### 路径 1：`apps/api/app/modules/apple/finance/`

- `router.py`
- `schemas.py`
- `models.py`（`FinanceRecord` + `Quotation` 两张表）
- `service.py`
- `repository.py`
- `tests/`

#### 路径 2：`apps/api/app/modules/apple/assets/`

- `router.py`
- `schemas.py`
- `models.py`（`Asset` + `AssetMovement` 两张表）
- `service.py`
- `repository.py`
- `tests/`

#### API 端点（finance 模块）

```python
GET    /api/v1/apple/finance/income
POST   /api/v1/apple/finance/income           # 支持 OCR 自动填充
GET    /api/v1/apple/finance/expense
POST   /api/v1/apple/finance/expense
GET    /api/v1/apple/finance/quotations
POST   /api/v1/apple/finance/quotations
POST   /api/v1/apple/finance/quotations/analyze       # 报价单分析
POST   /api/v1/apple/finance/address-labels           # 生成地址 LABEL
```

#### API 端点（assets 模块）

```python
GET    /api/v1/apple/assets
POST   /api/v1/apple/assets
GET    /api/v1/apple/assets/{id}/movements
POST   /api/v1/apple/assets/{id}/movements
POST   /api/v1/apple/assets/stocktake                 # 盘点任务
POST   /api/v1/apple/assets/{id}/writeoff             # 资产注銷
POST   /api/v1/apple/assets/print-labels              # 批量打印 LABEL
```

#### 核心服务逻辑

- `receipt_ocr_service.py`：调用 OCR API → 提取金额 / 日期 / 项目
- `quotation_analyze_service.py`：自动识别单一报价 / 未采纳最低报价
- `address_label_service.py`：批量生成地址 LABEL
- `stocktake_service.py`：盘点报告生成（按地点分组 + 状态分类）
- `asset_writeoff_service.py`：注銷流程（待审核 → 已审核 → 登记 Word 注銷目錄）

### 文档交付物

路径：`docs/04-module-finance-assets.md`

内容（12 节）：
1. 用户与场景（事项二 + 事项三业务背景）
2. 当前痛点
3. MVP 范围
4. 暂不实现
5. 页面设计（5 个页面截图占位 + 6 个 Tabs 设计说明）
6. 数据模型（ER 图 + 4 张表字段说明）
7. API 设计（9 个端点 + 请求 / 响应示例）
8. AI / OCR 流程（收据 OCR 流程图）
9. 权限规则（`apple:finance:*` + `apple:assets:*`）
10. 审计日志（关键操作记录）
11. 异常处理（OCR 失败、报价单格式异常）
12. 验收标准（用户验收清单）

### Day 1 任务分配

- **09:00**：参加 kickoff
- **10:00～12:00**（等底座）：阅读 design.md，抄录任务清单
- **13:00～15:00**（底座交付后）：finance 总览页（3 个 Tabs）
- **15:00～17:00**：assets 总览页（3 个 Tabs）+ 3 个弹窗
- **17:00～18:00**：mock 演示数据接入

### Day 2 任务分配

- **09:00～10:30**：finance 后端（router + schemas + models）
- **10:30～12:00**：finance service + repository + 单元测试
- **13:00～14:30**：assets 后端（router + schemas + models + service）
- **14:30～16:00**：`receipt_ocr_service` + `quotation_analyze_service`
- **16:00～17:00**：`stocktake_service` + `asset_writeoff_service`
- **17:00～18:00**：联调 + 编写 `docs/04-module-finance-assets.md` + 补测试

### 同学 3 交付清单

- [ ] finance + assets 总览页面（6 个 Tabs）
- [ ] 3 个弹窗组件
- [ ] 9 个 API 端点 + 4 张数据表
- [ ] OCR 收据识别服务（含 mock 数据）
- [ ] 报价单分析服务 + 资产盘点服务
- [ ] 单元测试（至少 8 个）
- [ ] `docs/04-module-finance-assets.md` 模块文档

---

## 4. 同学 4：A4 学生事务 + AI Prompt + OCR Worker（⭐⭐ 偏后端 + AI）

**角色**：A4 模块后端 + AI Prompt 工程师 + OCR Worker 负责人

### 业务背景 A4：学生事务
- **频次**：日常
- **痛点**：考勤需手输入、资料查询慢、证明书手动填写
- **解决方案**：Excel 导入 + 自动查询 + 模板自动套打

### 前端交付物（2 个页面）

#### 页面 1：`/dashboard/apple/students`（学生总览）

路径：`apps/web/app/(dashboard)/dashboard/apple/students/page.tsx`

- 顶部 4 个统计卡（在读学生 / 本月考勤异常 / 待补领 / 在学证明待发）
- 主表格：学号 / 姓名 / 班级 / 状态 / 操作
- 行操作：[查看详情] [考勤记录] [补领成绩表] [申请在学证明]
- 顶部操作：[Excel 批量导入] [+ 新增学生]

#### 页面 2：`/dashboard/apple/students/[id]`（学生详情）

路径：`apps/web/app/(dashboard)/dashboard/apple/students/[id]/page.tsx`

Tabs：[基本信息] [考勤记录] [成绩记录] [证明申请]

- **基本信息 Tab**：
  - 照片 + 学号 + 姓名 + 班级 + 入學日期 + 家长联系方式
- **考勤记录 Tab**：
  - 表格：日期 / 状态（出勤 / 遲到 / 缺席 / 病假）/ 備註
  - 操作：Excel 导入考勤
- **证明申请 Tab**：
  - 表格：申请日期 / 类型 / 状态 / 操作
  - 操作：[+ 申请在学證明] → 表单 → [一键生成 PDF]

### 后端交付物（学生事务模块）

#### 路径：`apps/api/app/modules/apple/students/`

- `router.py`
- `schemas.py`
- `models.py`（`Student` + `Attendance` + `CertificateRequest` 三张表）
- `service.py`
- `repository.py`
- `tests/`

#### API 端点

```python
GET    /api/v1/apple/students
POST   /api/v1/apple/students
GET    /api/v1/apple/students/{id}
PATCH  /api/v1/apple/students/{id}
DELETE /api/v1/apple/students/{id}
POST   /api/v1/apple/students/import                  # Excel 批量导入
GET    /api/v1/apple/students/{id}/attendance
POST   /api/v1/apple/students/{id}/attendance/import
GET    /api/v1/apple/students/{id}/certificates
POST   /api/v1/apple/students/{id}/certificates
GET    /api/v1/apple/students/{id}/certificates/{cid}/pdf
```

#### 核心服务

- `student_service.py`：CRUD + Excel 导入（使用 `openpyxl`）
- `attendance_service.py`：考勤记录 + 异常检测
- `certificate_service.py`：在学證明書 PDF 生成（`docxtpl`）
- 模板路径：`apps/api/templates/apple/student_certificate.docx`

### AI Prompt 工程（4 个 Prompt 文件）

#### 路径：`apps/api/app/modules/apple/prompts/`

**文件 1：`award_extract_zh_hk.md`**
- 用途：从 Excel / 文本中提取奖项信息 + 获奖学生
- 输入：原始文本 / Excel 路径
- 输出 JSON：
  ```json
  {
    "fields": {
      "award_name": "...",
      "category": "學業 / 品行 / 服務 / 體育",
      "recipients": [{"student_no": "...", "name": "...", "score": 0, "ranking": 0}]
    },
    "confidence": "low|medium|high",
    "warnings": [],
    "raw_text": "..."
  }
  ```
- 要求：不确定时 confidence 返回 low；不要编造学生姓名

**文件 2：`receipt_extract_zh_hk.md`**
- 用途：从手写收据图片 OCR 文本中提取结构化字段
- 输出 JSON：
  ```json
  {
    "fields": {
      "amount": 0.0,
      "currency": "HKD",
      "date": "YYYY-MM-DD",
      "payer": "...",
      "purpose": "..."
    },
    "confidence": "low|medium|high",
    "warnings": [],
    "raw_text": "..."
  }
  ```
- 要求：金额不确定时返回 null；手写字识别不出时 warnings 说明

**文件 3：`quotation_analyze_zh_hk.md`**
- 用途：分析报价单列表，识别异常
- 输出 JSON：
  ```json
  {
    "fields": {
      "single_bid": [],
      "non_lowest_chosen": [],
      "summary": "..."
    },
    "warnings": [],
    "confidence": "..."
  }
  ```

**文件 4：`student_certificate_zh_hk.md`**
- 用途：生成在学證明書内容（中文 + 英文）
- 输出 JSON：
  ```json
  {
    "fields": {
      "zh_content": "茲證明本校學生...",
      "en_content": "This is to certify that...",
      "issue_date": "YYYY-MM-DD"
    }
  }
  ```

### OCR Worker

#### 路径：`workers/ocr_worker/`

```
workers/ocr_worker/
├─ main.py                 # Celery 入口
├─ tasks.py                # 任务定义
├─ handlers/
│  ├─ receipt_handler.py
│  ├─ certificate_handler.py
│  └─ document_handler.py
├─ services/
│  └─ ocr_engine.py        # 封装 PaddleOCR / Tesseract
└─ tests/
```

#### 核心任务

- `process_ocr_job(job_id)`：处理 OCR 任务
- 流程：获取文件 → 调 OCR 引擎 → 调同学 4 的 Prompt → 结构化输出 → 写 ai_jobs 表

### 文档交付物

- `docs/05-module-students-ai.md`（学生事务模块文档，12 节标准）
- `docs/06-ocr-worker.md`（OCR Worker 技术文档，包含部署、调用、Prompt 设计规范）

### Day 1 任务分配

- **09:00**：参加 kickoff
- **10:00～12:00**（等底座）：阅读 design.md，抄录任务清单
- **13:00～14:30**（底座交付后）：students 总览页 + 详情页
- **14:30～16:00**：写 4 个 Prompt 文件
- **16:00～18:00**：OCR Worker 骨架（Celery + handlers）

### Day 2 任务分配

- **09:00～10:30**：students 后端 CRUD
- **10:30～12:00**：Excel 批量导入考勤
- **13:00～15:00**：attendance + certificate service
- **15:00～16:30**：OCR Worker 完整实现（调 PaddleOCR + Prompt）
- **16:30～17:30**：OCR 任务端到端测试
- **17:30～18:00**：联调 + 编写 `docs/05-module-students-ai.md` + `docs/06-ocr-worker.md` + 补测试

### 同学 4 交付清单

- [ ] students 总览 + 详情页（2 个页面）
- [ ] 学生模块 9 个 API + 3 张数据表
- [ ] Excel 批量导入考勤 + 在学證明 PDF 生成
- [ ] 4 个 AI Prompt 文件（按 design.md §10.2 规范）
- [ ] OCR Worker 完整实现（Celery + PaddleOCR）
- [ ] 单元测试（至少 8 个）
- [ ] `docs/05-module-students-ai.md` + `docs/06-ocr-worker.md`

---

## 5. 同学 5：汇总负责人 + 前端实现 + 质量把控（⭐⭐⭐⭐⭐ 架构 + 全栈）

**双重身份**：
1. 团队汇总负责人（负责项目级文档）
2. 前端核心实现者（负责 Apple 总览页 + 演示准备）

### 职责概览

| 类别 | 内容 |
|---|---|
| **汇总文档** | Apple 子系统总览文档 + 测试报告 + 演示手册 + 验收清单 |
| **前端实现** | Apple 总览页 + 演示数据展示 |
| **质量把控** | 4 个模块的端到端测试 + 集成验证 |
| **Leader 协助** | 帮助同学 1 做评审 + 协调跨模块冲突 |

### Day 1 任务分配

#### 上午 4 小时：基线准备 + 前端实现

**09:00**：参加 kickoff

**10:00～12:00**（等底座期间）：阅读所有需求材料 + 设计文档模板
- 精读 Apple 需求收集表（事项一/二/三）
- 精读 design.md（§1-§15）
- 精读 Tommy Demo（理解 UI 风格）

#### 下午 5 小时：汇总同学 1 底座文档 + Apple 总览页

**13:00～14:30**（同学 1 底座完成后）：编写项目级文档
- `docs/00-apple-system-overview.md`（Apple 子系统总览）
  - 4 个模块概览
  - 业务流程图（从上传→AI→确认→入库）
  - 数据流图（用户→前端→API→Worker→DB）
  - 演示场景设计

**14:30～16:00**：实现 Apple 总览页（`/dashboard/apple`）
- 欢迎信息 + 当前用户名
- 4 个模块卡片入口（奖项 / 财务 / 资产 / 学生）
- 最近任务列表（跨模块）
- 待办提醒
- 模块状态总览

**16:00～18:00**：编写 Apple 子系统级 README
- 项目简介
- 4 个模块入口说明
- 演示账号（apple / admin）
- 启动步骤

### Day 2 任务分配

#### 上午 4 小时：评审 + 测试报告 + 跨模块测试

**09:00～10:30**：评审同学 2-4 代码（协助同学 1）
- 重点评审：前端交互一致性、API 接口一致性、权限规则统一

**10:30～12:00**：编写 `docs/08-testing-report.md`
- 每个模块的测试覆盖率（≥60%）
- 已通过的测试列表
- 待修复的测试列表

**12:00～12:30**（联调会议）：协助主持跨模块联调

#### 下午 5 小时：演示 + 验收文档

**13:00～15:00**：跨模块端到端测试 + 修复
- 测试场景：从 Apple 总览页 → 进入奖项页 → 上传名单 → 核算奖学金 → 生成 PDF
- 测试场景：从 Apple 总览页 → 进入财务页 → 拍照收据 → OCR → 入账
- 标记测试失败的模块并修复

**15:00～17:00**：编写演示相关文档
- `docs/09-demo-guide.md`（演示手册）
  - 演示账号（apple / admin）
  - 4 个模块的 5 分钟演示脚本
  - 截图占位（同学 2-4 提供截图）
  - 常见问题 QA
- `docs/10-acceptance-checklist.md`（用户验收清单）
  - 按 Apple 需求表 4 大痛点逐一验证

**17:00～18:00**：演示彩排 + 文档定稿
- 5 人依次演示负责模块（5 分钟/人，同学 5 计时）
- 最终所有 docs 文件定稿

### 同学 5 交付清单

- [ ] `apps/web/app/(dashboard)/dashboard/apple/page.tsx`（Apple 总览页）
- [ ] `docs/00-apple-system-overview.md`（子系统总览）
- [ ] `docs/08-testing-report.md`（测试报告）
- [ ] `docs/09-demo-guide.md`（演示手册）
- [ ] `docs/10-acceptance-checklist.md`（验收清单）
- [ ] Apple 子系统级 README
- [ ] 端到端测试 4 个场景通过
- [ ] 5 人演示彩排完成

---

## 6. 时间线（48 小时冲刺）

### Day 0（今晚）
- **18:00** - 同学 1 创建 GitHub 仓库 + 邀请 4 人
- **19:00** - 同学 1 开始搭建 monorepo（夜间完成底座）
- **21:00** - 同学 1 push 底座代码
- **22:00** - 同学 2-5 clone 仓库熟悉结构

### Day 1（明天）
- **09:00 - 09:30** - 5 人集体 kickoff（同学 1 主持）
- **09:30 - 12:00** - 同学 1 搭建底座；同学 2-5 阅读规范 + 准备
- **12:00 - 13:00** - 午休 + 同学 1 完成底座
- **13:00 - 18:00** - 5 人并行开发（同学 1 评审 + 答疑 + 写规范）
- **18:00 - 18:15** - Day 1 站会（同学 1 主持）

### Day 2（后天）
- **09:00 - 12:00** - 评审 Day 1 代码 + 答疑 + 修复阻塞
- **12:00 - 12:30** - 联调会议（同学 1 主持）
- **13:00 - 17:00** - 端到端测试 + 修复 + 编写最终文档
- **17:00 - 18:00** - 演示彩排 + 交付发布

---

## 7. 最终交付清单（2 天后 18:00）

### 7.1 代码仓库
- [ ] GitHub 仓库地址（含 5 个人的 commit 记录）
- [ ] monorepo 结构完整可启动（`docker-compose up`）

### 7.2 可演示系统
- [ ] Apple 子系统完整可登录
- [ ] 4 个模块可独立演示（含 mock 数据 + 演示账号）
- [ ] 端到端测试 4 个场景通过

### 7.3 完整文档（11 份 `docs/*.md`）

| 文件 | 章节 | 来源 |
|------|------|------|
| `00-apple-system-overview.md` | 子系统总览 | 同学 5 |
| `01-infrastructure.md` | 基础设施 + ER 图 | 同学 1 |
| `02-api-design.md` | API 设计规范 | 同学 1 |
| `03-module-awards.md` | 奖状奖学金模块 | 同学 2 |
| `04-module-finance-assets.md` | 财务 + 资产模块 | 同学 3 |
| `05-module-students-ai.md` | 学生事务 + AI | 同学 4 |
| `06-ocr-worker.md` | OCR Worker | 同学 4 |
| `07-code-review-report.md` | 代码评审报告 | 同学 1 |
| `08-testing-report.md` | 测试报告 | 同学 5 |
| `09-demo-guide.md` | 演示手册 | 同学 5 |
| `10-acceptance-checklist.md` | 验收清单 | 同学 5 |

### 7.4 测试报告
- [ ] 单元测试覆盖率 > 60%
- [ ] 4 个模块端到端测试通过

---

## 8. 风险预案

### 风险 1：同学 1 底座延迟
- **应对**：同学 2-4 先用 mock 数据，等底座到位再接
- **触发条件**：Day 1 13:00 前未交付底座

### 风险 2：AI Prompt 效果差
- **应对**：用 few-shot 示例 + `temperature=0`
- **回退方案**：人工填写关键字段

### 风险 3：OCR 识别率低
- **应对**：提供手动修正界面
- **回退方案**：手动输入字段

### 风险 4：人员能力与任务不匹配
- **应对**：每日站会动态调整任务
- **回退方案**：同学 5 协调人员再分配

### 风险 5：模块间接口冲突
- **应对**：同学 1 集中处理 router + schema 冲突
- **回退方案**：同学 5 协助合并冲突

---

## 9. 协作规范

### 9.1 必用工具
- **Git + GitHub**：PR + Review 流程
- **Slack / 飞书群**：即时通讯
- **共享 Notion / 语雀**：文档库

### 9.2 提交规范
- 每个 PR 至少 1 位 reviewer 通过
- commit message 格式：`[模块] 动作：描述`
- 例：`[awards] feat: add certificate PDF generation`

### 9.3 沟通节奏
- Day 1 09:00 集体 kickoff（30 分钟，同学 1 主持）
- Day 1 18:00 站会（15 分钟）
- Day 2 12:00 联调会议（30 分钟，同学 5 协助主持）
- Day 2 17:00 演示彩排（60 分钟）

---

## 10. 5 人任务分布总览

| 同学 | 主角色 | 副角色 | 业务模块 | 主交付物 |
|------|--------|--------|----------|----------|
| **同学 1** | 架构师 / Leader | 代码评审 | 共享底座 | monorepo + 通用组件 + 评审报告 |
| **同学 2** | A1 模块负责人 | 前端规范协助 | 奖状奖学金 | A1 完整模块 + 文档 |
| **同学 3** | A2/A3 模块负责人 | 全栈 | 财务 + 资产 | A2 + A3 完整模块 + 文档 |
| **同学 4** | A4 模块 + AI 负责人 | 后端 + AI | 学生事务 + OCR | A4 完整模块 + 4 Prompt + OCR Worker + 文档 |
| **同学 5** | 汇总负责人 | Apple 总览页前端 | 项目级文档 | 总览页 + 4 份总文档 + 演示准备 |

---

## 11. 附录：每个同学的独立任务卡（可直接分发）

### 附录 A：同学 1 任务卡

```
【任务卡 - 同学 1：架构师 / Leader】
总工时：18 小时（Day 1 全天 + Day 2 全天）

□ Day 1 上午（底座搭建 + 权限）
  □ 09:00-09:30 创建 monorepo + 召集 kickoff
  □ 09:30-10:30 FastAPI 后端骨架
  □ 10:30-11:30 共用数据库表（6 张）
  □ 11:30-12:00 权限规则（9 角色 + Apple 权限）

□ Day 1 下午（4 模块骨架 + 通用组件）
  □ 13:00-14:30 Apple 4 个模块目录骨架（9 张表）
  □ 14:30-16:00 docs/api.md（设计规范）
  □ 16:00-17:00 Next.js 前端基础 + 11 个通用组件
  □ 17:00-18:00 docs/module-template.md + docs/vibe-coding-task.md

□ Day 2 上午（评审 + 答疑）
  □ 09:00-10:30 评审同学 2-4 Day 1 代码
  □ 10:30-12:00 处理联调阻塞 + 代码合并

□ Day 2 下午（集成 + 文档收口）
  □ 13:00-15:00 最终集成 + docker-compose 联调
  □ 15:00-16:00 README + 演示数据脚本
  □ 16:00-17:00 API 文档收口
  □ 17:00-18:00 主持 Day 2 收尾会 + 演示彩排

交付物：
✅ monorepo + FastAPI + Next.js 可启动
✅ 通用组件库 + 共用数据库表
✅ Apple 模块骨架（不写业务）+ 数据库表
✅ docs/api.md + docs/module-template.md + docs/vibe-coding-task.md
✅ 最终 README + 演示数据 + 集成测试
```

### 附录 B：同学 2 任务卡

```
【任务卡 - 同学 2：A1 奖状奖学金负责人】
总工时：18 小时
业务模块：A1 奖状奖学金（事项一）

□ Day 1 上午
  □ 09:00-10:00 参加 kickoff + 抄录任务清单
  □ 10:00-12:00 阅读 design.md + 准备

□ Day 1 下午（前端开发）
  □ 13:00-14:30 awards 总览页 + 详情页
  □ 14:30-16:30 批量生成页 + 读稿弹窗
  □ 16:30-18:00 mock 数据接入（3 奖项 + 50 学生）

□ Day 2 上午（后端开发）
  □ 09:00-10:30 router.py + schemas.py + models.py
  □ 10:30-12:00 permissions.py + 单元测试（≥5 个）

□ Day 2 下午（服务 + 文档）
  □ 13:00-14:30 service.py（奖学金计算 + PDF 生成）
  □ 14:30-15:30 certificate.docx 模板
  □ 15:30-16:30 联调 + 修复
  □ 16:30-18:00 docs/03-module-awards.md + 验收测试

交付物：
✅ awards 总览页 + 详情页 + 批量生成页 + 读稿弹窗
✅ 后端 5 个 API + 2 个数据模型
✅ 奖状 PDF 生成服务
✅ 单元测试 ≥5 个 + mock 演示数据
✅ docs/03-module-awards.md
```

### 附录 C：同学 3 任务卡

```
【任务卡 - 同学 3：A2 财务 + A3 资产负责人】
总工时：18 小时
业务模块：A2 财务收支 + A3 资产盘点（事项二 + 事项三）

□ Day 1 上午
  □ 09:00-10:00 参加 kickoff
  □ 10:00-12:00 阅读 design.md + 准备

□ Day 1 下午（前端开发）
  □ 13:00-15:00 finance 总览页（3 Tabs）
  □ 15:00-17:00 assets 总览页（3 Tabs）+ 3 个弹窗
  □ 17:00-18:00 mock 数据接入

□ Day 2 上午（finance 后端）
  □ 09:00-10:30 finance 后端（router + schemas + models）
  □ 10:30-12:00 finance service + repository + 单元测试

□ Day 2 下午（assets 后端 + 服务 + 文档）
  □ 13:00-14:30 assets 后端
  □ 14:30-16:00 receipt_ocr_service + quotation_analyze_service
  □ 16:00-17:00 stocktake_service + asset_writeoff_service
  □ 17:00-18:00 docs/04-module-finance-assets.md + 联调 + 补测试

交付物：
✅ finance + assets 总览页面（6 Tabs）+ 3 弹窗
✅ 9 个 API + 4 张数据表
✅ OCR + 报价单分析 + 资产盘点服务
✅ 单元测试 ≥8 个
✅ docs/04-module-finance-assets.md
```

### 附录 D：同学 4 任务卡

```
【任务卡 - 同学 4：A4 学生 + AI + OCR Worker】
总工时：18 小时
业务模块：A4 学生事务 + AI Prompt + OCR Worker

□ Day 1 上午
  □ 09:00-10:00 参加 kickoff
  □ 10:00-12:00 阅读 design.md + 准备

□ Day 1 下午（前端 + Prompt + OCR 骨架）
  □ 13:00-14:30 students 总览页 + 详情页
  □ 14:30-16:00 写 4 个 Prompt 文件
  □ 16:00-18:00 OCR Worker 骨架（Celery + handlers）

□ Day 2 上午（后端）
  □ 09:00-10:30 students 后端 CRUD
  □ 10:30-12:00 Excel 批量导入考勤

□ Day 2 下午（服务 + 文档）
  □ 13:00-15:00 attendance + certificate service
  □ 15:00-16:30 OCR Worker 完整实现
  □ 16:30-17:30 OCR 端到端测试
  □ 17:30-18:00 联调 + docs/05-module-students-ai.md + docs/06-ocr-worker.md + 补测试

交付物：
✅ students 总览 + 详情页（2 页面）
✅ 学生 9 个 API + 3 张数据表
✅ 4 个 AI Prompt 文件
✅ OCR Worker 完整实现
✅ 单元测试 ≥8 个
✅ docs/05-module-students-ai.md + docs/06-ocr-worker.md
```

### 附录 E：同学 5 任务卡

```
【任务卡 - 同学 5：汇总 + Apple 总览页 + 质量把控】
总工时：18 小时
业务模块：项目级汇总文档 + Apple 总览页

□ Day 1 上午
  □ 09:00-10:00 参加 kickoff
  □ 10:00-12:00 阅读所有需求材料 + 设计文档模板

□ Day 1 下午（汇总文档 + 总览页）
  □ 13:00-14:30 docs/00-apple-system-overview.md（子系统总览）
  □ 14:30-16:00 Apple 总览页 /dashboard/apple
  □ 16:00-18:00 Apple 子系统级 README

□ Day 2 上午（评审 + 测试报告）
  □ 09:00-10:30 协助评审同学 2-4 代码
  □ 10:30-12:00 docs/08-testing-report.md（测试报告）

□ Day 2 下午（端到端 + 演示 + 验收）
  □ 13:00-15:00 端到端测试 4 个场景 + 修复
  □ 15:00-17:00 docs/09-demo-guide.md + docs/10-acceptance-checklist.md
  □ 17:00-18:00 演示彩排 + 文档定稿

交付物：
✅ Apple 总览页 /dashboard/apple
✅ docs/00-apple-system-overview.md
✅ docs/08-testing-report.md
✅ docs/09-demo-guide.md
✅ docs/10-acceptance-checklist.md
✅ Apple 子系统级 README
✅ 5 人演示彩排完成
```

---

## 12. v2 版本更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.0 | 2026-07-16 19:50 | 初稿（6 人，包含小陶老师本人） |
| **v2.0** | **2026-07-16 19:59** | **调整为 5 人执行 + 小陶老师退居总指挥** |
| | | - 同学 5 同时承担"汇总负责人"和"Apple 总览页前端" |
| | | - 同学 1 兼任 Leader（保留架构师职责） |
| | | - 删除 v1 中的"小陶老师本人"角色 |
| | | - 任务卡附录数量从 5 份扩到 5 份（更清晰） |
| | | - 5 人职责完全独立，无单点依赖 |

---

*文档版本：v2.0 · 编制日期：2026-07-16 · 适用范围：培英中学 AI 数智化平台 Apple 子系统 2 天冲刺*
