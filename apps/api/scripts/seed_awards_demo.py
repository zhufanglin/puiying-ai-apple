"""獎狀獎學金模擬數據腳本

為獎狀模組生成示範數據，包括：
- 3 個獎狀（三好學生、優秀班幹部、學業進步獎），共 50 名獲獎學生
- 3 筆獎學金申請（不同審核狀態）

用法：
    cd apps/api
    python scripts/seed_awards_demo.py
"""
import asyncio
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "venv_dir"))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.modules.accounts.models import User
from app.modules.apple.awards.models import (
    AwardTemplate, Award, AwardRecipient,
    ScholarshipApplication,
)

# ==================== 香港學生姓名 ====================

STUDENT_NAMES = [
    "陳大文", "李小明", "張嘉欣", "黃志強", "吳美玲",
    "劉俊傑", "林淑儀", "何偉文", "楊素芬", "鄭國榮",
    "周子晴", "王浩然", "梁詠詩", "趙健豪", "謝凱欣",
    "鄧志偉", "馮雅雯", "馬浩賢", "蕭凱琳", "羅俊傑",
    "譚芷晴", "曾偉強", "郭詠珊", "蔡文軒", "歐詠琪",
    "余志華", "伍凱婷", "黎卓賢", "葉家欣", "麥浩文",
    "方逸朗", "陸凱瑩", "雷俊傑", "戴凱琳", "溫志豪",
    "莊詠詩", "石浩賢", "蘇芷晴", "潘文傑", "董詠珊",
    "程凱欣", "袁志偉", "湯浩賢", "鄧凱琳", "關文軒",
    "姚詠詩", "區凱瑩", "伍卓賢", "羅家欣", "田浩文",
]

CLASSES = ["1A", "1B", "1C", "1D", "2A", "2B", "2C", "2D", "3A", "3B", "3C", "3D"]


def assign_classes(names: list[str]) -> list[tuple[str, str]]:
    """為學生分配班級（輪流分配）"""
    result = []
    for i, name in enumerate(names):
        cls = CLASSES[i % len(CLASSES)]
        result.append((name, cls))
    return result


# ==================== 生成證書編號 ====================

def generate_cert_no(prefix: str, index: int) -> str:
    return f"{prefix}-2025-{index:04d}"


async def seed():
    async with async_session_factory() as db:  # type: AsyncSession
        print("=" * 50)
        print("獎狀獎學金模擬數據生成")
        print("=" * 50)

        # ---- 檢查模板是否存在 ----
        print("\n>>> 檢查獎狀模板...")
        template = (await db.execute(
            select(AwardTemplate).where(AwardTemplate.id == 1)
        )).scalar_one_or_none()

        if not template:
            print("  [ERR] 模板 ID=1 不存在，請先執行 seed_demo_data.py")
            return

        # 也取得其他模板
        template_2 = (await db.execute(
            select(AwardTemplate).where(AwardTemplate.id == 2)
        )).scalar_one_or_none()
        template_4 = (await db.execute(
            select(AwardTemplate).where(AwardTemplate.id == 4)
        )).scalar_one_or_none()
        template_ids = {1: template, 2: template_2, 4: template_4}
        print(f"  [OK] 模板 ID=1: {template.name}")
        print(f"  [OK] 模板 ID=2: {template_2.name if template_2 else '不存在'}")
        print(f"  [OK] 模板 ID=4: {template_4.name if template_4 else '不存在'}")

        # ==================== 獎狀 1: 三好學生 ====================
        print("\n>>> 創建獎狀：三好學生（20人）...")
        model_students = assign_classes(STUDENT_NAMES[:20])
        award1 = Award(
            template_id=1,
            title="2024-2025 學年三好學生",
            issue_date=date(2025, 7, 1),
            issuer="德育處",
            status="published",
            remark="德智體群美五育並重，全年表現優異",
            total_recipients=len(model_students),
        )
        db.add(award1)
        await db.flush()
        print(f"  [OK] 獎狀 ID={award1.id}")

        for i, (name, cls) in enumerate(model_students):
            recipient = AwardRecipient(
                award_id=award1.id,
                student_name=name,
                student_class=cls,
                student_grade=cls[0],
                certificate_no=generate_cert_no("MDL", i + 1),
                reason="德智體群美五育表現優異",
                rank="一等獎",
            )
            db.add(recipient)
        print(f"  [OK] 已添加 {len(model_students)} 名獲獎學生")

        # ==================== 獎狀 2: 優秀班幹部 ====================
        print("\n>>> 創建獎狀：優秀班幹部（15人）...")
        leader_students = assign_classes(STUDENT_NAMES[20:35])
        award2 = Award(
            template_id=2,
            title="2024-2025 學年優秀班幹部",
            issue_date=date(2025, 7, 1),
            issuer="德育處",
            status="published",
            remark="在班級管理中表現突出，盡責盡心",
            total_recipients=len(leader_students),
        )
        db.add(award2)
        await db.flush()
        print(f"  [OK] 獎狀 ID={award2.id}")

        for i, (name, cls) in enumerate(leader_students):
            recipient = AwardRecipient(
                award_id=award2.id,
                student_name=name,
                student_class=cls,
                student_grade=cls[0],
                certificate_no=generate_cert_no("LDR", i + 1),
                reason="班級管理表現突出",
                rank="優秀獎",
            )
            db.add(recipient)
        print(f"  [OK] 已添加 {len(leader_students)} 名獲獎學生")

        # ==================== 獎狀 3: 學業進步獎 ====================
        print("\n>>> 創建獎狀：學業進步獎（15人）...")
        improve_students = assign_classes(STUDENT_NAMES[35:50])
        award3 = Award(
            template_id=4,
            title="2024-2025 學年學業進步獎",
            issue_date=date(2025, 7, 1),
            issuer="教務處",
            status="published",
            remark="本學期考試成績進步顯著",
            total_recipients=len(improve_students),
        )
        db.add(award3)
        await db.flush()
        print(f"  [OK] 獎狀 ID={award3.id}")

        for i, (name, cls) in enumerate(improve_students):
            recipient = AwardRecipient(
                award_id=award3.id,
                student_name=name,
                student_class=cls,
                student_grade=cls[0],
                certificate_no=generate_cert_no("IMP", i + 1),
                reason="期末考試成績進步顯著",
                rank="進步獎",
            )
            db.add(recipient)
        print(f"  [OK] 已添加 {len(improve_students)} 名獲獎學生")

        # ==================== 獎學金申請 ====================
        print("\n>>> 創建獎學金申請...")

        # 申請 1: 待審核
        app1 = ScholarshipApplication(
            student_name="陳大文",
            student_class="中五甲班",
            student_grade="中五",
            scholarship_type="學業優秀",
            academic_year="2025-2026",
            semester="上",
            application_date=date(2025, 9, 1),
            status="pending",
            amount=5000.00,
            reason="全年總成績排名年級前三名，操行評等優良",
        )
        db.add(app1)
        print(f"  [OK] 獎學金申請（待審核）: 陳大文 HK$5,000")

        # 申請 2: 已通過
        app2 = ScholarshipApplication(
            student_name="李小明",
            student_class="中五乙班",
            student_grade="中五",
            scholarship_type="學業優秀",
            academic_year="2025-2026",
            semester="上",
            application_date=date(2025, 9, 2),
            status="approved",
            amount=5000.00,
            reason="全年成績優異，積極參與課外活動",
            reviewer_id=1,
            review_comment="符合獎學金申請條件，批准",
            review_date=date(2025, 9, 15),
        )
        db.add(app2)
        print(f"  [OK] 獎學金申請（已通過）: 李小明 HK$5,000")

        # 申請 3: 已駁回
        app3 = ScholarshipApplication(
            student_name="張嘉欣",
            student_class="中五丙班",
            student_grade="中五",
            scholarship_type="助學金",
            academic_year="2025-2026",
            semester="上",
            application_date=date(2025, 9, 3),
            status="rejected",
            amount=3000.00,
            reason="家庭經濟困難申請助學金",
            reviewer_id=1,
            review_comment="所提交之證明文件不齊全，請補充後重新申請",
            review_date=date(2025, 9, 20),
        )
        db.add(app3)
        print(f"  [OK] 獎學金申請（已駁回）: 張嘉欣 HK$3,000")

        # ==================== 提交 ====================
        await db.commit()

        print("\n" + "=" * 50)
        print("[DATA] 數據匯總")
        print("=" * 50)
        print(f"  獎狀總數: 3")
        print(f"    - 三好學生: 20 名獲獎學生")
        print(f"    - 優秀班幹部: 15 名獲獎學生")
        print(f"    - 學業進步獎: 15 名獲獎學生")
        print(f"  獲獎學生總數: 50 人")
        print(f"  獎學金申請: 3 筆")
        print(f"    - 待審核: 1 筆")
        print(f"    - 已通過: 1 筆")
        print(f"    - 已駁回: 1 筆")
        print(f"\n[DONE] 模擬數據導入完成！")


if __name__ == "__main__":
    asyncio.run(seed())
