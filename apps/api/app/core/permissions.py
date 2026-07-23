"""权限控制：装饰器 + 依赖注入

使用方式：

    @router.get("/awards")
    async def list_awards(
        db: AsyncSession = Depends(get_db),
        user = Depends(get_current_user),                          # ← 先拿用户
        _ = Depends(require_permission("apple:awards:read")),     # ← 再查权限
    ):
        ...

9 种角色预置权限（按方案规划）：

| 角色 | 权限范围 |
|------|---------|
| 超级管理员 | 全部 |
| 校长 | apple:* (只读) |
| 德育主任 | apple:awards:* + apple:students:* |
| 教务主任 | apple:awards:* + apple:students:read |
| 总务主任 | apple:finance:* + apple:assets:* |
| 年级组长 | apple:awards:read + apple:students:read |
| 班主任 | apple:awards:read + apple:students:read (本班) |
| 财务人员 | apple:finance:* |
| 资产管理员 | apple:assets:* |
"""

from typing import List

from fastapi import Depends, HTTPException

from app.core.security import get_current_user
from app.modules.accounts.models import User


class require_permission:
    """权限检查依赖（支持多权限 OR 逻辑）

    单权限:  require_permission("apple:awards:read")
    多权限:  require_permission("apple:awards:write", "apple:awards:delete")  ← 满足其一即可
    """

    def __init__(self, *permission_codes: str):
        self.codes = set(permission_codes)

    async def __call__(self, user: User = Depends(get_current_user)) -> User:
        # 1. 超级管理员 → 直接放行
        if user.role and user.role.name == "super_admin":
            return user

        # 2. 收集当前用户所有权限码
        user_codes: set[str] = set()
        if user.role:
            for rp in user.role.permissions:
                if rp.permission:
                    user_codes.add(rp.permission.code)

        # 3. 检查通配符（如 apple:awards:* 覆盖 apple:awards:read）
        for required in self.codes:
            # 精确匹配
            if required in user_codes:
                return user
            # 通配符匹配
            for user_code in user_codes:
                if _wildcard_match(user_code, required):
                    return user

        raise HTTPException(
            status_code=403,
            detail={
                "code": 10003,
                "message": f"权限不足，需要: {' 或 '.join(self.codes)}",
            },
        )


def _wildcard_match(user_code: str, required: str) -> bool:
    """检查 user_code 的通配符是否覆盖 required

    例如 user_code="apple:awards:*" 覆盖 required="apple:awards:read"
    """
    if not user_code.endswith(":*"):
        return False
    prefix = user_code[:-2]  # 去掉 ":*"
    return required.startswith(prefix + ":")


# ============== 预置权限码常量 ==============
# 给同学写路由时直接引用，避免拼写错误

class Permissions:
    # A1 奖状奖学金
    AWARDS_READ   = "apple:awards:read"
    AWARDS_WRITE  = "apple:awards:write"
    AWARDS_DELETE = "apple:awards:delete"
    AWARDS_APPROVE = "apple:awards:approve"

    # A2 财务收支
    FINANCE_READ   = "apple:finance:read"
    FINANCE_WRITE  = "apple:finance:write"
    FINANCE_DELETE = "apple:finance:delete"

    # A3 资产盘点
    ASSETS_READ   = "apple:assets:read"
    ASSETS_WRITE  = "apple:assets:write"
    ASSETS_DELETE = "apple:assets:delete"
    ASSETS_APPROVE = "apple:assets:approve"

    # A4 学生事务
    STUDENTS_READ   = "apple:students:read"
    STUDENTS_WRITE  = "apple:students:write"
    STUDENTS_DELETE = "apple:students:delete"

    # A5 通知通告
    NOTIFICATIONS_READ  = "apple:notifications:read"
    NOTIFICATIONS_WRITE = "apple:notifications:write"
    NOTIFICATIONS_SEND  = "apple:notifications:send"
