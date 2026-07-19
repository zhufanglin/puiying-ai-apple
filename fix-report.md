# 奖状 & 奖学金模块修复报告

> 修复日期：2026-07-19  
> 涉及文件：后端 5 个 / 前端 5 个 / 数据库 1 个

---

## 一、P0 — 严重问题（5 项）

### P0-1 审核记录丢失

**问题**：审核时只更新申请表的 `status` 字段，旧记录被覆盖，无审核历史。

**修复**：`service.py` [L280-L289](apps/api/app/modules/apple/awards/service.py#L280-L289) — 在 `review_scholarship` 中新增 `ScholarshipReview` 审计记录写入。

### P0-2 删除正在使用的模板导致 500

**问题**：删除已有关联奖状的模板时外键约束报错。

**修复**：`repository.py` [L77-L84](apps/api/app/modules/apple/awards/repository.py#L77-L84) — `delete_template` 先查关联奖状数，若有则返回业务错误。

### P0-3 审核状态可填任意字符串

**问题**：`status` 字段无约束，可存入 `"乱七八糟"` 等非法值。

**修复**：`schemas.py` [L184](apps/api/app/modules/apple/awards/schemas.py#L184) — 类型限定为 `Literal["approved", "rejected"]`。

### P0-4 存在两个功能重复的"确认"端点

**问题**：`POST /{id}/publish` 和 `POST /{id}/confirm` 功能相同但前端只调用后者，且 publish 路径注释与行为矛盾。

**修复**：
- 删除 `router.py` publish 路由、`service.py` publish 函数、`awards.ts` 前端调用
- `router.py` cancel 注释修正为 `"草稿/已核算 → 已取消"`

### P0-5 核算金额与状态不在同一事务

**问题**：`scholarship_amount` 写入和 `status` 变更分两次 `flush`，非原子。

**修复**：`service.py` [L393-L399](apps/api/app/modules/apple/awards/service.py#L393-L399) — 合并为单次 `flush`，且同步更新 `award.amount = total`。

---

## 二、P1 — 重要问题（8 项）

### P1-6 批量生成的奖状 issuer 恒为 None

**修复**：`schemas.py` `BatchGenerateRequest` 新增 `issuer` 可选字段，`router.py` 透传。

### P1-7 取消奖状不可逆

**修复**：`service.py` [L181-L184](apps/api/app/modules/apple/awards/service.py#L181-L184) — 仅允许 `draft` / `calculated` → `cancelled`，已确认的不可取消。

### P1-8 批量生成直接标记为"已确认"

**修复**：`router.py` [L518](apps/api/app/modules/apple/awards/router.py#L518) — status 改为 `"draft"`。

### P1-9 任何状态都能增删学生

**修复**：`service.py` [L198-L215](apps/api/app/modules/apple/awards/service.py#L198-L215) — 限制仅 `draft` / `calculated` 可操作。

### P1-10 核算规则无法解析中文金额后缀

**修复**：`[id]/page.tsx` 正则增加 `元|港元|圓|港幣` 清理。

### P1-11 API 返回值类型安全

**修复**：`page.tsx` 中使用正确的 `PaginatedData<T>` 泛型，移除 `as any`。

### P1-12 全部模板禁用时无提示

**修复**：`create/page.tsx` — `templates.length === 0` 时显示"暫無可用範本，請先啟用範本"。

### P1-13 草稿状态不能编辑

**修复**：`[id]/page.tsx` — `draft` / `calculated` 状态顶部出现"編輯"按钮，可修改标题、颁发部门、日期、备注。

---

## 三、P2 — 可优化项（8 项）

### P2-14 证书编号冲突无重试

**修复**：`router.py` [L537-L555](apps/api/app/modules/apple/awards/router.py#L537-L555) — `IntegrityError` 捕获，最多 3 次重试。

### P2-15 并发删学生人数计算错误

**修复**：`repository.py` [L207-L212](apps/api/app/modules/apple/awards/repository.py#L207-L212) — 原子递减 `UPDATE ... SET total_recipients = total_recipients - 1`。

### P2-16 创建奖状时人数设置两次

**修复**：`repository.py` [L175-L180](apps/api/app/modules/apple/awards/repository.py#L175-L180) — 用 `total_recipients + N` 原子增量替代 SELECT COUNT + SET。

### P2-17 核算结果刷新后丢失

**修复**：`service.py` 核算后持久化 `r.scholarship_amount = base`。

### P2-18 搜索无防抖

**修复**：`page.tsx` 奖状搜索 300ms 防抖。

### P2-19 创建按钮文案误导

**修复**：`create/page.tsx` — "保存草稿" → "建立並返回"，"建立奖状" → "建立並進入詳情"。

### P2-20 前后端各有一套中文数字解析

**修复**：前端移除 `chinese-number.ts` 依赖，统一由后端处理。

---

## 四、UI / 页面整合

| 改造项 | 说明 |
|--------|------|
| 导出证书改复选框 | 奖状/奖学金列表左侧新增复选框（含全选），勾选后底部浮动栏可批量导出 |
| 奖学金页迁移至总览 | 原 `/scholarships` 页面功能完整迁移到总览页 Tab，含 FilterBar 筛选、分页、审核操作、批量导出 |
| 快捷入口清理 | 移除页面中的"批量生成"、"导出证书"、"奖学金管理"三个快捷按钮 |
| Header 重组 | 三个操作按钮：`[新增獎狀]` `[提交申請]` `[統計分析]` |
| 删除冗余页面 | 删除 `/batch`、`/scholarships`（列表页）及 `/generate` 壳页面 |
| Tab 支持 URL 参数 | 访问 `?tab=scholarships` 自动切换，submit 后跳转即用 |
| 模板繁体化 | 数据库 5 条模板记录全部改为繁体字 |
| start.bat | `start /b` 替代 `start`，仅弹出一个窗口 |

---

## 五、数据库变更

```sql
ALTER TABLE apple_award_recipients ADD COLUMN scholarship_amount NUMERIC(10,2);
```

模板数据更新：

| 原值 | 新值 |
|------|------|
| 三好学生 | 三好學生 |
| 优秀班干部 | 優秀班幹部 |
| 进步之星 | 進步之星 |
| 体育标兵 | 體育標兵 |
| 文艺之星 | 文藝之星 |

---

## 六、已删除文件

| 文件 | 原因 |
|------|------|
| `apps/web/app/.../batch/page.tsx` | 功能已由总览页复选框 + 批量导出替代 |
| `apps/web/app/.../generate/page.tsx` | 仅做 `router.replace("/batch")` 的壳 |
| `apps/web/app/.../scholarships/page.tsx` | 功能已完整迁移至总览页 Tab |

---

## 七、涉及的模块文件

### 后端
- `apps/api/app/modules/apple/awards/service.py`
- `apps/api/app/modules/apple/awards/models.py`
- `apps/api/app/modules/apple/awards/schemas.py`
- `apps/api/app/modules/apple/awards/repository.py`
- `apps/api/app/modules/apple/awards/router.py`

### 前端
- `apps/web/app/(dashboard)/dashboard/apple/awards/page.tsx`
- `apps/web/app/(dashboard)/dashboard/apple/awards/[id]/page.tsx`
- `apps/web/app/(dashboard)/dashboard/apple/awards/create/page.tsx`
- `apps/web/app/(dashboard)/dashboard/apple/awards/scholarships/apply/page.tsx`
- `apps/web/lib/services/awards.ts`
- `apps/web/lib/types/awards.ts`

### 其他
- `start.bat`
- SQLite 数据库 (apple.db)
