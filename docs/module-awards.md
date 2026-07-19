# A1 奖状奖学金模块

> **文档版本**: v1.0 | **负责人**: 同学 2 | **工时**: 18 小时

---

## 1. 用户与场景

- **目标用户**: 德育主任、级组长、班主任
- **场景**:
  - 德育主任定义奖状模板（三好学生、优秀班干部等）→ 批量颁发奖状 → 生成证书编号
  - 学生提交奖学金申请 → 管理员审核（approved/rejected）→ 金额追加工资

## 2. 核心功能

| 功能 | 说明 |
|------|------|
| 奖状模板管理 | 定义奖状类型、分类（学业/品德/活动/其他） |
| 奖状颁发 | 一次活动可包含多名获奖学生，自动生成证书编号 |
| 状态流转 | draft → published → cancelled |
| 获奖学生管理 | 批量新增、删除获奖学生记录 |
| 奖学金申请 | 学生提交申请（含金额、类别、学年学期） |
| 奖学金审核 | 管理员审核（approved/rejected），金额追踪 |
| 统计概览 | 奖状数量、奖学金申请统计 |

## 3. 数据模型（5 张表）

| 表名 | ORM 模型 | 说明 |
|------|---------|------|
| pple_award_templates | AwardTemplate | 奖状模板（名称、分类、样式） |
| pple_awards | Award | 奖状/颁发活动主表 |
| pple_award_recipients | AwardRecipient | 获奖学生关联表 |
| pple_scholarship_applications | ScholarshipApplication | 奖学金申请 |
| pple_scholarship_reviews | ScholarshipReview | 审核记录 |

## 4. API 端点（16 个）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /templates | 模板列表 |
| POST | /templates | 创建模板 |
| GET | /templates/{id} | 模板详情 |
| PUT | /templates/{id} | 更新模板 |
| DELETE | /templates/{id} | 删除模板 |
| GET | / | 奖状列表 |
| POST | / | 创建奖状（含 recipients） |
| GET | /{id} | 奖状详情 |
| POST | /{id}/publish | 发布奖状 |
| POST | /{id}/cancel | 取消奖状 |
| GET | /statistics | 统计概览 |
| POST | /batch-generate | 批量生成证书 |
| GET | /scholarships | 奖学金申请列表 |
| POST | /scholarships/{id}/review | 审核奖学金 |
| GET | /{id}/recipients | 获奖学生列表 |
| DELETE | /recipients/{id} | 删除获奖学生 |

## 5. 状态流转

`
奖状: draft → published → cancelled（不可逆向）
奖学金: pending → approved/rejected（不可重审）
`

## 6. 代码结构

`
apps/api/app/modules/apple/awards/
├── models.py           # 5 个 ORM 模型
├── schemas.py          # Pydantic 请求/响应
├── repository.py       # 数据访问层
├── service.py          # 业务逻辑（状态流转校验）
├── router.py           # 16 个 API 端点
├── permissions.py      # 模块权限
├── prompts/            # AI Prompt 文件
├── services/           # 额外服务
└── tests/
    └── test_awards.py  # 单元测试
`

## 7. 测试

`ash
# 运行测试
cd apps/api && python -m pytest app/modules/apple/awards/tests/test_awards.py -v
`

## 8. 注意事项

- State 限制：仅允许 draft→published 或 */published→cancelled
- 级联删除：删除奖状时级联删除关联获奖记录（cascade="all, delete-orphan"）
- 唯一约束：certificate_no 设置 unique=True
- 人数同步：增减获奖学生时自动更新 Award.total_recipients
- 审核追溯：ScholarshipReview 记录不可修改或删除

---

*文档版本: v1.0 · 编制日期: 2026-07-19 · 负责人: 同学 2*
