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

        # ---- 演示数据 ----
        from datetime import date, datetime
        from app.modules.apple.awards.models import AwardTemplate
        from app.modules.apple.students.models import Student
        from app.modules.apple.finance.models import FinanceRecord, Quotation
        from app.modules.apple.assets.models import Asset

        now = datetime.utcnow()

        print("创建演示数据...")

        # 奖状模板
        templates_exist = (await db.execute(select(AwardTemplate))).scalars().first()
        if not templates_exist:
            templates_data = [
                ("三好学生", "校级综合表彰", "academic", "该生德智体美劳全面发展，表现优异，特发此状，以资鼓励。"),
                ("优秀班干部", "班级管理表彰", "leadership", "该生在班级管理中尽职尽责，展现出色的领导才能，特发此状，以资鼓励。"),
                ("进步之星", "学习进步表彰", "academic", "该生本学期成绩进步显著，勤奋好学，特发此状，以资鼓励。"),
                ("体育标兵", "体育竞技表彰", "sports", "该生积极参加体育活动，在体育竞赛中表现突出，特发此状，以资鼓励。"),
                ("文艺之星", "文艺活动表彰", "arts", "该生在文艺活动中表现优异，展现卓越的艺术才能，特发此状，以资鼓励。"),
            ]
            for name, desc, cat, content in templates_data:
                db.add(AwardTemplate(name=name, description=desc, category=cat, default_content=content, is_active=True))
            print("  ✅ 5 个奖状模板")

        # 学生
        students_exist = (await db.execute(select(Student))).scalars().first()
        if not students_exist:
            students_data = [
                ("S26001", "陳嘉怡", "CHAN Ka Yi", "中二甲", "active", "2025-09-01", "陳先生", "61234567"),
                ("S26002", "張偉傑", "CHEUNG Wai Kit", "中二甲", "active", "2025-09-01", "張女士", "62345678"),
                ("S26003", "李曉明", "LI Siu Ming", "中三甲", "active", "2024-09-01", "李先生", "63456789"),
                ("S26004", "王美玲", "WONG Mei Ling", "中四乙", "active", "2023-09-01", "王先生", "64567890"),
                ("S25001", "劉志強", "LAU Chi Keung", "中五甲", "graduated", "2022-09-01", "劉女士", "65678901"),
            ]
            for sid, name_zh, name_en, cls, status, adm, pname, pphone in students_data:
                db.add(Student(
                    id=f"student-{sid}", student_no=sid, name_zh=name_zh, name_en=name_en,
                    class_name=cls, status=status, admission_date=date.fromisoformat(adm),
                    parent_name=pname, parent_phone=pphone, parent_email=f"parent.{sid}@example.edu.hk",
                    created_by="system", updated_by="system",
                    created_at=now, updated_at=now,
                ))
            print("  ✅ 5 名学生")

        # 财务记录
        finance_exist = (await db.execute(select(FinanceRecord))).scalars().first()
        if not finance_exist:
            db.add(FinanceRecord(type="income", date="2026-01-05", project="學費收入 — 中二甲班", amount=45000, payment_method="銀行轉賬", handler="陳老師", status="confirmed", created_by=1))
            db.add(FinanceRecord(type="income", date="2026-02-03", project="雜費 — 實驗材料費", amount=3200, payment_method="現金", handler="李老師", status="confirmed", created_by=1))
            db.add(FinanceRecord(type="expense", date="2026-01-10", project="購買粉筆及教具", amount=850, payment_method="現金", handler="張老師", supplier="文具批發公司", status="confirmed", created_by=1))
            db.add(FinanceRecord(type="expense", date="2026-03-01", project="電腦室維修保養", amount=4800, payment_method="銀行轉賬", handler="何老師", supplier="科技服務有限公司", status="confirmed", created_by=1))
            print("  ✅ 4 条财务记录")

        # 报价单
        quotation_exist = (await db.execute(select(Quotation))).scalars().first()
        if not quotation_exist:
            db.add(Quotation(project_name="校服採購 2026-2027", vendor="服裝廠 A", amount=35000, is_lowest=True, is_selected=True, created_by=1))
            db.add(Quotation(project_name="校服採購 2026-2027", vendor="服裝廠 B", amount=42000, is_lowest=False, is_selected=False, created_by=1))
            db.add(Quotation(project_name="校服採購 2026-2027", vendor="服裝廠 C", amount=38000, is_lowest=False, is_selected=False, created_by=1))
            print("  ✅ 3 条报价单")

        # 资产
        assets_exist = (await db.execute(select(Asset))).scalars().first()
        if not assets_exist:
            db.add(Asset(asset_no="AST-001", name="Dell 桌上電腦", category="電子設備", location="電腦室", status="active", purchase_date="2024-08-15", purchase_amount=6500, created_by=1))
            db.add(Asset(asset_no="AST-002", name="投影儀 Epson X500", category="電子設備", location="中二甲教室", status="active", purchase_date="2023-09-01", purchase_amount=12000, created_by=1))
            db.add(Asset(asset_no="AST-003", name="學生書桌 (30張)", category="家具", location="中三甲教室", status="active", purchase_date="2022-07-01", purchase_amount=18000, created_by=1))
            db.add(Asset(asset_no="AST-004", name="空調機 Panasonic", category="電器", location="教員室", status="active", purchase_date="2021-06-15", purchase_amount=8500, created_by=1))
            db.add(Asset(asset_no="AST-005", name="打印機 HP LaserJet", category="電子設備", location="校務處", status="written_off", purchase_date="2018-03-01", purchase_amount=3200, remark="已報廢 — 零件停產", created_by=1))
            print("  ✅ 5 件资产")

        # ---- 批量演示数据（仅首次种子时填充，确保分页和筛选有足够数据） ----
        import random

        from sqlalchemy import func
        result = await db.execute(select(func.count()).select_from(Student))
        students_count = result.scalar() or 0
        if students_count < 20:
            print("批量生成演示数据...")

            # 中文姓氏和名字
            surnames = ["陳","張","李","王","劉","黃","何","周","吳","鄭","林","梁","謝","楊","馬","朱","許","郭","蔡","葉"]
            given_names = ["志強","美玲","嘉怡","偉傑","小明","小華","家豪","淑芬","國棟","麗華","俊傑","慧敏","文輝","雅文","志明","詠詩","家偉","穎欣","浩賢","佩珊","俊偉","思琪","家輝","婉婷","國強","美琪","志偉"]
            classes = ["中一甲","中一乙","中二甲","中二乙","中三甲","中三乙","中四甲","中四乙","中五甲","中五乙","中六甲"]
            categories = ["電子設備","家具","電器","體育器材","圖書","樂器","實驗器材","辦公設備"]
            locations = ["電腦室","教員室","校務處","圖書館","實驗室","禮堂","操場","音樂室","美術室","家政室","中一甲教室","中一乙教室","中二甲教室","中二乙教室","中三甲教室","中三乙教室","中四甲教室","中四乙教室","中五甲教室","中五乙教室","中六甲教室"]
            payment_methods = ["現金","銀行轉賬","支票","八達通"]
            income_projects = ["學費","雜費","活動費","圖書館罰款","校服費","課後輔導費","午餐費","校車費","書簿費","考試費","社費","學會會費"]
            expense_projects = ["購買教具","維修保養","水電費","清潔用品","文具採購","活動佈置","印刷費","郵寄費","保險費","軟件授權"]
            asset_names = ["桌上電腦","筆記本電腦","投影儀","打印機","掃描儀","空調機","風扇","白板","書桌","椅子","書櫃","儲物櫃","鋼琴","小提琴","籃球架","羽毛球網","實驗顯微鏡","滅火器","擴音器","數碼相機"]

            # 生成 45 名额外学生（累计 50）
            grade_map = {"一":1,"二":2,"三":3,"四":4,"五":5,"六":6}
            for i in range(45):
                sid = f"S270{50+i:02d}"
                name_zh = random.choice(surnames) + random.choice(given_names)
                cls = random.choice(classes)
                grade_num = grade_map.get(cls[1:2], 1)
                db.add(Student(
                    id=f"student-{sid}", student_no=sid, name_zh=name_zh,
                    name_en=f"{name_zh} (Student)", class_name=cls,
                    status=random.choice(["active","active","active","active","suspended","graduated"]),
                    admission_date=date.fromisoformat(f"{2026-grade_num+1}-09-01"),
                    parent_name=f"{surnames[i%len(surnames)]}先生",
                    parent_phone=f"6{random.randint(1000000,9999999)}",
                    parent_email=f"parent.{sid}@example.edu.hk",
                    created_by="system", updated_by="system",
                    created_at=now, updated_at=now,
                ))
            print(f"  ✅ 45 名学生（累计 50）")

            # 生成 96 条额外财务记录（累计 100）
            for i in range(96):
                is_income = i % 3 != 0  # ~2/3 收入, 1/3 支出
                m = random.randint(1, 12)
                d = random.randint(1, 28)
                db.add(FinanceRecord(
                    type="income" if is_income else "expense",
                    date=f"2026-{m:02d}-{d:02d}",
                    project=random.choice(income_projects if is_income else expense_projects),
                    amount=round(random.uniform(100, 20000) if is_income else random.uniform(50, 8000), 2),
                    payment_method=random.choice(payment_methods) if is_income else None,
                    handler=random.choice(["陳老師","李老師","張老師","何老師","王老師","林老師"]),
                    supplier=random.choice(["文具批發","科技服務","清潔公司","維修公司"]) if not is_income else None,
                    status=random.choice(["confirmed","confirmed","confirmed","pending"]),
                    created_by=1,
                ))
            print(f"  ✅ 96 条财务记录（累计 100）")

            # 生成 196 件额外资产（累计 ~200）
            for i in range(196):
                cat = random.choice(categories)
                db.add(Asset(
                    asset_no=f"AST-{200+i+1:04d}",
                    name=f"{random.choice(asset_names)} {random.choice(['A','B','C','Pro','Plus','Elite'])}-{random.randint(100,999)}",
                    category=cat,
                    location=random.choice(locations),
                    status=random.choice(["active","active","active","active","active","maintenance","written_off"]),
                    purchase_date=date.fromisoformat(f"{random.randint(2018,2025)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"),
                    purchase_amount=round(random.uniform(500, 50000), 2),
                    created_by=1,
                ))
            print(f"  ✅ 196 件资产（累计 ~200）")

            # 额外报价单
            quotation_count = 0
            for i in range(10):
                pn = random.choice(["校巴服務 2026","課本採購 2026-2027","運動會用品","IT設備升級","校園綠化工程","禮堂音響系統","實驗室安全設備"])
                db.add(Quotation(project_name=pn, vendor=f"{random.choice(['供應商A','供應商B','供應商C','承包商X','承包商Y'])}", amount=round(random.uniform(5000, 80000), 2), is_lowest=random.choice([True, False]), is_selected=False, created_by=1))
                quotation_count += 1
            print(f"  ✅ {quotation_count} 条报价单")

        await db.commit()
        print(f"\n🎉 种子数据导入完成！（含批量演示数据）\n  学生: ~50 | 财务: ~100 | 资产: ~200 | 报价单: ~17")


if __name__ == "__main__":
    asyncio.run(seed())
