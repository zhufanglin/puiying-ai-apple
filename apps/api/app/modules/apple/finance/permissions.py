"""A2 财务收支 — 模块权限

本模块需要的权限码:
- apple:finance:read     → 查看收入/支出/报价单列表
- apple:finance:write    → 新增/修改收支记录、报价单
- apple:finance:delete   → 删除收支记录

使用方式（router.py 中）:

    from app.core.permissions import require_permission, Permissions
    _ = Depends(require_permission(Permissions.FINANCE_READ))

所有权限常量统一在 core/permissions.py 中定义，
本文件仅作文档说明和模块级引用。
"""

from app.core.permissions import Permissions  # noqa: F401 — 供模块内统一引用
