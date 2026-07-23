# 规划文档：案例二 学成绩管理与分析 + AI 评语 + WhatsApp 推送

> 来源：需求收集表「示范案例二」
> 执行原则：AI 边开发边测试，一个模块没走通不进入下一阶段

---

## 核心思路

**和发票 OCR 是同样的原理，只是识别的东西不同。**

发票 OCR：先定义模板（金额、日期、付款人）→ 拍照 → 按模板识别对应位置 → 提取字段
试卷 OCR：先定义模板（姓名位置、题号、分值）→ 拍照 → 按模板识别 → 提取各题分数 → 汇总总分

## 模块依赖总图

```
先定义试卷模板 → 再按模板拍照识别 → 多张试卷汇总
      ↓                    ↓
 模块 2.2 模板管理   模块 2.3 按模板OCR
                           ↓
              模块 2.4 PDF/Word解析
                           ↓
                   模块 2.5 Excel导入
                           ↓
                    模块 2.6 人工核对
                           ↓
                     模块 2.7 统计服务
                           ↓
                     模块 2.8 前端图表
                           ↓
                   模块 2.9 AI评语Prompt
                           ↓
                  模块 2.10 评语生成服务
                           ↓
                   模块 2.11 评语审阅页
                           ↓
                  模块 2.12 WhatsApp推送
                           ↓
                   模块 2.13 状态追踪
```

**前置依赖（与本项目已有的关系）：**
- 学生模块已存在（Student 表、class_name、parent_phone）
- DeepSeek AI 调用链路已存在
- 百度 OCR / PaddleOCR 引擎已可用（与财务收据 OCR 共用）
- 文件上传 API 已存在

---

## 模块 2.1：数据表（0.5 天）

**任务：** 新建 4 张数据库表

### apple_exam_templates（试卷模板表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| name | varchar(100) | 模板名称（如"中五数学期末考"） |
| subject | varchar(50) | 科目 |
| full_mark | decimal(5,1) | 满分 |
| total_questions | int | 总题数 |
| config_json | text | 模板配置（JSON，见下方说明） |
| is_active | bool | 是否启用 |
| created_at | datetime | |

### config_json 结构

定义试卷排版，指导 OCR 如何解析：

```json
{
  "name_field": { "x_pct": 0.1, "y_pct": 0.05, "width_pct": 0.3, "hint": "学生姓名位置" },
  "questions": [
    { "no": 1, "max_score": 20, "x_pct": 0.85, "y_pct": 0.15, "hint": "第一题得分位置" },
    { "no": 2, "max_score": 15, "x_pct": 0.85, "y_pct": 0.25, "hint": "第二题得分位置" },
    { "no": 3, "max_score": 15, "x_pct": 0.85, "y_pct": 0.35, "hint": "第三题得分位置" }
  ],
  "total_field": { "x_pct": 0.85, "y_pct": 0.85, "hint": "总分位置" },
  "orientation": "portrait",
  "has_handwriting": true
}
```

`x_pct` / `y_pct` 为百分比坐标（0~1），标记识别区域在图片中的位置。这样不同分辨率的图片都能适配。

### apple_exam_scores（考试成绩表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| student_id | varchar(64) FK | 关联学生 |
| exam_name | varchar(100) | 考试名称 |
| template_id | int FK | 关联的试卷模板 |
| question_no | int | 题号 |
| score | decimal(5,1) | 该题得分 |
| full_mark | decimal(5,1) | 该题满分 |
| source | varchar(20) | ocr / pdf / excel / manual |
| created_at | datetime | |

唯一约束：`(student_id, exam_name, question_no)`

### apple_score_comments（AI 评语表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | 自增 |
| student_id | varchar(64) FK | |
| exam_name | varchar(100) | |
| comment_text | text | 评语正文 |
| highlight_subject | varchar(50) | 最强科目 |
| improve_subject | varchar(50) | 需加强科目 |
| suggestion | text | 建议 |
| status | varchar(20) | pending / confirmed / sent |
| reviewed_by | int FK | |
| reviewed_at | datetime | |
| created_at | datetime | |

### apple_raw_scores（原始采集临时表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | |
| exam_name | varchar(100) | |
| template_id | int FK | 关联的试卷模板 |
| source_type | varchar(20) | ocr / pdf / excel |
| source_file_id | int FK | |
| raw_data | json | OCR/PDF 提取的原始 JSON |
| matched_data | json | 与学生匹配后数据 |
| status | varchar(20) | pending / matched / confirmed |
| confirmed_at | datetime | |
| created_by | int FK | |

**验收标准：**
- [ ] 4 张表可生成
- [ ] 模板表 config_json 存储正常

---

## 模块 2.2：试卷模板管理（0.5 天）

**任务：** 老师创建和管理试卷模板

### 原理

和发票 OCR 一样的思路，只是从"定义发票字段"变成"定义试卷结构"：

```
发票模板：金额位置、日期位置、付款人位置
试卷模板：姓名位置、题号1位置(满分20)、题号2位置(满分15)、总分位置
```

### 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /apple/scores/templates | 模板列表 |
| POST | /apple/scores/templates | 新建模板 |
| PUT | /apple/scores/templates/{id} | 编辑模板 |
| DELETE | /apple/scores/templates/{id} | 删除模板 |
| GET | /apple/scores/templates/{id}/preview | 模板预览（标注识别区域） |

### 前端页面

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/templates/`

**新建模板流程：**
1. 填写基本信息：模板名称、科目、满分
2. 添加题目：每题填写题号、满分、在试卷上的大概位置（可上传示例图片标记）
3. 保存模板 → 存入 config_json

**模板预览：**
- 上传一张样卷图片
- 系统在图片上标记识别区域方框（姓名位置、各题位置）
- 老师可拖拽调整方框位置

**验收标准：**
- [ ] 模板增删改查正常
- [ ] config_json 结构正确
- [ ] 预览时标记位置正确

---

## 模块 2.3：按模板拍照 OCR 识别（1 天）

**任务：** 上传试卷照片，按所选模板的结构识别各题分数

### 流程

```
1. 老师选择试卷模板（告诉系统"我要识别哪套试卷的结构"）
2. 上传该科目的试卷照片（可多张，一个学生一张）
3. 系统按模板 config_json 中的坐标区域裁剪对应位置
4. 对裁剪区域做 OCR 识别，提取姓名和每题分数
5. 自动计算总分，与识别出的总分比对校验
6. 写入 apple_raw_scores（source_type=ocr）
```

### 关键实现

```python
def recognize_by_template(image_path, template_config):
    # 1. 按模板坐标裁剪姓名区域 → OCR 识别学生姓名
    # 2. 按模板坐标裁剪每题分数区域 → OCR 识别数字
    # 3. 校验：各题分数之和应该等于总分
    # 4. 与数据库学生表匹配（模糊匹配姓名）
```

### 和发票 OCR 的对比

| | 发票 OCR | 试卷 OCR |
|------|---------|---------|
| 识别目标 | 金额、日期、付款人 | 学生姓名、各题分数 |
| 模板驱动 | 定义字段位置 | 定义各题位置和满分 |
| OCR 引擎 | 百度 OCR handwriting | 百度 OCR handwriting |
| 后处理 | 金额格式校验 | 分数校验（各题之和=总分） |

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /apple/scores/recognize | 按模板识别试卷照片 |
| GET | /apple/scores/recognize/{id} | 查看某次识别结果 |

### 验收标准

- [ ] 按模板裁剪区域正确
- [ ] 印刷体姓名识别匹配学生成功
- [ ] 每题分数识别后汇总校验
- [ ] 同一班级多份试卷批量处理后汇总为成绩表

---

## 模块 2.4：PDF/Word 电子文档解析（0.5 天）

**任务：** 从 PDF 成绩单、Word 文档中提取表格成绩

- PDF：用 `pypdf` / `pdfplumber` 提取表格
- Word：用 `python-docx` 提取表格
- 写入 `apple_raw_scores`（source_type=pdf）

---

## 模块 2.5：Excel 批量导入（0.5 天）

**任务：** 将整理后的 Excel 成绩导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /apple/scores/import | Excel 批量导入（含校验） |

### 三种数据来源的最终流向

```
OCR拍照(2.3) ─┐
PDF/Word(2.4) ─┼─→ raw_scores → 人工核对(2.6) → exam_scores(正式表)
Excel(2.5) ────┘
```

---

## 模块 2.6：人工核对界面（0.5 天）

**任务：** 老师核对三种来源的提取结果

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/review/`

- 考试名称选择 → 加载 raw_scores
- 每个学生一行：姓名 / 各题识别分数 / 总分 / 置信度
- 可编辑修正
- 确认后转入 exam_scores 正式表

---

## 模块 2.7：成绩统计服务（0.5 天）

**任务：** 后端统计计算

```python
def calc_exam_stats(exam_name)       # 单科统计
def calc_class_stats(exam_name, cls) # 班级统计
def calc_student_stats(student_id)    # 个人统计
```

分数段：A(≥85) B(70-84) C(60-69) D(<60)

---

## 模块 2.8：前端成绩图表页面（1 天）

### 页面 A：成绩管理首页

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/`

- 考试列表
- 上传入口（按模板拍照 / PDF上传 / Excel导入）
- 人工核对入口

### 页面 B：统计图表

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/{exam_name}/`

- 统计卡片 + 分数段分布柱状图 + 班级对比 + 个人详情

---

## 模块 2.9：AI 评语 Prompt（0.5 天）

文件：`prompts/score_comment_zh_hk.md`

输入：学生各科成绩、排名、出勤
输出：繁体中文个性化评语，80-120 字

---

## 模块 2.10：评语生成服务（0.5 天）

批量调 DeepSeek，写入 score_comments（pending），失败重试 3 次

---

## 模块 2.11：评语审阅页（0.5 天）

路径：`apps/web/app/(dashboard)/dashboard/apple/scores/{exam_name}/comments/`

列表 + 编辑弹窗 + 批量确认

---

## 模块 2.12：WhatsApp 推送评语（1 天）

复用案例一的 WhatsAppClient
API：`POST /apple/scores/comments/{exam_name}/send`

---

## 模块 2.13：推送状态追踪（0.5 天）

统计看板：待推送 / 已推送 / 已读 / 失败

---

## 整体执行顺序

```
Day 1              Day 2              Day 3
2.1 数据表       2.3 按模板OCR      2.6 人工核对
2.2 模板管理     2.4 PDF解析        2.7 统计服务
   ↓              2.5 Excel导入       2.8 前端图表
                →                  →
                                   2.9 AI Prompt
                                   2.10 评语生成
                                   2.11 审阅页
                                   2.12 WhatsApp
                                   2.13 状态
```

**⚠️ 关键规则：**
1. 每个模块通过验收测试才能进下一个
2. 模板管理（2.2）是 OCR 识别（2.3）的前置条件
3. 原始采集（2.3+2.4+2.5）并行做，但都通过人工核对（2.6）后才能进统计
