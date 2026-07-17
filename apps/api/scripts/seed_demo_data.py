"""种子数据脚本 — 首次启动时运行

创建：
- 9 个角色
- 14 个权限码
- 角色-权限关联
- 1 个管理员账号（admin / admin123）

用法：
    docker-compose exec api python scripts/seed_demo_data.py
    或本地：
    python scripts/seed_demo_data.py
"""
import asyncio
import sys
import os

# 确保能 import app 模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import async_session_factory
from app.modules.accounts.models import User, Role, Permission, RolePermission
from app.modules.apple.awards.models import AwardTemplate

settings = get_settings()

# ============== 角色 ==============

ROLES = [
    ("super_admin", "超级管理员", "系统最高权限"),
    ("principal", "校长", "全校数据只读"),
    ("moral_director", "德育主任", "奖状 + 学生管理"),
    ("academic_director", "教务主任", "奖状 + 学生只读"),
    ("general_director", "总务主任", "财务 + 资产管理"),
    ("grade_leader", "年级组长", "奖状/学生只读"),
    ("class_teacher", "班主任", "本班奖状/学生只读"),
    ("finance_staff", "财务人员", "财务收支管理"),
    ("asset_manager", "资产管理员", "资产盘点管理"),
]

# ============== 权限 ==============

PERMISSIONS = [
    # A1 奖状奖学金
    ("apple:awards:read", "查看奖状", "apple"),
    ("apple:awards:write", "创建/编辑奖状", "apple"),
    ("apple:awards:delete", "删除奖状", "apple"),
    ("apple:awards:approve", "审批奖状", "apple"),
    # A2 财务收支
    ("apple:finance:read", "查看财务", "apple"),
    ("apple:finance:write", "创建/编辑财务记录", "apple"),
    ("apple:finance:delete", "删除财务记录", "apple"),
    # A3 资产盘点
    ("apple:assets:read", "查看资产", "apple"),
    ("apple:assets:write", "创建/编辑资产", "apple"),
    ("apple:assets:delete", "删除资产", "apple"),
    ("apple:assets:approve", "审批资产报废", "apple"),
    # A4 学生事务
    ("apple:students:read", "查看学生", "apple"),
    ("apple:students:write", "创建/编辑学生", "apple"),
    ("apple:students:delete", "删除学生", "apple"),
]

# ============== 角色-权限映射 ==============

ROLE_PERMISSIONS_MAP = {
    "super_admin": [p[0] for p in PERMISSIONS],  # 全部权限
    "principal": [
        "apple:awards:read", "apple:finance:read",
        "apple:assets:read", "apple:students:read",
    ],
    "moral_director": [
        "apple:awards:read", "apple:awards:write", "apple:awards:delete", "apple:awards:approve",
        "apple:students:read", "apple:students:write", "apple:students:delete",
    ],
    "academic_director": [
        "apple:awards:read", "apple:awards:write", "apple:awards:delete", "apple:awards:approve",
        "apple:students:read",
    ],
    "general_director": [
        "apple:finance:read", "apple:finance:write", "apple:finance:delete",
        "apple:assets:read", "apple:assets:write", "apple:assets:delete", "apple:assets:approve",
    ],
    "grade_leader": ["apple:awards:read", "apple:students:read"],
    "class_teacher": ["apple:awards:read", "apple:students:read"],
    "finance_staff": ["apple:finance:read", "apple:finance:write", "apple:finance:delete"],
    "asset_manager": ["apple:assets:read", "apple:assets:write", "apple:assets:delete", "apple:assets:approve"],
}


async def seed():
    async with async_session_factory() as db:  # type: AsyncSession
        # ---- 角色 ----
        print("创建角色...")
        role_objs = {}
        for code, name, desc in ROLES:
            existing = (await db.execute(select(Role).where(Role.name == code))).scalar_one_or_none()
            if existing:
                role_objs[code] = existing
                print(f"  ⏭  角色已存在: {name}")
            else:
                role = Role(name=code, display_name=name, description=desc)
                db.add(role)
                await db.flush()
                role_objs[code] = role
                print(f"  ✅ 角色: {name}")

        # ---- 权限 ----
        print("创建权限...")
        perm_objs = {}
        for code, name, module in PERMISSIONS:
            existing = (await db.execute(select(Permission).where(Permission.code == code))).scalar_one_or_none()
            if existing:
                perm_objs[code] = existing
            else:
                perm = Permission(code=code, name=name, module=module)
                db.add(perm)
                await db.flush()
                perm_objs[code] = perm
        print(f"  ✅ {len(PERMISSIONS)} 个权限码")

        # ---- 角色-权限关联 ----
        print("关联角色-权限...")
        for role_code, perm_codes in ROLE_PERMISSIONS_MAP.items():
            role = role_objs[role_code]
            for pc in perm_codes:
                perm = perm_objs[pc]
                existing = (await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm.id,
                    )
                )).scalar_one_or_none()
                if not existing:
                    db.add(RolePermission(role_id=role.id, permission_id=perm.id))
        print("  ✅ 角色-权限关联完成")

        # ---- 管理员账号 ----
        print("创建管理员...")
        admin_role = role_objs["super_admin"]
        existing_admin = (await db.execute(
            select(User).where(User.username == "admin")
        )).scalar_one_or_none()
        if existing_admin:
            print("  ⏭  管理员已存在")
        else:
            admin = User(
                username="admin",
                password_hash=hash_password("admin123"),
                display_name="系统管理员",
                role_id=admin_role.id,
                is_active=True,
            )
            db.add(admin)
            print("  ✅ 管理员: admin / admin123")

        # ---- 奖状 & 奖学金 种子数据 ----
        print("创建奖状模板...")
        award_templates = [
            ("三好学生", "德智体美劳全面发展的优秀学生", "学业"),
            ("优秀班干部", "在班级管理中表现突出的学生干部", "品德"),
            ("成绩优异奖", "学期考试总成绩排名年级前列", "学业"),
            ("学业进步奖", "本学期学习成绩进步显著", "学业"),
            ("品德风尚奖", "在品德行为方面表现突出", "品德"),
            ("最佳志愿者", "积极参与社会服务与志愿活动", "活动"),
            ("科技竞赛奖", "在校内/校外科技竞赛中获奖", "活动"),
            ("全勤奖", "本学期无缺勤、无迟到早退", "其他"),
        ]
        for name, desc, cat in award_templates:
            existing = (await db.execute(
                select(AwardTemplate).where(AwardTemplate.name == name)
            )).scalar_one_or_none()
            if not existing:
                db.add(AwardTemplate(name=name, description=desc, category=cat))
                print(f"  ✅ 奖状模板: {name}")

        await db.commit()
        print("\n🎉 种子数据导入完成！")


if __name__ == "__main__":
    asyncio.run(seed())
