"""A2 财务收支 — 业务逻辑层

方法（严格按任务指南 §4.4）:
- create_income()             创建收入 + 审计日志
- create_expense()            创建支出 + 审计日志
- analyze_quotations()        报价单分析（AI 规则引擎）
- generate_address_labels()   地址标签生成
- get_finance_stats()         财务统计
- receipt_ocr_analyze()       收据 OCR 识别（对接 OCR Worker）
"""
import re
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.apple.finance.models import FinanceRecord, Quotation
from app.modules.apple.finance.repository import (
    create_record,
    get_quotations_grouped,
    get_record_by_id,
)
from app.modules.apple.finance.schemas import (
    QuotationAnalysisItem,
    QuotationAnalysisResponse,
)


# ============== 创建收入/支出（任务指南 §4.4） ==============

async def create_income(db: AsyncSession, data: dict, user_id: int) -> FinanceRecord:
    """创建收入记录 + 写审计日志"""
    from app.modules.audit.models import AuditLog

    data["type"] = "income"
    record = await create_record(db, data, user_id)

    log = AuditLog(
        user_id=user_id,
        action="create",
        module="finance",
        entity_type="income",
        entity_id=str(record.id),
    )
    db.add(log)

    return record


async def create_expense(db: AsyncSession, data: dict, user_id: int) -> FinanceRecord:
    """创建支出记录 + 写审计日志"""
    from app.modules.audit.models import AuditLog

    data["type"] = "expense"
    record = await create_record(db, data, user_id)

    log = AuditLog(
        user_id=user_id,
        action="create",
        module="finance",
        entity_type="expense",
        entity_id=str(record.id),
    )
    db.add(log)

    return record


async def get_finance_stats(db: AsyncSession, record_type: str) -> dict:
    """获取财务统计数据 — 任务指南 §4.4"""
    from app.modules.apple.finance.repository import get_finance_stats as _stats
    return await _stats(db, record_type)


# ============== 收据 OCR ==============

_RECEIPT_PATTERNS = {
    "amount": [
        r"HK\$\s*([\d,]+\.?\d*)", r"HKD\s*\$?\s*([\d,]+\.?\d*)",
        r"港幣\s*\$?\s*([\d,]+\.?\d*)", r"金額[：:\s]*\$?\s*([\d,]+\.?\d*)",
        r"金額[：:\s]*HK\$\s*([\d,]+\.?\d*)", r"總額[：:\s]*\$?\s*([\d,]+\.?\d*)",
        r"\$([\d,]+\.?\d*)",
    ],
    "date": [
        r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
        r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)",
        r"(\d{1,2})\/(\d{1,2})\/(\d{4})",
        r"日期[：:\s]*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
    ],
    "payer": [
        r"付款人[：:\s]*(.+)", r"經手人[：:\s]*(.+)",
        r"繳款人[：:\s]*(.+)", r"Payer[：:\s]*(.+)",
    ],
    "purpose": [
        r"用途[：:\s]*(.+)", r"項目[：:\s]*(.+)",
        r"事項[：:\s]*(.+)", r"Purpose[：:\s]*(.+)",
        r"備註[：:\s]*(.+)",
    ],
}


def _extract_field(text: str, patterns: list[str]) -> Optional[str]:
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            if m.lastindex and m.lastindex >= 3:
                groups = m.groups()
                if len(groups) == 3 and all(g and g.isdigit() for g in groups[:3] if g):
                    y, mo, d = groups[0], groups[1], groups[2]
                    return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
            return m.group(1).strip() if m.lastindex else m.group(0).strip()
    return None


def _parse_amount(raw: Optional[str]) -> Optional[float]:
    if not raw:
        return None
    cleaned = raw.replace(",", "").replace("，", "").replace(" ", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_ocr_result(raw_text: str) -> dict:
    amount_raw = _extract_field(raw_text, _RECEIPT_PATTERNS["amount"])
    date_raw = _extract_field(raw_text, _RECEIPT_PATTERNS["date"])
    payer_raw = _extract_field(raw_text, _RECEIPT_PATTERNS["payer"])
    purpose_raw = _extract_field(raw_text, _RECEIPT_PATTERNS["purpose"])

    amount = _parse_amount(amount_raw)
    date_val = date_raw or ""
    payer = (payer_raw or "").strip()
    purpose = (purpose_raw or "").strip()

    filled = sum([amount is not None, bool(date_val), bool(payer), bool(purpose)])
    confidence = "high" if filled >= 3 else "medium" if filled >= 2 else "low"

    warnings = []
    if amount is None: warnings.append("未能识别金额，请手动填写")
    if not date_val: warnings.append("未能识别日期，请手动选择")
    if not payer: warnings.append("未能识别付款人")
    if not purpose: warnings.append("未能识别用途，请手动填写")
    if confidence == "low": warnings.append("OCR 识别信心较低，建议手动核对所有字段")

    return {
        "amount": amount, "currency": "HKD", "date": date_val,
        "payer": payer, "purpose": purpose,
        "confidence": confidence, "warnings": warnings, "raw_text": raw_text,
    }


async def receipt_ocr_analyze(db: AsyncSession, file_id: int, user_id: int) -> dict:
    """收据 OCR 识别（对接 OCR Worker）

    流程: 查文件 → 创建 OCRJob → 提交 Celery → 轮询 → 结构化返回
    """
    from app.modules.files.models import File as FileModel
    from app.modules.ocr.models import OCRJob

    result = await db.execute(select(FileModel).where(FileModel.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        return {"amount": None, "currency": "HKD", "date": "", "payer": "", "purpose": "",
                "confidence": "low", "warnings": ["文件不存在"], "raw_text": ""}

    ocr_job = OCRJob(file_id=file_id, module="finance", status="pending", created_by=user_id)
    db.add(ocr_job)
    await db.flush()
    await db.refresh(ocr_job)

    raw_text = ""
    try:
        from workers.ocr_worker.tasks import process_receipt_ocr
        task = process_receipt_ocr.delay(ocr_job.id)
        result_data = task.get(timeout=120)
        if result_data and isinstance(result_data, dict):
            return result_data
    except Exception:
        pass

    try:
        from workers.ocr_worker.services.ocr_engine import recognize_file
        ocr_job.status = "processing"
        ocr_result = await recognize_file(file_record.stored_path)
        raw_text = ocr_result.get("raw_text", "")
        ocr_job.result_text = raw_text
        ocr_job.result_json = ocr_result
        ocr_job.status = "completed"
    except Exception as e:
        ocr_job.status = "failed"
        ocr_job.error_message = str(e)

    await db.flush()

    if raw_text:
        return _parse_ocr_result(raw_text)

    return {"amount": None, "currency": "HKD", "date": "", "payer": "", "purpose": "",
            "confidence": "low", "warnings": [ocr_job.error_message or "OCR 引擎不可用"], "raw_text": raw_text}


# ============== 报价单分析 ==============

async def quotation_analyze(db: AsyncSession) -> QuotationAnalysisResponse:
    """分析报价单 — 任务指南 §5.2 quotation_analyze_service"""
    grouped = await get_quotations_grouped(db)

    items: list[QuotationAnalysisItem] = []
    single_bid_count = 0
    non_lowest_count = 0

    for project_name, quotations in grouped.items():
        lowest: Optional[Quotation] = None
        selected: Optional[Quotation] = None
        for q in quotations:
            if q.is_lowest or (lowest is None or q.amount < lowest.amount):
                lowest = q
            if q.is_selected:
                selected = q

        if lowest is None:
            lowest = min(quotations, key=lambda x: x.amount)

        is_single = len(quotations) == 1
        non_low = selected is not None and lowest is not None and selected.id != lowest.id

        if is_single: single_bid_count += 1
        if non_low: non_lowest_count += 1

        warnings = []
        if is_single:
            warnings.append("该项目的仅有一家报价，建议增加比价")
        if non_low:
            warnings.append(
                f"最低报价为 {lowest.vendor}（HK$ {lowest.amount:,}），"
                f"但采纳了 {selected.vendor}（HK$ {selected.amount:,}），请确认原因"
            )

        items.append(QuotationAnalysisItem(
            project_name=project_name, quotation_count=len(quotations),
            lowest_vendor=lowest.vendor if lowest else None,
            lowest_amount=lowest.amount if lowest else None,
            selected_vendor=selected.vendor if selected else None,
            selected_amount=selected.amount if selected else None,
            is_single_bid=is_single, non_lowest_selected=non_low,
            warnings=warnings,
        ))

    summary = (
        f"共分析 {len(items)} 个项目，"
        f"其中 {single_bid_count} 个项目为单一报价，"
        f"{non_lowest_count} 个项目未采纳最低报价。"
    )

    return QuotationAnalysisResponse(items=items, summary=summary)


# ============== 地址标签 ==============

async def generate_address_labels(db: AsyncSession, record_ids: list[int]) -> list[str]:
    """生成地址 LABEL"""
    labels: list[str] = []
    for rid in record_ids:
        record = await get_record_by_id(db, rid)
        if record:
            labels.append(
                f"{record.project}\n"
                f"金額：HK$ {record.amount:,.2f}\n"
                f"日期：{record.date}\n"
                f"經手人：{record.handler}\n"
            )
    return labels
