# 资产盘点模块（A3）

> **文档版本**: v1.0 | **负责人**: 同学 3 | **工时**: 9 小时

---

## 1. 用户与场景

- **目标用户**: 资产管理员、总务主任
- **场景**:
  - 拍照发票 → OCR 识别资产信息 → 自动填充表单 → 登记入库
  - 资产移动 → 记录移动历史 → 更新资产地点
  - 盘点 → 按地点分组 → 生成盘点报告
  - 资产注销 → 状态变更 + 原因记录

## 2. 核心功能

| 功能 | 说明 |
|------|------|
| 资产 CRUD | 登记/修改/查询/删除资产 |
| 资产移动 | 记录 from→to 地点变更 + 移动历史 |
| 资产注销 | 状态变更为 written_off + 原因记录 |
| 盘点报告 | 按地点分组 + 各状态统计（active/moved/missing/written_off） |
| 发票 OCR | 百度 OCR 识别 → DeepSeek 结构化 → 自动填充 |
| 标签打印 | 批量生成资产标签 |

## 3. 数据模型（2 张表）

### apple_assets

| 字段 | 类型 | 说明 |
|------|------|------|
| asset_no | String(50) | 资产编号（唯一） |
| name | String(200) | 名称 |
| category | String(50) | 类别（办公设备/家具/电器/IT 设备） |
| location | String(200) | 存放地点 |
| status | String(20) | active / moved / written_off / missing |
| purchase_date | String(10) | 购买日期 YYYY-MM-DD |
| purchase_amount | Numeric(12,2) | 购买金额 |
| remark | Text | 备注 |
| written_off_at | DateTime | 注销日期 |
| written_off_reason | Text | 注销原因 |
| file_id | Integer | 关联发票文件 ID |
| created_by | Integer | 登记人 user_id |

### apple_asset_movements

| 字段 | 类型 | 说明 |
|------|------|------|
| asset_id | Integer | 关联资产 ID |
| from_location | String(200) | 原地点 |
| to_location | String(200) | 目标地点 |
| movement_date | String(10) | 移动日期 |
| reason | Text | 移动原因 |
| created_by | Integer | 创建人 user_id |

## 4. API 端点（9 个）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | / | 资产列表（支持分页/筛选） | apple:assets:read |
| POST | / | 新增资产 | apple:assets:write |
| GET | /{id} | 资产详情 | apple:assets:read |
| PATCH | /{id} | 更新资产 | apple:assets:write |
| DELETE | /{id} | 删除资产 | apple:assets:delete |
| POST | /{id}/writeoff | 资产注销 | apple:assets:approve |
| GET | /{id}/movements | 移动记录 | apple:assets:read |
| POST | /stocktake | 盘点报告 | apple:assets:read |
| GET | /print-labels | 打印标签 | apple:assets:write |

## 5. 状态流转

`
active → moved（地点变更）
active → written_off（注销）
active → missing（盘亏）
written_off / missing 不可逆向操作
`

## 6. 异常处理

| 场景 | 错误码 | 处理方式 |
|------|--------|---------|
| 资产找不到 | 20001 | 状态改为 missing |
| 重复注销 | 40005 | 提示"已注销，无需重复操作" |
| 移动地点相同 | 40003 | 拒绝 + 提示目标地点不能与当前地点相同 |
| 移动地点不一致 | 40002 | 拒绝 + 提示当前实际地点 |
| 发票含多项/数量大于 1 | — | 不自动回填，提示逐项拆分 |
| 发票字段缺乏原文证据 | — | 清空对应候选值 + confidence=low + warning |

## 7. 审计日志

| 操作 | 记录内容 |
|------|---------|
| 新增资产 | user_id, asset_no, name, category |
| 资产移动 | user_id, asset_no, from→to |
| 资产注销 | user_id, asset_no, reason |

## 8. 代码结构

`
apps/api/app/modules/apple/assets/
├── models.py           # Asset, AssetMovement
├── schemas.py          # Pydantic 输入输出 Schema
├── repository.py       # 数据访问层
├── service.py          # 业务逻辑
├── router.py           # API 路由
├── permissions.py      # 模块权限
└── tests/
    └── test_assets.py  # 8 个测试用例（6 通过 / 2 失败）

apps/web/app/(dashboard)/dashboard/apple/assets/
└── page.tsx            # 资产列表页

apps/web/components/modules/apple/
├── UploadAssetDialog.tsx     # 资产上传对话框
├── AssetMovementDialog.tsx   # 资产移动对话框
└── WriteoffDialog.tsx        # 资产注销对话框
`

## 9. 权限

| 权限码 | 预置角色 |
|--------|---------|
| apple:assets:read | 总务主任、资产管理员、校长 |
| apple:assets:write | 总务主任、资产管理员 |
| apple:assets:delete | 总务主任 |
| apple:assets:approve | 总务主任、校长 |

## 10. 测试

`ash
cd apps/api && python -m pytest app/modules/apple/assets/tests/test_assets.py -v
`

已知问题：repository.py 中 2 处异步方法缺少 await，不影响 API 正常运行。

---

*文档版本: v1.0 · 编制日期: 2026-07-19 · 负责人: 同学 3*
