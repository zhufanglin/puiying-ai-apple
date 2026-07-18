"""A3 资产盘点 — 模块权限

本模块需要的权限码:
- apple:assets:read     → 查看资产列表、搬移记录、盘点报告
- apple:assets:write    → 登记/修改资产、记录搬移
- apple:assets:delete   → 删除资产
- apple:assets:approve  → 审批资产注销

使用方式（router.py 中）:

    from app.core.permissions import require_permission, Permissions
    _ = Depends(require_permission(Permissions.ASSETS_WRITE))

所有权限常量统一在 core/permissions.py 中定义，
本文件仅作文档说明和模块级引用。
"""

from app.core.permissions import Permissions  # noqa: F401 — 供模块内统一引用
