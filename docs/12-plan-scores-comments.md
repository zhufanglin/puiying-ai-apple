# 规划文档：案例二 学成绩管理与分析 + AI 评语 + WhatsApp 推送

> 来源：需求收集表「示范案例二」
> 执行原则：AI 边开发边测试，一个模块没走通不进入下一阶段

---

## 模块依赖总图

```
纸质试卷/成绩单 → 电子文档(PDF/Word) → 整理后Excel → 系统
      ↓                    ↓                  ↓
 模块 2.2 拍照OCR     模块 2.3 文档解析   模块 2.4 批量导入
      │                    │                  │
      └────────────────────┴──────────────────┘
                         ↓
                  模块 2.5 人工核对界面
                         ↓
                    模块 2.6 统计服务
                         ↓
                    模块 2.7 前端图表
                         ↓
                  模块 2.8 AI评语Prompt
                         ↓
                  模块 2.9 评语生成服务
                         ↓
                 模块 2.10 评语审阅页
                         ↓
                模块 2.11 WhatsApp推送
                         ↓
                 模块 2.12 状态追踪
```

**前置依赖（与本项目已有的关系）：**
- 学生模块已存在（Student 表、class_name、parent_phone）
- DeepSeek AI 调用链路已存在（参考 OCR 结构化）
- 百度 OCR / PaddleOCR 引擎已可用（参考财务收据 OCR）
- 成绩记录 Tab 已存在（学生详情页，需扩展）
- 文件上传 API 已存在（`POST /api/v1/files/upload`）

---

## 模块 2.1：数据表（0.5 天）

**任务：** 新建/扩展数据库表

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
| source | varchar(20) | 数据来源：ocr / pdf / excel / manual |
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
| status | varchar(20) | pending / confirmed / sent |
| reviewed_by | int FK | 审核人 |
| reviewed_at | datetime | |
| created_at | datetime | |
| updated_at | datetime | |

### apple_raw_scores（原始采集数据临时表——OCR/PDF 提取后暂存）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| exam_name | varchar(100) | 考试名称 |
| source_type | varchar(20) | ocr / pdf / excel |
| source_file_id | int FK | 关联上传的文件 |
| raw_data | json | OCR/PDF 提取的原始 JSON |
| matched_data | json | 与学生匹配后的结构化数据 |
| status | varchar(20) | pending / matched / confirmed |
| confirmed_at | datetime | 人工确认时间 |
| created_by | int FK | |

### 索引

- `apple_exam_scores`：`(exam_name, subject)` 联合索引
- `apple_score_comments`：`(exam_name, status)` 联合索引

**验收标准：**
- [ ] 三张表可生成
- [ ] 唯一约束生效

---

## 模块 2.2：拍照/扫描 OCR 提取分数（1 天）

**任务：** 从纸质试卷照片中识别手写/印刷成绩

### 实现思路

利用现有 OCR 引擎（百度 OCR handwriting 模式 / PaddleOCR），识别成绩照片中的手写数字和表格。

```
拍照上传试卷 → OCR引擎识别文字数字
  → 后处理筛选分数 → 匹配学生姓名/学号
  → 写入 apple_raw_scores（source_type=ocr）
```

### 后端

路径：`apps/api/app/modules/apple/scores/ocr_score_service.py`

- 复用 `BaiduOcrBackend` 做文字识别
- 对 OCR 结果做后处理：提取数字、匹配姓名
- 学生姓名匹配：模糊匹配（考虑OCR识别偏差）

### 前端

- 上传成绩照片（单张或批量）
- 选择考试名称、科目
- 显示 OCR 提取结果（可编辑表格）

**验收标准：**
- [ ] 印刷体成绩单识别率 > 90%
- [ ] 手写数字识别率 > 70%
- [ ] 提取结果写入 raw_scores 表

**与现有系统的关系：**
- 复用 `POST /api/v1/ocr/baidu-recognize`
- 复用文件上传 API

---

## 模块 2.3：PDF/Word 电子文档解析（0.5 天）

**任务：** 从 PDF 成绩单、Word 文档中提取表格成绩

### 实现

路径：`apps/api/app/modules/apple/scores/document_score_service.py`

- PDF：用 `pypdf` / `pdfplumber` 提取表格数据
- Word：用 `python-docx` 提取表格
- 解析后按学号/姓名匹配学生
- 写入 `apple_raw_scores`（source_type=pdf）

**验收标准：**
- [ ] PDF 标准表格提取正常
- [ ] 提取后的数据可预览

**与现有系统的关系：**
- `pypdf` 已在 worker requirements 中
- `python-docx` 已在 api requirements 中

---

## 模块 2.4：Excel 批量导入（0.5 天）

**任务：** 将整理后的 Excel 成绩导入系统（路径与原有规划一致）

### 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /apple/scores/import | Excel 批量导入 |
| GET | /apple/scores/exams | 考试列表 |
| GET | /apple/scores/exams/{name} | 某次考试全部成绩 |
| DELETE | /apple/scores/exams/{name} | 删除 |

### Excel 格式要求

| 学号 | 姓名 | 语文 | 数学 | 英文 | 通识 |
|------|------|------|------|------|------|
| S26001 | 陈嘉怡 | 85 | 92 | 78 | 88 |

### 从原始采集到正式导入的流程

```
OCR/PDF 提取 → raw_scores（原始数据）
                  ↓ 人工核对确认
               Excel 导入（或直接确认转正）
                  ↓
               exam_scores（正式成绩表）
```

**验收标准：**
- [ ] 导入后数据正确写入
- [ ] 重复导入覆盖旧数据
- [ ] 学号不存在时有错误提示

---

## 模块 2.5：人工核对界面（0.5 天）

**任务：** 老师核对 OCR/PDF 提取结果

### 页面

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/review/`

- 考试名称选择 → 加载 raw_scores
- 列表：学生姓名 / OCR 识别分数 / 可编辑修正
- 操作：确认通过 / 重新识别
- 确认后数据转入 exam_scores 正式表

**验收标准：**
- [ ] 提取结果与原始文件可对照显示
- [ ] 编辑后保存正常
- [ ] 确认后数据进入正式表

---

## 模块 2.6：成绩统计服务（0.5 天）

**任务：** 后端统计计算

### 函数

文件：`apps/api/app/modules/apple/scores/service.py`

```python
def calc_exam_stats(exam_name)       # 单科统计
def calc_class_stats(exam_name, cls) # 班级统计
def calc_student_stats(student_id)    # 个人统计
```

### 返回结构

```json
{
  "subject_stats": [
    { "subject": "语文", "avg": 72.5, "max": 95, "min": 38, "pass_rate": 0.82,
      "segments": { "A": 5, "B": 12, "C": 8, "D": 3 } }
  ]
}
```

分数段：A(≥85) B(70-84) C(60-69) D(<60)

**验收标准：**
- [ ] 统计数字手动验证正确
- [ ] 排名正确（同分同名次）
- [ ] 空数据不报错

---

## 模块 2.7：前端成绩图表页面（1 天）

**任务：** 两个页面

### 页面 A：成绩管理

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/`

- 考试列表 Tab
- 上传原始材料入口（照片/PDF/Excel 三种方式）
- 人工核对入口
- 点击考试 → 查看成绩表

### 页面 B：统计图表

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/{exam_name}/`

- 统计卡片（总人数 / 各科平均分）
- 分数段分布柱状图
- 班级平均分对比图
- 个人成绩详情

**与现有系统的关系：**
- 复用 DataTable、StatsCard、UploadDropzone

---

## 模块 2.8：AI 评语 Prompt（0.5 天）

**任务：** 编写评语生成 Prompt

文件：`apps/api/app/modules/apple/prompts/score_comment_zh_hk.md`

**输入：** 学生姓名、班级、各科成绩、班级平均分、排名、出勤率

**输出：**
```json
{
  "fields": {
    "comment": "陈嘉怡同学本学期整体表现优异...",
    "highlight_subject": "数学",
    "improve_subject": "英文",
    "suggestion": "建议每日阅读英文短文..."
  },
  "confidence": "high|medium|low"
}
```

**要求：** 语气正面、80-120字、繁体中文、不编造数据

---

## 模块 2.9：评语生成服务（0.5 天）

**任务：** 批量调用 DeepSeek 生成评语

- 函数：`generate_comments_for_exam(exam_name)`
- 每个学生一条，间隔 0.5 秒避免限频
- 写入 score_comments 表，状态 pending
- 失败重试 3 次

---

## 模块 2.10：评语审阅页（0.5 天）

**任务：** 老师审阅 AI 评语

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/{exam_name}/comments/`

- 学生列表 + 评语状态（待生成/待审阅/已确认/已发送）
- 点击学生 → 评语弹窗（可编辑）
- 操作：[确认] [退回重生成] [编辑后确认]
- 批量确认

---

## 模块 2.11：WhatsApp 推送评语（1 天）

**任务：** 将已确认评语推送给家长

- 复用案例一的 WhatsAppClient 公共模块
- API：`POST /apple/scores/comments/{exam_name}/send`
- 消息内容：学生姓名 + 评语摘要
- 推送后状态更新为 sent

---

## 模块 2.12：推送状态追踪（0.5 天）

**任务：** 在评语页面加入发送状态看板

- 统计：待推送 / 已推送 / 已读 / 失败
- 列表：每个学生的发送状态

---

## 整体执行顺序

```
Day 1             Day 2             Day 3
2.1 数据表 → 2.2 OCR采集 → 2.3 PDF解析 → 2.4 Excel导入
0.5h       1天          0.5h         0.5h
                              →
                    2.5 人工核对 → 2.6 统计服务 → 2.7 前端图表
                    0.5h         0.5h         1天
                              →
                    2.8 AI Prompt → 2.9 评语生成 → 2.10 审阅页
                    0.5h          0.5h         0.5h
                              →
                    2.11 WhatsApp → 2.12 状态追踪
                    1天           0.5h
```

**⚠️ 关键规则：**
1. 每完成一个模块必须通过验收测试
2. 模块 2.2（OCR）和 2.3（PDF）可能同时进行（同学4和同学1各做一个）
3. WhatsApp 若无法完成可用模拟替代
4. 原始采集环节（2.2-2.5）与现有财务 OCR 共享引擎，注意不要冲突
