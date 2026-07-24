# A4 学生事务 + AI Prompt 模块

> **文档版本**: v1.0 | **负责人**: 同学 4 | **工时**: 18 小时

---

## 1. 用户与场景

- **目标用户**: Apple 校务文员、班主任
- **场景**:
  - 日常查询学生资料
  - 批量导入学生与考勤 Excel
  - 处理成绩表补领
  - 生成在学证明

## 2. 核心功能

| 功能 | 说明 |
|------|------|
| 学生 CRUD | 新增/查询/编辑/删除学生 |
| Excel 批量导入 | 按学号 upsert 学生数据 |
| 考勤管理 | 单生/跨学生 Excel 导入，异常识别 |
| 成绩管理 | 按学年/学期/科目筛选 + Excel 导出 |
| 在学证明 | docxtpl 套用 Word 模板 → PDF 输出 |
| 照片上传 | JPG/PNG/WebP，最大 5MB |
| 统计数据 | 在学人数、考勤异常、待办事项 |

## 3. 数据模型（3 张表）

| 表名 | ORM 模型 | 说明 |
|------|---------|------|
| pple_students | Student | 学生信息（学号、姓名、班级、状态） |
| pple_attendance | Attendance | 考勤记录（学生+日期+状态+备注） |
| pple_certificate_requests | CertificateRequest | 证明申请（类型、语言、状态） |

## 4. API 端点（9 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 学生列表（支持搜索筛选） |
| POST | / | 新增学生 |
| GET | /summary | 统计数据（在学人数、待办） |
| GET | /work-items | 待办事项 |
| GET | /{id} | 学生详情 |
| PATCH | /{id} | 更新学生 |
| POST | /photos | 上传照片 |
| POST | /attendance/import | 跨学生考勤 Excel 导入 |
| POST | /{id}/certificates | 创建在学证明申请 |

## 5. AI Prompt 文件

存放在 pps/api/app/modules/apple/prompts/

| 文件 | 用途 |
|------|------|
| ward_extract_zh_hk.md | 奖项及获奖学生提取 |
| eceipt_extract_zh_hk.md | 手写收据 OCR 文字结构化 |
| quotation_analyze_zh_hk.md | 单一报价及非最低价中标分析 |
| student_certificate_zh_hk.md | 中英文在学证明正文候选 |
| invoice_asset_extract_zh_hk.md | 发票资产信息提取 |

## 6. 不实现的范围

- 不修改其他同学负责的学生主数据系统
- 不接 eClass、智能卡、闸机或教育局正式接口
- 不自动认定缺席原因，不根据考勤产生纪律结论
- 不让外部大模型直接读取家长联系方式
- 不提供电子签章；正式证明仍需授权人员签署及盖章

## 7. 代码结构

`
apps/api/app/modules/apple/students/
├── models.py              # Student, Attendance, CertificateRequest
├── schemas.py             # Pydantic 输入输出
├── repository.py          # 数据访问
├── service.py             # 模块导出
├── student_service.py     # CRUD、档案导入、统计、待办
├── attendance_service.py  # 考勤 Excel 导入 + 异常识别
├── score_service.py       # 成绩筛选 + Excel 导出
├── photo_service.py       # 照片上传校验 + 读取
├── certificate_service.py # docxtpl 套表 + PDF 生成
├── file_store.py          # A4 专用文件适配器
├── router.py              # API 路由
└── tests/
    └── test_students.py   # 单元测试

apps/web/app/(dashboard)/dashboard/apple/students/
├── page.tsx               # 学生总览页
├── [id]/page.tsx          # 学生详情页
├── components.tsx         # 页面子组件
└── layout.tsx             # 布局
`

## 8. 测试

`ash
cd apps/api && python -m pytest app/modules/apple/students/tests/test_students.py -v
`

---

*文档版本: v1.0 · 编制日期: 2026-07-19 · 负责人: 同学 4*
