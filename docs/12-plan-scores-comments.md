# 规划文档：案例二 学成绩管理与分析 + AI 评语 + WhatsApp 推送

> 来源：需求收集表「示范案例二」
> 执行原则：AI 边开发边测试，一个模块没走通不进入下一阶段

---

## 模块依赖总图

```
模块 2.1 数据表 → 模块 2.2 成绩导入API → 模块 2.3 成绩统计服务
  → 模块 2.4 前端成绩页面 → 模块 2.5 AI评语 Prompt
  → 模块 2.6 评语生成服务 → 模块 2.7 评语审阅页
  → 模块 2.8 WhatsApp推送 → 模块 2.9 状态追踪
```

**前置依赖（与本项目已有的关系）：**
- 学生模块已存在（Student 表、class_name、parent_phone）
- DeepSeek AI 调用链路已存在（参考 OCR 结构化）
- 成绩记录 Tab 已存在（学生详情页，需扩展）
- 考勤 Excel 导入模式可参考

---

## 模块 2.1：数据表（0.5 天）

**任务：** 新建/扩展两张数据库表

### apple_exam_scores（考试成绩表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| student_id | varchar(64) FK | 关联学生 |
| exam_name | varchar(100) | 考试名称（如"2026上期中考"） |
| semester | varchar(20) | 学期 |
| subject | varchar(50) | 科目 |
| score | decimal(5,1) | 分数 |
| full_mark | decimal(5,1) | 满分（默认100） |
| created_at | datetime | |

唯一约束：`(student_id, exam_name, subject)`

### apple_score_comments（AI 评语表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| student_id | varchar(64) FK | 关联学生 |
| exam_name | varchar(100) | 关联考试 |
| comment_text | text | AI 生成的评语正文 |
| highlight_subject | varchar(50) | 最强科目 |
| improve_subject | varchar(50) | 需加强科目 |
| suggestion | text | 具体建议 |
| status | varchar(20) | pending（待审阅）/ confirmed（已确认）/ sent（已发送） |
| reviewed_by | int FK | 审核人 |
| reviewed_at | datetime | 审核时间 |
| created_at | datetime | |
| updated_at | datetime | |

### 索引

- `apple_exam_scores`：`(exam_name, subject)` 联合索引
- `apple_score_comments`：`(exam_name, status)` 联合索引

**验收标准：**
- [ ] 两张表可生成
- [ ] 唯一约束生效（同一学生同一考试同一科目不重复）

**与现有系统的关系：**
- `student_id` 关联 `apple_students.id`（已有）

---

## 模块 2.2：成绩导入 API（0.5 天）

**任务：** Excel 批量导入 + CRUD API

### 文件结构

```
apps/api/app/modules/apple/scores/
├── __init__.py
├── router.py
├── schemas.py
├── models.py       ← 模块 2.1
├── service.py
├── repository.py
```

### 端点清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /apple/scores/import | Excel 批量导入成绩 |
| GET | /apple/scores/exams | 考试列表（已导入的考试名称） |
| GET | /apple/scores/exams/{name} | 某次考试的全部成绩 |
| GET | /apple/scores/students/{id}/exams | 某学生历次考试成绩 |
| DELETE | /apple/scores/exams/{name} | 删除某次考试成绩 |

### Excel 导入格式

| 学号 | 姓名 | 语文 | 数学 | 英文 | 通识 |
|------|------|------|------|------|------|
| S26001 | 陈嘉怡 | 85 | 92 | 78 | 88 |
| S26002 | 张伟杰 | 62 | 55 | 70 | 65 |

- 参考考勤导入模式实现（`POST /students/{id}/attendance/import`）
- 科目列自动识别（列名作为 subject）
- 导入时校验学号是否存在

**验收标准：**
- [ ] 导入后数据正确写入 scores 表
- [ ] 重复导入同一考试覆盖旧数据
- [ ] 学号不存在时有明确错误提示

**与现有系统的关系：**
- 使用已有的 Excel 解析（openpyxl，已安装）
- 参考 `attendance_service.py` 的导入逻辑

**测试：**
- 准备 3 行测试 Excel → 导入 → 查询验证
- 准备含错误学号的 Excel → 确认错误提示

---

## 模块 2.3：成绩统计服务（0.5 天）

**任务：** 后端统计计算

### 统计函数

文件：`apps/api/app/modules/apple/scores/service.py`

```python
def calc_exam_stats(exam_name: str) -> ExamStats:
    """单科统计：平均分、最高、最低、合格率、分数段"""
    
def calc_class_stats(exam_name: str, class_name: str) -> ClassStats:
    """班级统计：各科平均分对比、班级排名"""
    
def calc_student_stats(student_id: str, exam_name: str) -> StudentStats:
    """个人统计：各科分数、总分、班级排名、年级排名、强弱科目标注"""
```

### 返回结构示例

```json
{
  "exam_name": "2026上期中考",
  "subject_stats": [
    { "subject": "语文", "avg": 72.5, "max": 95, "min": 38, "pass_rate": 0.82,
      "segments": { "A": 5, "B": 12, "C": 8, "D": 3 } }
  ],
  "class_stats": [
    { "class_name": "中五甲", "subjects": { "语文": 75.2, "数学": 68.3 } }
  ]
}
```

**分数段定义：** A(≥85) B(70-84) C(60-69) D(<60)

**验收标准：**
- [ ] 各科统计数字手动验证正确
- [ ] 排名计算正确（同分同名次）
- [ ] 空数据时返回 0 而非报错

**测试：**
- 插入测试数据 → 调用统计接口 → 人工核对

---

## 模块 2.4：前端成绩页面（1 天）

**任务：** 两个页面

### 页面 A：成绩导入与管理

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/`

- 考试列表 Tab（已导入的考试）
- 上传 Excel → 预览前 5 行 → 确认导入
- 点击某次考试 → 查看成绩表（可排序）
- 删除考试

### 页面 B：统计图表

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/{exam_name}/`

- 顶部统计卡片（总人数 / 各科平均分）
- 分数段分布柱状图（每科一个图）
- 班级平均分对比图
- 点击学生 → 个人成绩详情（各科分数 + 排名）

**前端图表库推荐：** Recharts（已有依赖）或 Chart.js

**验收标准：**
- [ ] 成绩表导入后数据展示正确
- [ ] 统计图表数字准确
- [ ] 页面加载/空数据状态正常

**与现有系统的关系：**
- 复用 `DataTable`、`StatsCard`、`UploadDropzone` 等通用组件
- 侧边栏新增「成绩管理」入口

---

## 模块 2.5：AI 评语 Prompt（0.5 天）

**任务：** 编写评语生成 Prompt + 联调

### Prompt 文件

路径：`apps/api/app/modules/apple/prompts/score_comment_zh_hk.md`

**输入数据：**
```json
{
  "student_name": "陈嘉怡",
  "class_name": "中五甲",
  "subjects": [
    { "name": "语文", "score": 85, "class_avg": 72.5, "rank": 3 },
    { "name": "数学", "score": 92, "class_avg": 68.3, "rank": 1 },
    { "name": "英文", "score": 78, "class_avg": 70.1, "rank": 8 }
  ],
  "total_rank": 2,
  "total_students": 35,
  "attendance_rate": 0.98
}
```

**Prompt 要求：**
1. 语气正面鼓励：先肯定优点，再提改进方向
2. 针对具体科目给出可操作建议
3. 每条约 80-120 字
4. 用繁体中文
5. 不编造数据，不确定时 confidence 返回 low

**输出 JSON：**
```json
{
  "fields": {
    "student_name": "陈嘉怡",
    "comment": "陈嘉怡同学本学期整体表现优异...",
    "highlight_subject": "数学",
    "improve_subject": "英文",
    "suggestion": "建议每日阅读英文短文...",
    "attendance_note": "全勤"
  },
  "confidence": "high",
  "warnings": []
}
```

**验收标准：**
- [ ] 对 3 个不同成绩水平的学生测试输出
- [ ] 评语有区分度（好学生和待提升学生评语不同）
- [ ] 没有编造数据

**与现有系统的关系：**
- 参考 `award_extract_zh_hk.md` 的 Prompt 格式
- 参考现有 AI 调用链路

---

## 模块 2.6：评语生成服务（0.5 天）

**任务：** 后端批量调用 DeepSeek 生成评语

### 服务函数

文件：`apps/api/app/modules/apple/scores/service.py`

```python
async def generate_comments_for_exam(exam_name: str, db: AsyncSession):
    """为某次考试所有学生批量生成评语"""
    
async def generate_comment_for_student(student_id: str, exam_name: str, db: AsyncSession):
    """为单个学生生成评语（重试机制）"""
```

### 流程

```
1. 查询 exam_scores 获取该次考试所有学生
2. 对每个学生组装输入数据（成绩 + 排名 + 出勤）
3. 调 DeepSeek API（每次一条，避免混淆）
4. 解析返回 JSON → 写入 score_comments 表
5. 状态设为 "pending"
6. 失败时重试 3 次，仍失败标注错误原因
```

**注意：** 不要一次性并发调用（DeepSeek 有频率限制），建议每次间隔 0.5 秒。

**验收标准：**
- [ ] 30 个学生的评语在 3 分钟内生成完成
- [ ] 所有评语写入 comments 表
- [ ] 失败的有错误记录

**测试：**
- 3 个学生 → 生成 → 验证内容和格式

---

## 模块 2.7：评语审阅页（0.5 天）

**任务：** 老师审阅 AI 生成的评语

### 页面

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/{exam_name}/comments/`

- 学生列表（姓名 / 班级 / 评语状态：待生成/待审阅/已确认/已发送）
- 点击某学生 → 评语详情弹窗
  - 左：成绩数据（各科分数 + 排名）
  - 右：AI 评语（可编辑文本框）
  - 操作：[确认通過] [退回重生成] [编辑后确认]
- 本页面的批量操作：底部浮动条「全部确认」

**验收标准：**
- [ ] 评语按状态分组展示
- [ ] 编辑后保存正常
- [ ] 批量确认正常

---

## 模块 2.8：WhatsApp 推送评语（0.5 天）

**任务：** 将确认后的评语推送给家长

### 实现

- 复用案例一的 `WhatsAppClient` 公共模块
- 消息格式：学生姓名 + 评语摘要 + PDF 附件（可选）

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /apple/scores/comments/{exam_name}/send | 推送已确认评语 |
| GET | /apple/scores/comments/{exam_name}/logs | 推送状态列表 |

**验收标准：**
- [ ] 已确认评语能推送
- [ ] 推送后状态更新为 sent

**与现有系统的关系：**
- WhatsApp 公共发送函数暂存在 `services/whatsapp_client.py`
- 发送日志共用 `apple_notification_logs` 表（或新建单独表）

**测试：**
- 先推送 1 条测试，确认正常后再批量

---

## 模块 2.9：推送状态追踪（0.5 天）

**任务：** 在评语页面加入发送状态看板

### 页面扩展

- 在评语审阅页加入状态栏
- 统计卡片：待推送 / 已推送 / 已读 / 失败
- 列表：每个学生的发送状态

**验收标准：**
- [ ] 统计卡片数据正确
- [ ] 点击刷新手动刷新状态

---

## 整体执行顺序

```
阶段1（Day 1）
模块 2.1 数据表 → 模块 2.2 导入API → 模块 2.3 统计服务
半小时        1小时          1小时

阶段2（Day 1-2）
模块 2.4 前端成绩页 → 模块 2.5 AI Prompt → 模块 2.6 评语生成
2小时           1小时          1小时

阶段3（Day 2-3）
模块 2.7 评语审阅 → 模块 2.8 WhatsApp推送 → 模块 2.9 状态追踪
1小时          1小时          0.5小时
```

**⚠️ 关键规则：**
1. 每完成一个模块，必须通过验收测试才能进入下一个
2. 模块 2.8（WhatsApp）若无法完成，可用模拟实现替代
3. AI 开发时若 Prompt 效果差，先调试通过再继续
4. 发现与现有功能冲突时，先修复兼容性问题再继续
