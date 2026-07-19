"""奖状 & 奖学金 — 业务逻辑层 (Service)

职责：
  - 调用 repository 层完成数据操作
  - 实现业务校验、状态机转换
  - 保持与 FastAPI 框架解耦（不直接依赖 Request/Response）
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import raise_error, NOT_FOUND, BUSINESS_ERROR
from app.modules.apple.awards import repository as repo
from app.modules.apple.awards.models import ScholarshipReview
from app.modules.apple.awards.schemas import (
    AwardStatistics, ScholarshipStatistics,
    CalculateResult, CalculateResultItem,
    ScriptOut, ScriptItem,
)


# ==================== 奖状模板 ====================

async def query_templates(
    db: AsyncSession,
    name: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
):
    """查询模板列表"""
    items, total, total_pages = await repo.list_templates(
        db, name, category, is_active, page, page_size
    )
    return items, total, page, page_size, total_pages


async def get_template(db: AsyncSession, template_id: int):
    """获取单个模板"""
    obj = await repo.get_template(db, template_id)
    if not obj:
        raise_error(*NOT_FOUND, detail={"id": template_id})
    return obj


async def create_template(db: AsyncSession, data: dict):
    """创建模板"""
    return await repo.create_template(db, data)


async def update_template(db: AsyncSession, template_id: int, data: dict):
    """更新模板"""
    # 过滤掉 None 值
    clean = {k: v for k, v in data.items() if v is not None}
    obj = await repo.update_template(db, template_id, clean)
    if not obj:
        raise_error(*NOT_FOUND, detail={"id": template_id})
    return obj


async def delete_template(db: AsyncSession, template_id: int):
    """删除模板"""
    ok = await repo.delete_template(db, template_id)
    if not ok:
        raise_error(*NOT_FOUND, detail={"id": template_id})
    return {"deleted": True}


# ==================== 奖状 ====================

async def query_awards(
    db: AsyncSession,
    title: Optional[str] = None,
    template_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = 1,
    page_size: int = 20,
):
    """查询奖状列表"""
    items, total, total_pages = await repo.list_awards(
        db, title, template_id, status, date_from, date_to, page, page_size
    )
    return items, total, page, page_size, total_pages


async def get_award(db: AsyncSession, award_id: int):
    """获取单个奖状（含模板 + 学生）"""
    obj = await repo.get_award(db, award_id)
    if not obj:
        raise_error(*NOT_FOUND, detail={"id": award_id})
    return obj


async def create_award(db: AsyncSession, data: dict):
    """创建奖状"""
    # 校验模板存在
    template_id = data.get("template_id")
    template = await repo.get_template(db, template_id)
    if not template:
        raise_error(*NOT_FOUND, detail={"template_id": template_id})

    # 分离获奖学生
    recipients_data = data.pop("recipients", [])

    # 设置默认值
    if "issue_date" not in data or data["issue_date"] is None:
        data["issue_date"] = date.today()
    data["status"] = data.get("status", "draft")

    # 创建奖状
    award = await repo.create_award(db, data)

    # 添加获奖学生
    if recipients_data:
        await repo.add_recipients(db, award.id, recipients_data)

    # 重新加载以获取关联数据
    return await repo.get_award(db, award.id)


async def update_award(db: AsyncSession, award_id: int, data: dict):
    """更新奖状（只更新字段，不更新获奖学生）"""
    clean = {k: v for k, v in data.items() if v is not None}
    obj = await repo.update_award(db, award_id, clean)
    if not obj:
        raise_error(*NOT_FOUND, detail={"id": award_id})
    await db.refresh(obj)
    return obj


async def delete_award(db: AsyncSession, award_id: int):
    """删除奖状"""
    ok = await repo.delete_award(db, award_id)
    if not ok:
        raise_error(*NOT_FOUND, detail={"id": award_id})
    return {"deleted": True}


async def batch_delete_awards(db: AsyncSession, award_ids: list[int]) -> dict:
    """批量删除奖状

    Args:
        award_ids: 要删除的奖状ID列表

    Returns:
        dict: {"deleted_count": N, "total": N}
    """
    deleted = 0
    for award_id in award_ids:
        ok = await repo.delete_award(db, award_id)
        if ok:
            deleted += 1
    return {"deleted_count": deleted, "total": len(award_ids)}


async def cancel_award(db: AsyncSession, award_id: int):
    """取消奖状（仅 draft/calculated -> cancelled，已確認不可取消）"""
    award = await repo.get_award(db, award_id)
    if not award:
        raise_error(*NOT_FOUND, detail={"id": award_id})
    if award.status not in ("draft", "calculated"):
        raise_error(*BUSINESS_ERROR, detail={
            "message": f"當前狀態為 {award.status}，已確認的獎狀不可取消"
        })
    award.status = "cancelled"
    await db.flush()
    await db.refresh(award)
    return award


# ==================== 获奖学生 ====================

async def add_recipients(db: AsyncSession, award_id: int, recipients_data: list[dict]):
    """批量添加获奖学生（仅 draft / calculated 状态可操作）"""
    award = await repo.get_award(db, award_id)
    if not award:
        raise_error(*NOT_FOUND, detail={"award_id": award_id})
    if award.status not in ("draft", "calculated"):
        raise_error(*BUSINESS_ERROR, detail={
            "message": f"當前狀態為 {award.status}，不可增減獲獎學生"
        })
    return await repo.add_recipients(db, award_id, recipients_data)


async def remove_recipient(db: AsyncSession, recipient_id: int):
    """删除获奖学生（仅 draft / calculated 状态可操作）"""
    # 先查 recipient 获取 award_id
    recipient = await repo.get_recipient(db, recipient_id)
    if not recipient:
        raise_error(*NOT_FOUND, detail={"recipient_id": recipient_id})
    award = await repo.get_award(db, recipient.award_id)
    if award and award.status not in ("draft", "calculated"):
        raise_error(*BUSINESS_ERROR, detail={
            "message": f"當前狀態為 {award.status}，不可增減獲獎學生"
        })
    ok = await repo.remove_recipient(db, recipient_id)
    if not ok:
        raise_error(*NOT_FOUND, detail={"recipient_id": recipient_id})
    return {"deleted": True}


# ==================== 奖学金申请 ====================

async def query_scholarship_applications(
    db: AsyncSession,
    student_name: Optional[str] = None,
    scholarship_type: Optional[str] = None,
    status: Optional[str] = None,
    academic_year: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
):
    """查询奖学金申请列表"""
    items, total, total_pages = await repo.list_scholarship_applications(
        db, student_name, scholarship_type, status, academic_year, page, page_size
    )
    return items, total, page, page_size, total_pages


async def get_scholarship_application(db: AsyncSession, app_id: int):
    """获取单个奖学金申请"""
    obj = await repo.get_scholarship_application(db, app_id)
    if not obj:
        raise_error(*NOT_FOUND, detail={"id": app_id})
    return obj


async def create_scholarship_application(db: AsyncSession, data: dict):
    """提交奖学金申请"""
    data["status"] = "pending"
    return await repo.create_scholarship_application(db, data)


async def review_scholarship(
    db: AsyncSession, app_id: int, reviewer_id: int,
    status: str, review_comment: Optional[str] = None,
):
    """审核奖学金申请

    Args:
        status: approved / rejected
    """
    app = await repo.get_scholarship_application(db, app_id)
    if not app:
        raise_error(*NOT_FOUND, detail={"id": app_id})
    if app.status != "pending":
        raise_error(*BUSINESS_ERROR, detail={
            "message": f"当前状态为 {app.status}，无法审核"
        })

    now = datetime.now(timezone.utc)
    update_data = {
        "status": status,
        "reviewer_id": reviewer_id,
        "review_comment": review_comment,
        "review_date": now,
    }
    result = await repo.update_scholarship_application(db, app_id, update_data)

    # 写入审计记录
    review_record = ScholarshipReview(
        application_id=app_id,
        reviewer_id=reviewer_id,
        review_status=status,
        review_comment=review_comment,
        review_date=now,
    )
    db.add(review_record)
    await db.flush()

    return result


# ==================== 统计 ====================

async def get_statistics(db: AsyncSession) -> dict:
    """获取奖状 + 奖学金综合统计"""
    award_stats = await repo.get_award_statistics(db)
    scholarship_stats = await repo.get_scholarship_statistics(db)
    return {
        "awards": award_stats,
        "scholarships": scholarship_stats,
    }


# ==================== 奖学金核算 ====================

# 繁体→简体字符映射（常见奖状等级用字）
_TRAD_TO_SIMP: dict[str, str] = str.maketrans({
    "獎": "奖", "級": "级", "優": "优", "異": "异",
    "進": "进", "領": "领", "導": "导", "體": "体",
    "學": "学", "藝": "艺", "運": "运", "動": "动",
    "榮": "荣", "譽": "誉", "證": "证", "書": "书",
})


def _normalize_rank(rank: str) -> str:
    """将等级字符串中的繁体字转为简体，确保匹配一致性"""
    return rank.translate(_TRAD_TO_SIMP) if rank else ""


def _normalize_rules(rules: dict[str, Decimal]) -> dict[str, Decimal]:
    """将规则字典的 key 全部转为简体，兼容繁体输入"""
    return {_normalize_rank(k): v for k, v in rules.items()}


# 默认核算规则：按获奖等级
_DEFAULT_SCHOLARSHIP_RULES: dict[str, Decimal] = _normalize_rules({
    "一等獎": Decimal("1000"),
    "二等獎": Decimal("500"),
    "三等獎": Decimal("300"),
    "優秀獎": Decimal("100"),
})


async def calculate_scholarship(
    db: AsyncSession,
    award_id: int,
    rules: Optional[dict[str, Decimal]] = None,
) -> CalculateResult:
    """核算奖学金金额

    根据获奖学生的获奖等级，按规则计算每人应得奖学金金额。
    若无自定义规则，按默认规则（一等奖1000、二等奖500...）核算。
    核算成功后自动将状态从 draft 改为 calculated。

    Args:
        award_id: 奖状ID
        rules: 自定义核算规则，如 {"一等奖": 1000, "二等奖": 500}

    Returns:
        CalculateResult: 核算结果（明细 + 总计）
    """
    award = await repo.get_award(db, award_id)
    if not award:
        raise_error(*NOT_FOUND, detail={"award_id": award_id})

    if award.status not in ("draft", "calculated"):
        raise_error(*BUSINESS_ERROR, detail={
            "message": f"當前狀態為 {award.status}，不可重複核算"
        })

    effective_rules = _normalize_rules(rules) if rules else _DEFAULT_SCHOLARSHIP_RULES

    # 提取兜底默认金额（支持"默认"/"默認"关键字）
    default_amount = effective_rules.get("默认", effective_rules.get("默認", Decimal("0")))

    items: list[CalculateResultItem] = []
    for r in award.recipients:
        rank_key = _normalize_rank(r.rank or "")
        if rank_key and rank_key in effective_rules:
            base = effective_rules[rank_key]
            remark = f"按{rank_key}標準核算"
        elif default_amount > 0:
            base = default_amount
            remark = "按默認標準核算"
        else:
            base = Decimal("0")
            remark = "未匹配到核算規則" if rank_key else "無等級且無默認規則"
        items.append(CalculateResultItem(
            student_name=r.student_name,
            student_class=r.student_class,
            rank=r.rank,
            base_amount=base,
            final_amount=base,
            remark=remark,
        ))
        # 持久化核算金额到获奖记录
        r.scholarship_amount = base

    total = sum(item.final_amount for item in items)

    # 同步更新奖状总额
    award.amount = total

    # 核算成功后自动将状态从 draft 改为 calculated
    if award.status == "draft":
        award.status = "calculated"
    await db.flush()

    return CalculateResult(items=items, total_amount=total)


async def confirm_scholarship(
    db: AsyncSession,
    award_id: int,
) -> dict:
    """确认并保存奖学金核算结果

    将状态从 calculated 改为 confirmed，表示核算已确认。
    """
    award = await repo.get_award(db, award_id)
    if not award:
        raise_error(*NOT_FOUND, detail={"award_id": award_id})

    if award.status != "calculated":
        raise_error(*BUSINESS_ERROR, detail={
            "message": f"當前狀態為 {award.status}，請先完成獎學金核算後再確認"
        })

    award.status = "confirmed"
    await db.flush()
    await db.refresh(award)
    return {"id": award.id, "status": award.status, "message": "核算結果已確認"}


# ==================== 读稿生成 ====================

async def generate_script(
    db: AsyncSession,
    award_id: int,
    group_by: str = "class",
) -> ScriptOut:
    """生成颁奖读稿

    按指定方式排序（按年级/按班级/按学号），为每位获奖学生生成读稿文本。

    Args:
        award_id: 奖状ID
        group_by: 排序方式 — grade=按年级 / class=按班级 / student_no=按学号

    Returns:
        ScriptOut: 排序后的读稿列表
    """
    award = await repo.get_award(db, award_id)
    if not award:
        raise_error(*NOT_FOUND, detail={"award_id": award_id})

    recipients = list(award.recipients)

    if group_by == "grade":
        recipients.sort(key=lambda r: (r.student_grade or "", r.student_class, r.student_name))
    elif group_by == "student_no":
        # 按证书编号排序（如有），否则按姓名
        recipients.sort(key=lambda r: (r.certificate_no or "", r.student_name))
    else:
        # 默认按班级 + 姓名
        recipients.sort(key=lambda r: (r.student_class, r.student_name))

    award_title = award.template.name if award.template else award.title
    issue_year = str(award.issue_date)[:4] if award.issue_date else ""

    items: list[ScriptItem] = []
    for r in recipients:
        text = (
            f"【{r.student_name}】同學，就讀{r.student_class}，"
            f"在{issue_year}學年度中表現優異，榮獲「{award_title}」"
            f"{f'（{r.rank}）' if r.rank else ''}之殊榮。"
            f"請上台領獎，大家鼓掌！"
        )
        items.append(ScriptItem(
            student_name=r.student_name,
            student_class=r.student_class,
            student_grade=r.student_grade,
            script_text=text,
        ))

    return ScriptOut(award_title=award_title, total=len(items), items=items)
