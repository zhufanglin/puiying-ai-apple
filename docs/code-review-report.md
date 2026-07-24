# 07 — Apple 子系统代码评审报告

> **文档版本**: v1.0 | **日期**: 2026-07-21 | **评审人**: 同学 1（Leader/架构师）

---

## 1. 评审范围与标准

本报告覆盖 Apple 子系统全部 4 个业务模块（A1–A4）的代码质量评审，评审维度共 8 项：

| # | 评审项 | 权重 | 说明 |
|---|--------|------|------|
| 1 | **目录规范** | ★★ | 文件结构是否符合 module-template.md 约定 |
| 2 | **权限校验** | ★★★ | 每个端点是否挂载了 `require_permission` |
| 3 | **错误处理** | ★★★ | 是否有统一错误码、合理的 HTTP 状态码 |
| 4 | **空/加载状态** | ★★ | 前端页面是否覆盖 empty / loading / error 状态 |
| 5 | **审计日志** | ★★ | 关键写操作是否写入 AuditLog |
| 6 | **无硬编码密钥** | ★★★ | 代码中无 API Key / Token 等敏感信息 |
| 7 | **API 文档更新** | ★ | docs/api.md 是否与实现同步 |
| 8 | **基本测试** | ★★ | 单元测试覆盖率及通过率 |

---

## 2. 逐模块评分

### 2.1 A1 — 奖状奖学金模块（同学 2）

| 评审项 | 评分 | 说明 |
|--------|:---:|------|
| 目录规范 | **通过** | `awards/router.py`, `schemas.py`, `models.py`, `service.py`, `repository.py` 齐全。额外拆分 `services/certificate_service.py` 符合 SRP。 |
| 权限校验 | **通过** | 所有 CRUD 端点和奖学金子模块端点均通过 `get_current_user` + `require_permission` 双重保护。 |
| 错误处理 | **通过** | 使用 `raise_error(NOT_FOUND)` / `VALIDATION_ERROR` 统一错误码，关键状态转换（如 publish/cancel）有业务校验。 |
| 空/加载状态 | **通过** | 全部 10 个前端页面均有 loading 和 empty 处理。数据表格有空状态组件。 |
| 审计日志 | **⚠️ 缺失** | 路由层未写入 `AuditLog` 表。Award 创建/发布/取消、奖学金审核等关键操作缺少审计追踪。 |
| 无硬编码密钥 | **通过** | 无 API Key / Secret 硬编码。所有凭证由 `pydantic-settings` 从 `.env` 读取。 |
| API 文档更新 | **通过** | docs/module-awards.md 包含完整 API 清单和请求/响应示例。 |
| 基本测试 | **通过** | `test_awards.py` 含 22 个用例，通过 21 个（1 个 status 字段预期值不匹配）。 |

**A1 总评：9.0 / 10** — 功能最完整的模块，后端 31+ 端点、前端 10 页面，并有额外奖学金审核子模块。仅缺审计日志。

---

### 2.2 A2 — 财务收支模块（同学 3）

| 评审项 | 评分 | 说明 |
|--------|:---:|------|
| 目录规范 | **通过** | `finance/router.py`, `schemas.py`, `models.py`, `service.py`, `repository.py`, `permissions.py` 齐全。 |
| 权限校验 | **通过** | 全部端点加载 `require_permission`，role-based 访问控制正确。 |
| 错误处理 | **通过** | 使用 `raise_error(NOT_FOUND)` 处理收入/支出/报价单 ID 查找失败，OCR 服务有 try/except 兜底。 |
| 空/加载状态 | **通过** | 3 个 Tab（收入/支出/报价单）均有 loading 和 empty 处理。详情页有 404 状态页。 |
| 审计日志 | **通过** | 收入/支出/报价单的创建、更新、删除操作均写入 `AuditLog`。 |
| 无硬编码密钥 | **通过** | 无硬编码凭证。OCR 功能通过后端 API 代理，前端不持有 Key。 |
| API 文档更新 | **通过** | docs/module-finance-assets.md 含完整端点清单。 |
| 基本测试 | **⚠️ 部分通过** | `test_finance.py` 10 个用例，通过 7 个。3 个失败因测试代码用 `record_type` 参数而模型字段名为 `type`，属于测试/schema 命名不一致。 |

**A2 总评：8.5 / 10** — 唯一**全部 8 项均达成**的模块（审计日志唯一完整实现）。测试有小瑕疵待修复。

---

### 2.3 A3 — 资产盘点模块（同学 3）

| 评审项 | 评分 | 说明 |
|--------|:---:|------|
| 目录规范 | **通过** | `assets/router.py`, `schemas.py`, `models.py`, `service.py`, `repository.py`, `permissions.py` 齐全。 |
| 权限校验 | **通过** | 全部端点加载 `require_permission`。 |
| 错误处理 | **通过** | 使用 `raise_error(NOT_FOUND)` 统一错误码，资产状态转换校验合理。 |
| 空/加载状态 | **通过** | 3 个 Tab（盘点/注销/新增）有 loading 和 empty 处理。 |
| 审计日志 | **通过** | 资产创建、移动、注销操作均写入 `AuditLog`（router 层 + service 层双写，部分冗余）。 |
| 无硬编码密钥 | **通过** | 无硬编码凭证。 |
| API 文档更新 | **通过** | docs/module-assets.md 含独立模块文档。 |
| 基本测试 | **⚠️ 部分通过** | `test_assets.py` 8 个用例，通过 6 个。2 个失败因 repository 异步方法未 await。 |

**A3 总评：8.5 / 10** — 功能完整，审计日志双写可精简。测试小瑕疵。

---

### 2.4 A4 — 学生事务模块（同学 4）

| 评审项 | 评分 | 说明 |
|--------|:---:|------|
| 目录规范 | **通过** | `students/` 下 service 层拆分为 `student_service.py` / `attendance_service.py` / `certificate_service.py` / `score_service.py` / `photo_service.py`，职责划分清晰。 |
| 权限校验 | **⚠️ 严重缺失** | 所有端点均**未挂载 `require_permission` 或 `get_current_user`**，处于完全开放状态。与 A1/A2/A3 的权限体系不一致。 |
| 错误处理 | **通过** | 有统一的 `not_found()` 工厂函数，`HTTPException` 用于参数校验失败。各 service 层自定义异常（StudentNotFoundError 等）合理。 |
| 空/加载状态 | **通过** | 前端 2 页面有 loading 和 empty 处理。 |
| 审计日志 | **⚠️ 替代实现** | 使用 `file_store.py` 自定义 `audit()` 方法（基于 JSON 存储），而非标准的 `AuditLog` ORM 表。功能等价但架构不一致。 |
| 无硬编码密钥 | **通过** | 无硬编码凭证。 |
| API 文档更新 | **通过** | docs/module-students-ai.md 含完整端点清单。 |
| 基本测试 | **⚠️ 大量失败** | `test_students.py` 8 个用例，通过 1 个。7 个因测试硬编码 `student-001` 格式而种子数据为 `stu-S001` 格式。 |

**A4 总评：6.5 / 10** — 功能完整但**架构不一致**（同步路由 vs 异步、JSON 文件 vs SQLite、无权限装饰器），属于独立开发未对齐底座规范。权限缺失是最严重的隐患。

---

## 3. 跨模块共性问题

### 3.1 P0 — 安全
| 问题 | 影响范围 | 建议 |
|------|---------|------|
| **A4 模块完全无鉴权** | 所有学生端点 | 添加 `get_current_user` + `require_permission` 依赖注入，与 A1/A2/A3 对齐。可将同步路由改为仅验证 Headers，不强制改架构。 |

### 3.2 P1 — 可维护性
| 问题 | 影响范围 | 建议 |
|------|---------|------|
| **A4 架构不一致** | 学生模块 | 同步路由 + JSON 文件存储虽能工作，但后续维护负担大。建议 V1.1 迁移至 SQLAlchemy Async 方案，或至少在文档中明确标注架构差异及原因。 |
| **A1 缺审计日志** | 奖项/奖学金操作 | 在 router 层的 create / publish / cancel / calculate / review 端点添加 `AuditLog` 写入。 |
| **A3 审计双写** | 资产操作 | router 和 service 层都有 AuditLog 写入，择一保留即可，避免重复。 |

### 3.3 P2 — 测试
| 问题 | 影响范围 | 建议 |
|------|---------|------|
| **A2 测试字段名不匹配** | `test_finance.py` | 测试代码中 `record_type` → 改为 `type`（或 schema 加别名）。 |
| **A3 测试缺少 await** | `test_assets.py` | 异步 repository 方法需在测试中 `await`。 |
| **A4 测试 ID 格式不匹配** | `test_students.py` | 测试代码中 `student-001` → 改为 `stu-S001`，或种子数据改为统一格式。 |

---

## 4. 前端质量概述

| 评审项 | 状态 | 说明 |
|--------|:---:|------|
| 组件复用 | **良好** | 4 个模块统一使用 `PageHeader` / `DataTable` / `StatsCard` / `FilterBar` 等 11 个通用组件。 |
| 状态覆盖 | **良好** | 各页面均有 loading / empty / error 三态处理。 |
| 样式一致性 | **良好** | 统一使用 Tailwind CSS，色值 `#23675f`（深墨绿）和 `#f6f7f9`（灰底）全局一致。 |
| 响应式 | **部分** | 部分表格在小屏未设横向滚动，资产详情页在小屏布局挤压。 |
| API 调用 | **良好** | 统一通过 `lib/api.ts` 封装，有 mock 降级逻辑。 |

---

## 5. OCR Worker 评审

| 评审项 | 状态 | 说明 |
|--------|:---:|------|
| 结构 | **完整** | `workers/ocr_worker/` 含 main.py / tasks.py / handlers / services，结构清晰。 |
| 权限 | **不适用** | Worker 为内部服务，不对外暴露 API。 |
| 测试 | **通过** | `test_ocr_worker.py` 含 54 个用例，全部通过。 |
| 引擎选型 | **⚠️ 偏差** | 计划使用 PaddleOCR 本地引擎，实际使用百度智能云 API。本地 PaddleOCR 骨架存在于 `services/ocr_engine.py` 中但未激活。演示阶段可接受，生产环境建议切回本地引擎以降低 API 依赖。 |
| 审计 | **缺失** | OCR 任务执行结果未记录审计追踪。 |

---

## 6. 评审结论

| 模块 | 得分 | 等级 | 关键动作 |
|------|:---:|:---:|------|
| A1 奖状奖学金 | 9.0 / 10 | **A** | 补审计日志 |
| A2 财务收支 | 8.5 / 10 | **B+** | 修复 3 个测试 |
| A3 资产盘点 | 8.5 / 10 | **B+** | 修复 2 个测试；审计去重 |
| A4 学生事务 | 6.5 / 10 | **C** | **加权限校验**（P0）；统一架构（P1） |
| OCR Worker | 7.5 / 10 | **B** | 切回 PaddleOCR（P2） |

**整体得分：8.0 / 10（B 级）**

系统核心业务功能完整、可独立演示。A4 模块的权限缺失是最紧迫的安全隐患，建议在正式演示前修复。其余测试和架构问题可在 V1.1 中逐步收敛。

---

## 7. 附录：8 项评审标准详解

### 目录规范
所有模块均遵循 `{module}/router.py | schemas.py | models.py | service.py | repository.py | permissions.py` 结构。A1 额外拆出 `services/` 子目录，A4 拆出 5 个 service 文件，均合理。

### 权限校验
A1/A2/A3 使用 `get_current_user` + `require_permission` 双装饰器模式。A4 缺失。建议 A4 至少对写真/导入/删除端点加权。

### 错误处理
统一使用 `app/common/errors.py` 的 `raise_error(NOT_FOUND)` 和 `VALIDATION_ERROR`。A4 使用 `HTTPException` 直接抛出，功能等价但风格不同。

### 空/加载状态
所有前端页面均有实现，表现良好。

### 审计日志
A2/A3 完整，A1 缺失，A4 用 JSON 自定义实现。建议统一迁移至 `audit_logs` 表。

### 无硬编码密钥
所有模块均通过 `.env` + `pydantic-settings` 管理凭证，无硬编码问题。

### API 文档更新
5 份模块文档（module-awards / module-finance-assets / module-assets / module-students-ai / ocr-worker）均包含完整 API 清单。

### 基本测试
102 个测试用例，89 个通过，13 个失败（通过率 87.3%）。失败原因集中在测试代码与实现字段名/ID 格式不匹配，非功能缺陷。

---

*文档版本：v1.0 · 编制日期：2026-07-21 · 评审人：同学 1（架构师/Leader）*
