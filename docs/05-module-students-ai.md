# A4 学生事务与 AI Prompt 模块

## 1. 用户与场景

目标用户是 Apple 校务文员。模块用于日常查询学生资料、批量导入学生与考勤 Excel、处理成绩表补领，以及生成在学证明。普通用户只能访问 Apple 工作台及其学生事务路由。

核心路由：

- 前端：`/dashboard/apple/students`、`/dashboard/apple/students/{id}`
- API：`/api/v1/apple/students`
- Prompt：`apps/api/app/modules/apple/prompts`

## 2. 当前痛点

- 考勤由人手逐笔输入，重复日期容易产生两份记录。
- 学生资料散落在 Excel 或其他模块，查询慢且字段格式不一致。
- 在学证明与成绩表补领依赖人工复制姓名、班级和学号。
- 学生及家长资料敏感，不能直接发送到未经评估的外部模型。
- 证明生成与下载缺少版本、哈希和审计记录。

## 3. MVP 范围

- 学生 CRUD、查询与状态管理。
- 学生 Excel 批量导入；按学号执行 upsert，作为保留的数据维护 API。
- 学生总览支持跨学生考勤 Excel 批量导入；详情页支持单个学生考勤导入，均按学生和日期执行 upsert。
- 出勤、迟到、缺席和病假四种考勤状态及异常统计。
- 考勤异常、成绩表待补领、在学证明待发均可下钻，并按时间、状态、班级或学生查询。
- 学生照片支持 JPG、PNG、WebP 上传，最大 5MB。
- 成绩记录由临时数据模拟，支持分页查询以及按学年、学期或科目导出 Excel。
- 在学证明与成绩表补领申请。
- 使用 `docxtpl` 套用学校 Word 模板，并输出 PDF。
- 所有新增、修改、删除、导入及生成动作写入 Apple 审计日志。

## 4. 暂不实现

- 不直接修改其他同学负责的学生主数据系统。
- 不接入 eClass、智能卡、闸机或教育局正式接口。
- 不自动认定缺席原因，也不根据考勤产生纪律结论。
- 不让外部大模型直接读取家长联系方式。
- 不提供电子签章；正式证明仍须授权人员签署及盖章。
- 不在当前文件适配器上实现多进程强一致事务；正式环境应切换 PostgreSQL。

## 5. 页面设计

### 5.1 学生总览

顶部显示在读学生、本月考勤异常、待补领和在学证明待发。后三张统计卡可点击进入待办区，支持时间、状态、班级及关键词筛选。主表显示学生照片、学号、姓名、班级、状态及必要行操作。页面顶部的 Excel 主操作用于跨学生批量导入考勤，文件列为学号、日期、状态和备注。

### 5.2 学生详情

详情页分为基本信息、考勤记录、成绩记录及证明申请四个 Tab。学生照片及家长联系方式在基本信息页显示；考勤、成绩和证明记录均提供分类、查询和分页。成绩可按当前学年、学期或科目条件导出 Excel；PDF 生成只在证明申请 Tab 出现。

## 6. 数据模型

正式 PostgreSQL 表契约位于 `students/models.py`，迁移位于 `apps/api/alembic/versions/20260717_01_add_students.py`：

| 表 | 关键字段 | 约束 |
| --- | --- | --- |
| `apple_students` | `student_no`、中英文姓名、班级、入学日期、家长联系方式 | 学号唯一；软删除状态 |
| `apple_attendance` | `student_id`、`attendance_date`、`status`、`remarks` | 学生与日期唯一 |
| `apple_certificate_requests` | 类型、语言、用途、状态、DOCX/PDF 路径 | 类型及状态检查约束 |

所有表包含创建／更新时间、操作人、最后复核人及来源文件字段。开发期 `repository.py` 使用 A4 专用的 `apps/api/data/apple_students_state.json`，不会修改其他同学的业务数据；正式接库时只需替换仓储实现。

## 7. API 设计

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/v1/apple/students` | 分页查询学生 |
| POST | `/api/v1/apple/students` | 新增学生 |
| GET | `/api/v1/apple/students/{id}` | 学生详情及四类 Tab 数据 |
| PATCH | `/api/v1/apple/students/{id}` | 修改资料 |
| DELETE | `/api/v1/apple/students/{id}` | 软删除学生 |
| POST | `/api/v1/apple/students/import` | 学生 Excel 批量导入 |
| POST | `/api/v1/apple/students/attendance/import` | 按学号跨学生批量导入考勤 |
| GET | `/api/v1/apple/students/work-items` | 分类、筛选并分页查询三类学生事务待办 |
| POST | `/api/v1/apple/students/photos` | 上传学生照片 |
| GET | `/api/v1/apple/students/photos/{photo_id}` | 读取学生照片 |
| GET | `/api/v1/apple/students/{id}/attendance` | 查询考勤 |
| POST | `/api/v1/apple/students/{id}/attendance/import` | 导入考勤 Excel |
| GET | `/api/v1/apple/students/{id}/scores` | 查询成绩记录 |
| GET | `/api/v1/apple/students/{id}/scores/export` | 按学年、学期或科目导出成绩 Excel |
| GET | `/api/v1/apple/students/{id}/certificates` | 查询证明申请 |
| POST | `/api/v1/apple/students/{id}/certificates` | 建立证明或补领申请 |
| GET | `/api/v1/apple/students/{id}/certificates/{cid}/pdf` | 生成并下载 PDF |

列表响应包含 `data` 和 `pagination`。导入响应必须返回新增、更新、跳过及逐行错误，不允许因为一行错误而丢弃整个批次。

## 8. AI／OCR 流程

```text
Excel／图片／文字
  → 文件落盘并记录哈希
  → OCR 或 Excel 解析
  → 标准 Prompt 产生结构化候选
  → needs_review
  → Apple 对照来源人工确认
  → 正式记录／DOCX／PDF
  → 审计日志
```

四个 Prompt 分别负责奖项提取、收据提取、报价分析和学生证明正文。每个 Prompt 包含模块、输入、JSON Schema、安全限制、示例输入与示例输出。收据流程支持用户选择 DeepSeek 模型并输入 API Key：Key 保存在浏览器 `sessionStorage`，调用时仅通过 `X-AI-API-Key` 请求头进入同步 API 请求，不写数据库、`AIJob`、日志、Redis 或 Celery；请求结束后后端不保留 Key。百度 OCR 的 AK/SK 则只通过 Worker 服务器环境变量注入，两类凭证分开管理。

启用 DeepSeek 时，系统只发送 OCR 文字、行顺序、坐标和置信度，不发送收据原图。界面必须明确提示文字将交由第三方模型处理，并由学校确认符合隐私政策。模型结果还需经过金额证据、日期、付款人／用途原文证据及 JSON Schema 校验；校验失败的字段清空，不能自动入库。

## 9. 权限规则

建议权限：

- `apple:students:read`
- `apple:students:write`
- `apple:attendance:import`
- `apple:certificates:create`
- `apple:certificates:generate`
- `apple:students:delete`

前端隐藏未授权操作只是体验措施，正式环境必须在后端再次校验。导出、删除、生成证明及确认 AI 结果均须写审计日志。

## 10. 审计日志

至少记录：

- `student.created`、`student.updated`、`student.deleted`
- `students.excel_imported`
- `attendance.excel_imported`
- `attendance.bulk_excel_imported`
- `student.photo_uploaded`
- `student_certificate.requested`
- `student_certificate.generated`

日志包含操作人、时间、资源 ID、来源文件 ID、变更字段或导入统计。日志不得写入家长电话、完整电邮、API Key 或 OCR 原图内容。

## 11. 异常处理

- 重复学号返回 HTTP 409。
- 缺少学生记录或证明申请返回 HTTP 404。
- 非 `.xlsx`、缺表头、日期／状态无效返回 HTTP 422，并给出逐行错误。
- 证明模板缺失返回 HTTP 503，不建立伪造 PDF。
- LibreOffice 不可用时使用 ReportLab 生成等价双语 PDF；仍保留已填充 DOCX。
- AI／OCR 低信心结果进入 `needs_review`，不得自动保存为正式记录。

## 12. 验收标准

1. 学生总览显示四张统计卡及指定表格操作。
2. 学生详情四个 Tab 可独立加载。
3. 学生总览可跨学生导入考勤，详情页可导入单个学生考勤，重复键执行更新。
4. 错误行不会阻塞有效行，并返回行号。
5. 可创建在学证明及成绩表补领申请。
6. PDF 使用 Word 模板数据生成，并可下载。
7. 学号、姓名、班级和日期未经确认不会由 AI 编造。
8. 关键操作均产生审计日志。
9. ORM 三表与 SQL 迁移字段一致。
10. 学生、Worker 与 API 测试通过，前端生产构建通过。
11. 三类统计待办可下钻，并按时间、状态、班级与学生资料分类查询。
12. 学生照片可在新增学生时上传，并在总览及详情显示。
13. 考勤、成绩和证明 Tab 均支持分页、分类和查询。
14. 成绩可按学年、学期或科目导出为 Excel。
