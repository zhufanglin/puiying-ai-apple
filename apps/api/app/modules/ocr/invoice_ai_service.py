"""使用用户提供的 DeepSeek Key 对资产发票 OCR 原文做安全结构化。

API Key 只存在于单次调用及发往 DeepSeek 的 Authorization 请求头；本模块不
记录、不持久化，也不会把 Key、OCR 原文或模型原始回复写入日志。
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.modules.ocr.receipt_ai_service import (
    AIReceiptError,
    AITransport,
    DEEPSEEK_CHAT_URL,
    MAX_AI_ATTEMPTS,
    REQUEST_TIMEOUT_SECONDS,
    _append_warning,
    _normalize_amount,
    _normalize_confidence,
    _normalize_currency,
    _normalize_date,
    _normalize_optional_text,
    _normalize_warnings,
    _normalized_evidence,
    _post_json,
    _strip_json_fence,
)
from app.modules.ocr.schemas import (
    InvoiceAIStructureRequest,
    InvoiceAIStructureResponse,
    InvoicePromptResult,
)

PROMPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "apple"
    / "prompts"
    / "invoice_asset_extract_zh_hk.md"
)

logger = logging.getLogger(__name__)


class AIInvoiceError(AIReceiptError):
    """可安全返回给前端的资产发票 AI 结构化错误。"""


class _InvoicePromptOutputError(RuntimeError):
    """只携带固定原因码，禁止携带模型响应正文。"""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


@lru_cache(maxsize=1)
def load_invoice_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise AIInvoiceError("资产发票 Prompt 文件不可用") from exc


_FIELD_NAMES = (
    "asset_name",
    "category",
    "amount",
    "currency",
    "purchase_date",
    "vendor",
    "invoice_no",
    "multiple_items",
)
_MONEY_NUMBER = r"(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?![\d.,])"
_MONEY_CURRENCY = r"(?:HKD|HK\$|\$|港幣|港币|港元)"
_HKD_MARKER = re.compile(r"HK\$|HKD|港幣|港币|港元", re.I)
_FOREIGN_CURRENCY_MARKER = re.compile(
    r"(?<![A-Z])(?:USD|EUR|GBP|CNY|RMB|JPY|AUD|CAD|SGD|MOP)(?![A-Z])|"
    r"US\$|CN¥|[€£¥]",
    re.I,
)
_NEGATIVE_OR_ACCOUNTING_MONEY = re.compile(
    rf"(?:[-−–—]\s*(?:{_MONEY_CURRENCY}\s*)?{_MONEY_NUMBER})|"
    rf"(?:{_MONEY_CURRENCY}\s*[-−–—]\s*{_MONEY_NUMBER})|"
    rf"(?:[（(]\s*(?:{_MONEY_CURRENCY}\s*)?{_MONEY_NUMBER}"
    rf"(?:\s*{_MONEY_CURRENCY})?\s*[）)])|"
    rf"(?:{_MONEY_CURRENCY}\s*[（(]\s*{_MONEY_NUMBER}\s*[）)])|"
    rf"(?:[（(]\s*{_MONEY_NUMBER}\s*[）)]\s*{_MONEY_CURRENCY})|"
    rf"(?:{_MONEY_NUMBER}\s*[-−–—])|"
    rf"(?:(?:CR|CREDIT)\s*(?:{_MONEY_CURRENCY}\s*)?{_MONEY_NUMBER})|"
    rf"(?:(?:{_MONEY_CURRENCY}\s*)?{_MONEY_NUMBER}\s*(?:CR|CREDIT)\b)",
    re.I,
)
_CREDIT_NOTE_CONTEXT = re.compile(
    r"\bcredit\s*(?:note|memo|advice)\b|^\s*(?:credit|cr)\s*$|"
    r"貸項通知|贷项通知|貸項備忘|贷项备忘|紅字發票|红字发票",
    re.I | re.M,
)

_CATEGORY_MAP = {
    "it設備": "IT設備",
    "it设备": "IT設備",
    "it": "IT設備",
    "資訊科技設備": "IT設備",
    "信息技术设备": "IT設備",
    "傢俱": "傢俱",
    "家具": "傢俱",
    "電器": "電器",
    "电器": "電器",
    "辦公設備": "辦公設備",
    "办公设备": "辦公設備",
    "其他": "其他",
}

_ASSET_LABELS = {
    "asset",
    "asset name",
    "item",
    "item name",
    "description",
    "product",
    "品名",
    "貨品",
    "货品",
    "商品",
    "產品",
    "产品",
    "描述",
}
_VENDOR_LABELS = {
    "vendor",
    "supplier",
    "seller",
    "供應商",
    "供应商",
    "賣方",
    "卖方",
}
_INVOICE_NO_LABELS = {
    "invoice no",
    "invoice number",
    "invoice #",
    "發票號碼",
    "发票号码",
    "發票編號",
    "发票编号",
}

_BUYER_CONTEXT = re.compile(
    r"bill\s*to|sold\s*to|ship\s*to|customer|client|客戶|客户|買方|买方|"
    r"收貨人|收货人|購買方|购买方",
    re.I,
)
_VENDOR_CONTEXT = re.compile(
    r"^\s*(?:(?:vendor|supplier|seller|from)\b|供應商|供应商|賣方|卖方)",
    re.I,
)
_INVOICE_NO_CONTEXT = re.compile(
    r"invoice\s*(?:no\.?|number|#)|發票\s*(?:號碼|編號|号|号码|编号)|"
    r"发票\s*(?:號碼|編號|号|号码|编号)",
    re.I,
)
_INVOICE_NO_VALUE_LINE = re.compile(
    r"^\s*(?:invoice\s*(?:no\.?|number|#)|"
    r"發票\s*(?:號碼|編號|号|号码|编号)|发票\s*(?:號碼|編號|号|号码|编号))"
    r"\s*[:：#\-]?\s*(\S.*?)\s*$",
    re.I,
)
_INVOICE_NO_LABEL_LINE = re.compile(
    r"^\s*(?:invoice\s*(?:no\.?|number|#)|"
    r"發票\s*(?:號碼|編號|号|号码|编号)|发票\s*(?:號碼|編號|号|号码|编号))"
    r"\s*[:：#\-]?\s*$",
    re.I,
)
_DATE_NEGATIVE_CONTEXT = re.compile(
    r"(?:printed?|order|payment|service|delivery|due|shipping|shipment|"
    r"dispatch|statement)\s*(?:date)?|打印|列印|订单|訂單|付款|服務|服务|"
    r"送貨|送货|到期|出貨|出货|發運|发运|結單|结单",
    re.I,
)
_INVOICE_DATE_CONTEXT = re.compile(
    r"invoice\s*date|發票日期|发票日期",
    re.I,
)
_GENERIC_DATE_CONTEXT = re.compile(r"^\s*(?:date|日期)\s*(?=[:：]|$)", re.I)
_DATE_TOKEN = re.compile(
    r"(?:\d{4}\s*(?:年|[-/])\s*\d{1,2}\s*(?:月|[-/])\s*\d{1,2}\s*日?"
    r"|\d{1,2}[-/]\d{1,2}[-/]\d{4})"
)
_STANDALONE_DATE = re.compile(
    r"^\s*(?:\d{4}\s*(?:年|[-/])\s*\d{1,2}\s*(?:月|[-/])\s*\d{1,2}\s*日?"
    r"|\d{1,2}[-/]\d{1,2}[-/]\d{4})\s*$"
)
_INVOICE_TOTAL_PRIORITY_CONTEXT = re.compile(
    r"grand\s*total|total\s*amount|invoice\s*total|"
    r"應付總額|应付总额|發票總額|发票总额|應付合計|应付合计",
    re.I,
)
_DUE_TOTAL_CONTEXT = re.compile(
    r"amount\s*due|balance\s*due|應付餘額|应付余额|未付餘額|未付余额",
    re.I,
)
_DUE_DISQUALIFYING_CONTEXT = re.compile(
    r"\bpaid\b|\bpayment\b|\bdeposit\b|\bcredit\b|credit\s*note|"
    r"已付|付款|訂金|订金|定金|貸項|贷项|紅字|红字",
    re.I,
)
_TOTAL_GENERIC_CONTEXT = re.compile(
    r"(?<!sub)\btotal\b|總額|总额|合計|合计",
    re.I,
)
_TOTAL_EXCLUDED_CONTEXT = re.compile(
    r"sub[\s-]*total|小計|小计|tax|vat|gst|稅|税|discount|折扣|"
    r"deposit|訂金|订金|change|找續|找续|unit\s*price|單價|单价|"
    r"quantity|qty|數量|数量|total\s*items|貨品總數|货品总数|paid|已付",
    re.I,
)

_DESCRIPTION_HEADER = re.compile(
    r"\bdescription\b|\bitem\s*(?:description|name)?\b|\bproduct\s*(?:name)?\b|"
    r"品名|貨品(?:名稱)?|货品(?:名称)?|產品(?:名稱)?|产品(?:名称)?|商品(?:名稱|名称)?|描述",
    re.I,
)
_QUANTITY_HEADER = re.compile(r"\bqty\b|\bquantity\b|數量|数量", re.I)
_OTHER_COLUMN_HEADER = re.compile(
    r"unit\s*price|price|amount|單價|单价|金額|金额|小計|小计",
    re.I,
)
_NUMERIC_COLUMN_HEADER = re.compile(
    r"unit\s*price|單價|单价|\bqty\b|\bquantity\b|數量|数量|"
    r"line\s*total|\btotal\b|amount|price|金額|金额|小計|小计",
    re.I,
)
_NON_NUMERIC_COLUMN_HEADER = re.compile(
    r"\bsku\b|\bmodel\b|\bcode\b|item\s*(?:no\.?|number)|"
    r"貨號|货号|型號|型号|編號|编号",
    re.I,
)
_TABLE_END = re.compile(
    r"grand\s*total|total\s*amount|amount\s*due|balance\s*due|"
    r"sub[\s-]*total|\btotal\b|總額|总额|合計|合计|tax|vat|gst|稅|税",
    re.I,
)
_SUBJECT_ENTITY = re.compile(
    r"\b(?:limited|ltd\.?|company|co\.?|school|college|university)\b|"
    r"有限公司|學校|学校|中學|中学|大學|大学|公司",
    re.I,
)
_ROW_TRAILING_VALUE = re.compile(
    r"\s+(?:(?:HKD|HK\$|\$)\s*)?"
    r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\s*$",
    re.I,
)
_LABELLED_INLINE_QUANTITY = re.compile(
    r"(?:\b(?:qty|quantity)\s*[:：=]?\s*|數量\s*[:：=]?\s*)(\d+)(?:\b|$)",
    re.I,
)
_MULTIPLIER_QUANTITY = re.compile(
    r"(?:(?<!\S)[xX]\s+|×\s*)(\d+)(?:\b|$)",
    re.I,
)
_COMPACT_ITEM_VALUE_LINE = re.compile(
    r"^\s*(?:item(?:\s*(?:name|description))?|product(?:\s*name)?|"
    r"品名|貨品(?:名稱)?|货品(?:名称)?|產品(?:名稱)?|产品(?:名称)?|"
    r"商品(?:名稱|名称)?)\s*[:：]\s*(.+?)\s*$",
    re.I,
)
_QUANTITY_VALUE_LINE = re.compile(
    r"^\s*(?:qty|quantity|數量|数量)\s*[:：]?\s*(\d+)\s*$",
    re.I,
)
_VENDOR_VALUE_LINE = re.compile(
    r"^\s*(?:(?:vendor|supplier|seller|from)\b|供應商|供应商|賣方|卖方)"
    r"\s*(?:[:：]\s*|\s+)(.+?)\s*$",
    re.I,
)
_VENDOR_LABEL_LINE = re.compile(
    r"^\s*(?:(?:vendor|supplier|seller|from)\b|供應商|供应商|賣方|卖方)"
    r"\s*[:：]?\s*$",
    re.I,
)
_BUYER_VALUE_LINE = re.compile(
    r"^\s*(?:bill\s*to|sold\s*to|ship\s*to|customer|client|客戶|客户|"
    r"買方|买方|收貨人|收货人|購買方|购买方)\s*(?:[:：]\s*|\s+)(.+?)\s*$",
    re.I,
)
_BUYER_LABEL_LINE = re.compile(
    r"^\s*(?:bill\s*to|sold\s*to|ship\s*to|customer|client|客戶|客户|"
    r"買方|买方|收貨人|收货人|購買方|购买方)\s*[:：]?\s*$",
    re.I,
)

_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "IT設備": (
        "laptop", "notebook", "computer", "desktop", "monitor", "server",
        "router", "network", "switch", "tablet", "ipad", "電腦", "电脑",
        "手提電腦", "手提电脑", "顯示器", "显示器", "伺服器", "服务器",
        "路由器", "網絡", "网络",
    ),
    "傢俱": (
        "desk", "chair", "cabinet", "shelf", "table", "sofa", "桌", "椅",
        "櫃", "柜", "架", "傢俱", "家具",
    ),
    "電器": (
        "air conditioner", "refrigerator", "fridge", "fan", "microwave",
        "kettle", "冷氣", "冷气", "空調", "空调", "雪櫃", "雪柜", "冰箱",
        "風扇", "风扇",
    ),
    "辦公設備": (
        "printer", "copier", "shredder", "photocopier", "打印機", "打印机",
        "印表機", "影印機", "影印机", "碎紙機", "碎纸机", "複印機", "复印机",
    ),
}


@dataclass(frozen=True)
class _AssetTableAnalysis:
    candidates: tuple[str, ...]
    quantities: tuple[int | None, ...]

    @property
    def single_item_confirmed(self) -> bool:
        return len(self.candidates) == 1 and self.quantities == (1,)


def _log_rejection(
    attempt: int,
    reason: str,
    *,
    issues: list[str] | None = None,
) -> None:
    if issues:
        logger.warning(
            "DeepSeek asset invoice output rejected attempt=%s reason=%s issues=%s",
            attempt,
            reason,
            issues[:10],
        )
        return
    logger.warning(
        "DeepSeek asset invoice output rejected attempt=%s reason=%s",
        attempt,
        reason,
    )


def _normalize_category(value: Any, warnings: list[str]) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        _append_warning(warnings, "模型资产分类类型异常，已清空")
        return None
    candidate = re.sub(r"\s+", "", value).casefold()
    if candidate in {"", "null", "none", "n/a", "未知", "不明"}:
        return None
    normalized = _CATEGORY_MAP.get(candidate)
    if normalized:
        return normalized
    _append_warning(warnings, "模型资产分类不在白名单内，已清空")
    return None


def _normalize_invoice_amount(value: Any, warnings: list[str]) -> float | None:
    amount = _normalize_amount(value, warnings)
    if amount is None:
        return None
    try:
        decimal_amount = Decimal(str(amount))
    except (InvalidOperation, ValueError):
        _append_warning(warnings, "模型金额无法精确到分，已清空")
        return None
    cents = decimal_amount * Decimal("100")
    if cents != cents.to_integral_value():
        _append_warning(warnings, "模型金额超过两位小数，已清空")
        return None
    return float(decimal_amount)


def _amount_in_cents(value: float) -> int | None:
    try:
        cents = Decimal(str(value)) * Decimal("100")
    except (InvalidOperation, ValueError):
        return None
    if cents != cents.to_integral_value():
        return None
    return int(cents)


def _normalize_multiple_items(value: Any, warnings: list[str]) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in {0, 1}:
        return bool(value)
    if isinstance(value, str):
        mapping = {
            "true": True,
            "yes": True,
            "是": True,
            "多項": True,
            "多项": True,
            "false": False,
            "no": False,
            "否": False,
            "單項": False,
            "单项": False,
        }
        normalized = mapping.get(value.strip().casefold())
        if normalized is not None:
            return normalized
    _append_warning(warnings, "模型未可靠说明是否为单项资产，已按多项处理")
    return True


def _select_model_object(decoded: Any, attempt: int) -> dict[str, Any]:
    if not isinstance(decoded, dict):
        _log_rejection(attempt, "top_level_not_object")
        raise _InvoicePromptOutputError("top_level_not_object")
    if "fields" in decoded or any(name in decoded for name in _FIELD_NAMES):
        return decoded
    for wrapper in ("result", "data", "invoice", "asset_invoice"):
        candidate = decoded.get(wrapper)
        if isinstance(candidate, dict) and (
            "fields" in candidate
            or any(name in candidate for name in _FIELD_NAMES)
        ):
            return candidate
    _log_rejection(attempt, "missing_fields")
    raise _InvoicePromptOutputError("missing_fields")


def _normalize_prompt_result(
    decoded: Any,
    source: str,
    attempt: int,
) -> InvoicePromptResult:
    body = _select_model_object(decoded, attempt)
    raw_fields = body.get("fields")
    if raw_fields is None and any(name in body for name in _FIELD_NAMES):
        raw_fields = {name: body.get(name) for name in _FIELD_NAMES}
    if not isinstance(raw_fields, dict):
        _log_rejection(attempt, "fields_not_object")
        raise _InvoicePromptOutputError("fields_not_object")

    warnings = _normalize_warnings(body.get("warnings"))
    normalized = {
        "fields": {
            "asset_name": _normalize_optional_text(
                raw_fields.get("asset_name"), "资产名称", 300, warnings
            ),
            "category": _normalize_category(raw_fields.get("category"), warnings),
            "amount": _normalize_invoice_amount(raw_fields.get("amount"), warnings),
            "currency": _normalize_currency(raw_fields.get("currency"), warnings),
            "purchase_date": _normalize_date(
                raw_fields.get("purchase_date"), warnings
            ),
            "vendor": _normalize_optional_text(
                raw_fields.get("vendor"), "供应商", 200, warnings
            ),
            "invoice_no": _normalize_optional_text(
                raw_fields.get("invoice_no"), "发票号码", 100, warnings
            ),
            "multiple_items": _normalize_multiple_items(
                raw_fields.get("multiple_items"), warnings
            ),
        },
        "confidence": _normalize_confidence(body.get("confidence"), warnings),
        "warnings": warnings[:20],
        # 原文由服务端补回，绝不信任模型提供的 raw_text。
        "raw_text": source,
    }
    try:
        return InvoicePromptResult.model_validate(normalized)
    except ValidationError as exc:
        issues = [
            ".".join(str(part) for part in error.get("loc", ()))
            + ":"
            + str(error.get("type", "unknown"))
            for error in exc.errors(include_url=False, include_input=False)
        ]
        _log_rejection(attempt, "schema_validation", issues=issues)
        raise _InvoicePromptOutputError("schema_validation") from None


def _extract_prompt_result(
    payload: dict[str, Any],
    source: str,
    attempt: int,
) -> InvoicePromptResult:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        _log_rejection(attempt, "missing_content")
        raise _InvoicePromptOutputError("missing_content") from None
    if not isinstance(content, str) or not content.strip():
        _log_rejection(attempt, "empty_content")
        raise _InvoicePromptOutputError("empty_content")

    try:
        decoded = json.loads(_strip_json_fence(content))
    except json.JSONDecodeError as exc:
        _log_rejection(
            attempt,
            "json_decode",
            issues=[f"line={exc.lineno}", f"column={exc.colno}"],
        )
        raise _InvoicePromptOutputError("json_decode") from None
    return _normalize_prompt_result(decoded, source, attempt)


def _is_label_only(value: str | None, labels: set[str]) -> bool:
    if not value:
        return False
    normalized = _normalized_evidence(value)
    return normalized in {_normalized_evidence(label) for label in labels}


def _has_text_evidence(value: str | None, source: str) -> bool:
    if not value:
        return True
    return _normalized_evidence(value) in _normalized_evidence(source)


def _number_values(text: str) -> list[float]:
    values: list[float] = []
    for match in re.finditer(_MONEY_NUMBER, text):
        try:
            value = float(match.group(0).replace(",", ""))
        except ValueError:
            continue
        if value not in values:
            values.append(value)
    return values


def _candidate_windows(lines: list[str], pattern: re.Pattern[str]) -> list[str]:
    windows: list[str] = []
    for index, line in enumerate(lines):
        if not pattern.search(line) or _TOTAL_EXCLUDED_CONTEXT.search(line):
            continue
        window = line
        if not _number_values(line) and index + 1 < len(lines):
            next_line = lines[index + 1]
            if not _TOTAL_EXCLUDED_CONTEXT.search(next_line):
                window = f"{line}\n{next_line}"
        windows.append(window)
    return windows


def _total_amount_candidates(source: str) -> list[float]:
    """只返回最终总额窗口自身明确标示 HKD 的候选金额。"""

    if _CREDIT_NOTE_CONTEXT.search(source):
        return []
    lines = [line.strip() for line in source.splitlines() if line.strip()]
    priority = _candidate_windows(lines, _INVOICE_TOTAL_PRIORITY_CONTEXT)
    generic = _candidate_windows(lines, _TOTAL_GENERIC_CONTEXT)
    if priority:
        windows = priority
    elif generic:
        windows = generic
    elif not _DUE_DISQUALIFYING_CONTEXT.search(source):
        windows = _candidate_windows(lines, _DUE_TOTAL_CONTEXT)
    else:
        windows = []

    values: list[float] = []
    for window in windows:
        if (
            not _HKD_MARKER.search(window)
            or _FOREIGN_CURRENCY_MARKER.search(window)
            or _NEGATIVE_OR_ACCOUNTING_MONEY.search(window)
            or _DUE_DISQUALIFYING_CONTEXT.search(window)
        ):
            continue
        for value in _number_values(window):
            if value not in values:
                values.append(value)
    return values


def _parse_dates(text: str) -> set[str]:
    candidates: set[str] = set()
    for match in re.finditer(
        r"(?<!\d)(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
        text,
    ):
        try:
            candidates.add(date(*(int(part) for part in match.groups())).isoformat())
        except ValueError:
            pass
    for match in re.finditer(
        r"(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)",
        text,
    ):
        try:
            candidates.add(date(*(int(part) for part in match.groups())).isoformat())
        except ValueError:
            pass
    for match in re.finditer(
        r"(?<!\d)(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?!\d)",
        text,
    ):
        first, second, year_value = (int(part) for part in match.groups())
        if first <= 12 and second <= 12:
            # 例如 06/07/2026 无法从 OCR 自身确认日月次序。
            continue
        if first > 12:
            day_value, month_value = first, second
        else:
            month_value, day_value = first, second
        try:
            candidates.add(date(year_value, month_value, day_value).isoformat())
        except ValueError:
            pass
    return candidates


def _invoice_date_candidates(source: str) -> set[str]:
    lines = [line.strip() for line in source.splitlines() if line.strip()]
    invoice_label_seen = False
    invoice_dates: set[str] = set()
    generic_labels: list[set[str]] = []

    def values_for_label(index: int) -> set[str]:
        line = lines[index]
        values = _parse_dates(line)
        if _DATE_TOKEN.search(line):
            # 标签同行已有日期形态但解析失败（例如日月歧义）时不得偷取下一行。
            return values
        if index + 1 < len(lines) and _STANDALONE_DATE.fullmatch(lines[index + 1]):
            values.update(_parse_dates(lines[index + 1]))
        return values

    for index, line in enumerate(lines):
        if _INVOICE_DATE_CONTEXT.search(line):
            invoice_label_seen = True
            if not _DATE_NEGATIVE_CONTEXT.search(line):
                invoice_dates.update(values_for_label(index))
            continue

        # 没有 Invoice Date 时只接受严格的 `Date:` / `日期：` 标签；Printed、
        # Order、Payment、Service、Delivery、Due 等上下文一律不是购买日期。
        if _GENERIC_DATE_CONTEXT.match(line) and not _DATE_NEGATIVE_CONTEXT.search(line):
            generic_labels.append(values_for_label(index))

    if invoice_label_seen:
        return invoice_dates
    if len(generic_labels) != 1:
        return set()
    return generic_labels[0]


def _is_party_name_value(value: str) -> bool:
    candidate = value.strip()
    if not candidate or len(candidate) > 200:
        return False
    if not re.search(r"[A-Za-z\u3400-\u9fff]", candidate):
        return False
    if (
        _INVOICE_NO_CONTEXT.search(candidate)
        or _BUYER_CONTEXT.search(candidate)
        or _VENDOR_CONTEXT.search(candidate)
        or _INVOICE_DATE_CONTEXT.search(candidate)
        or _GENERIC_DATE_CONTEXT.match(candidate)
        or _TABLE_END.search(candidate)
        or _DESCRIPTION_HEADER.search(candidate)
        or _QUANTITY_HEADER.search(candidate)
    ):
        return False
    return True


def _labeled_party_candidates(
    lines: list[str],
    value_pattern: re.Pattern[str],
    label_pattern: re.Pattern[str],
) -> set[str]:
    candidates: set[str] = set()
    for index, line in enumerate(lines):
        value_match = value_pattern.match(line)
        if value_match:
            value = value_match.group(1).strip()
            if _is_party_name_value(value):
                candidates.add(_normalized_evidence(value))
            continue
        if label_pattern.fullmatch(line) and index + 1 < len(lines):
            value = lines[index + 1].strip()
            if _is_party_name_value(value):
                candidates.add(_normalized_evidence(value))
    return candidates


def _vendor_has_seller_context(value: str, source: str) -> bool:
    normalized_value = _normalized_evidence(value)
    if not _is_party_name_value(value):
        return False
    lines = [line.strip() for line in source.splitlines() if line.strip()]
    sellers = _labeled_party_candidates(
        lines,
        _VENDOR_VALUE_LINE,
        _VENDOR_LABEL_LINE,
    )
    buyers = _labeled_party_candidates(
        lines,
        _BUYER_VALUE_LINE,
        _BUYER_LABEL_LINE,
    )
    return normalized_value in sellers and normalized_value not in buyers


def _is_independent_invoice_identifier(value: str) -> bool:
    candidate = value.strip()
    if not candidate or len(candidate) > 100:
        return False
    if not re.search(r"[A-Za-z0-9\u3400-\u9fff]", candidate):
        return False
    if len(candidate.split()) > 5:
        return False
    if (
        _TABLE_END.search(candidate)
        or _DATE_NEGATIVE_CONTEXT.search(candidate)
        or _INVOICE_DATE_CONTEXT.search(candidate)
        or _GENERIC_DATE_CONTEXT.match(candidate)
        or _DATE_TOKEN.search(candidate)
        or _HKD_MARKER.search(candidate)
        or "$" in candidate
        or _BUYER_CONTEXT.search(candidate)
        or _VENDOR_CONTEXT.search(candidate)
        or _DESCRIPTION_HEADER.search(candidate)
        or _QUANTITY_HEADER.search(candidate)
        or _OTHER_COLUMN_HEADER.search(candidate)
    ):
        return False
    if re.match(r"^\s*[-−–—]", candidate) or re.fullmatch(r"\s*\(.+\)\s*", candidate):
        return False
    if re.fullmatch(r"\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}", candidate):
        return False
    return True


def _invoice_no_has_context(value: str, source: str) -> bool:
    normalized_value = _normalized_evidence(value)
    lines = [line.strip() for line in source.splitlines() if line.strip()]

    for index, line in enumerate(lines):
        same_line = _INVOICE_NO_VALUE_LINE.match(line)
        if same_line:
            captured = same_line.group(1).strip()
            if (
                _normalized_evidence(captured) == normalized_value
                and _is_independent_invoice_identifier(captured)
            ):
                return True

        if not _INVOICE_NO_LABEL_LINE.fullmatch(line) or index + 1 >= len(lines):
            continue
        next_line = lines[index + 1].strip()
        if (
            _normalized_evidence(next_line) == normalized_value
            and _is_independent_invoice_identifier(next_line)
        ):
            return True
    return False


def _is_description_header(line: str) -> bool:
    stripped = line.strip()
    if _COMPACT_ITEM_VALUE_LINE.match(stripped):
        return False
    normalized = _normalized_evidence(stripped)
    exact_labels = {_normalized_evidence(label) for label in _ASSET_LABELS}
    if normalized in exact_labels:
        return True
    return bool(
        _DESCRIPTION_HEADER.search(stripped)
        and (_QUANTITY_HEADER.search(stripped) or _OTHER_COLUMN_HEADER.search(stripped))
    )


def _strip_item_prefix(value: str) -> str:
    return re.sub(
        r"^\s*(?:item|項目|项目|貨品|货品)\s*(?:no\.?|#)?\s*\d+\s*"
        r"(?:[:：.\-]\s*)?",
        "",
        value,
        flags=re.I,
    ).strip()


def _quantity_column_index(header: str) -> int | None:
    quantity_match = _QUANTITY_HEADER.search(header)
    if not quantity_match:
        return None
    prefix = header[: quantity_match.start()]
    unexplained = _DESCRIPTION_HEADER.sub(" ", prefix)
    unexplained = _NUMERIC_COLUMN_HEADER.sub(" ", unexplained)
    unexplained = _NON_NUMERIC_COLUMN_HEADER.sub(" ", unexplained)
    if re.search(r"[A-Za-z\u3400-\u9fff]", unexplained):
        return None
    return len(list(_NUMERIC_COLUMN_HEADER.finditer(prefix)))


def _numeric_column_count(header: str) -> int | None:
    count = len(list(_NUMERIC_COLUMN_HEADER.finditer(header)))
    return count or None


def _row_name_and_quantity(
    line: str,
    *,
    quantity_column_index: int | None,
    numeric_column_count: int | None,
) -> tuple[str | None, int | None]:
    candidate = line.strip()

    labelled_value = re.match(
        r"^\s*(?:description|item(?:\s*(?:name|description))?|product(?:\s*name)?|"
        r"品名|貨品名稱|货品名称|產品名稱|产品名称|商品名稱|商品名称|描述)"
        r"\s*[:：]\s*(.+)$",
        candidate,
        re.I,
    )
    if labelled_value:
        candidate = labelled_value.group(1).strip()
    else:
        candidate = _strip_item_prefix(candidate)

    labelled_quantity = _LABELLED_INLINE_QUANTITY.search(candidate)
    if labelled_quantity:
        quantity = int(labelled_quantity.group(1))
        candidate = candidate[: labelled_quantity.start()].strip(" -:：|/")
        return candidate or None, quantity

    multiplier_quantity = _MULTIPLIER_QUANTITY.search(candidate)
    candidate_before_values = candidate

    trailing_values: list[float] = []
    while True:
        if (
            numeric_column_count is not None
            and len(trailing_values) >= numeric_column_count
        ):
            break
        trailing = _ROW_TRAILING_VALUE.search(candidate)
        if not trailing:
            break
        number_text = trailing.group(0)
        number_match = re.search(
            r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?",
            number_text,
        )
        if number_match:
            trailing_values.append(float(number_match.group(0).replace(",", "")))
        candidate = candidate[: trailing.start()].rstrip()
    trailing_values.reverse()

    quantity: int | None = None
    if (
        quantity_column_index is not None
        and numeric_column_count is not None
        and len(trailing_values) == numeric_column_count
        and len(trailing_values) > quantity_column_index
    ):
        quantity_value = trailing_values[quantity_column_index]
        if quantity_value.is_integer() and quantity_value >= 0:
            quantity = int(quantity_value)
        candidate = re.sub(r"\s*[x×]\s*$", "", candidate, flags=re.I).rstrip()
        return candidate or None, quantity

    if multiplier_quantity:
        quantity = int(multiplier_quantity.group(1))
        candidate = candidate_before_values[: multiplier_quantity.start()].strip(
            " -:：|/"
        )
    return candidate or None, quantity


def _is_meaningful_asset_candidate(value: str | None) -> bool:
    if not value:
        return False
    candidate = value.strip()
    if _is_label_only(candidate, _ASSET_LABELS):
        return False
    if not re.search(r"[A-Za-z\u3400-\u9fff]", candidate):
        return False
    if len(re.sub(r"[^A-Za-z0-9\u3400-\u9fff]", "", candidate)) < 2:
        return False
    if _SUBJECT_ENTITY.search(candidate):
        return False
    if (
        _BUYER_CONTEXT.search(candidate)
        or _VENDOR_CONTEXT.search(candidate)
        or _INVOICE_NO_CONTEXT.search(candidate)
        or _INVOICE_DATE_CONTEXT.search(candidate)
        or _GENERIC_DATE_CONTEXT.match(candidate)
        or _TABLE_END.search(candidate)
    ):
        return False
    return True


def _document_party_names(lines: list[str]) -> set[str]:
    return _labeled_party_candidates(
        lines,
        _VENDOR_VALUE_LINE,
        _VENDOR_LABEL_LINE,
    ) | _labeled_party_candidates(
        lines,
        _BUYER_VALUE_LINE,
        _BUYER_LABEL_LINE,
    )


def _analyze_compact_item_labels(
    lines: list[str],
    party_names: set[str],
) -> _AssetTableAnalysis:
    candidates: list[str] = []
    quantities: list[int | None] = []

    for index, line in enumerate(lines):
        if not _COMPACT_ITEM_VALUE_LINE.match(line):
            continue
        name, quantity = _row_name_and_quantity(
            line,
            quantity_column_index=None,
            numeric_column_count=None,
        )
        if not _is_meaningful_asset_candidate(name):
            continue
        assert name is not None
        if _normalized_evidence(name) in party_names:
            continue
        if quantity is None:
            adjacent = []
            if index > 0:
                adjacent.append(lines[index - 1])
            if index + 1 < len(lines):
                adjacent.append(lines[index + 1])
            for candidate_line in adjacent:
                quantity_match = _QUANTITY_VALUE_LINE.fullmatch(candidate_line)
                if quantity_match:
                    quantity = int(quantity_match.group(1))
                    break
        candidates.append(name)
        quantities.append(quantity)

    return _AssetTableAnalysis(
        candidates=tuple(candidates),
        quantities=tuple(quantities),
    )


def _quantity_after_item(
    lines: list[str],
    item_index: int,
    *,
    quantity_column_index: int | None,
    numeric_column_count: int | None,
) -> int | None:
    quantity_label_seen = False
    numeric_position = 0
    for line in lines[item_index + 1 : item_index + 5]:
        stripped = line.strip()
        if not stripped:
            continue
        if _TABLE_END.search(stripped) or _is_description_header(stripped):
            break
        labelled = re.fullmatch(
            r"(?:qty|quantity|數量|数量)\s*[:：]?\s*(\d+)?",
            stripped,
            re.I,
        )
        if labelled:
            quantity_label_seen = True
            if labelled.group(1) is not None:
                return int(labelled.group(1))
            continue
        numeric_cell = re.fullmatch(
            rf"(?:{_MONEY_CURRENCY}\s*)?({_MONEY_NUMBER})",
            stripped,
            re.I,
        )
        if numeric_cell:
            numeric_value = Decimal(numeric_cell.group(1).replace(",", ""))
            if quantity_label_seen:
                return int(numeric_value) if numeric_value == int(numeric_value) else None
            if quantity_column_index is None:
                return None
            if numeric_position == quantity_column_index:
                return int(numeric_value) if numeric_value == int(numeric_value) else None
            numeric_position += 1
            continue
        parsed_name, _ = _row_name_and_quantity(
            stripped,
            quantity_column_index=quantity_column_index,
            numeric_column_count=numeric_column_count,
        )
        if _is_meaningful_asset_candidate(parsed_name):
            break
    return None


def _analyze_asset_table(source: str) -> _AssetTableAnalysis:
    lines = [line.strip() for line in source.splitlines() if line.strip()]
    party_names = _document_party_names(lines)
    header_indices = [
        index for index, line in enumerate(lines) if _is_description_header(line)
    ]
    if not header_indices:
        return _analyze_compact_item_labels(lines, party_names)
    if len(header_indices) != 1:
        return _AssetTableAnalysis(candidates=(), quantities=())

    header_index = header_indices[0]
    quantity_column_index = _quantity_column_index(lines[header_index])
    numeric_column_count = _numeric_column_count(lines[header_index])
    candidates: list[str] = []
    quantities: list[int | None] = []

    for index in range(header_index + 1, len(lines)):
        line = lines[index]
        if _TABLE_END.search(line):
            break
        if _is_description_header(line):
            # 重复表头代表另一段/另一页明细，无法确认只有一项。
            return _AssetTableAnalysis(candidates=tuple(candidates), quantities=tuple(quantities))
        if re.fullmatch(
            r"(?:qty|quantity|數量|数量|unit\s*price|price|amount|單價|单价|金額|金额)",
            line,
            re.I,
        ):
            if _QUANTITY_HEADER.fullmatch(line):
                quantity_column_index = 0
                numeric_column_count = 1
            continue

        name, quantity = _row_name_and_quantity(
            line,
            quantity_column_index=quantity_column_index,
            numeric_column_count=numeric_column_count,
        )
        if not _is_meaningful_asset_candidate(name):
            continue
        assert name is not None
        if _normalized_evidence(name) in party_names:
            continue
        if quantity is None:
            quantity = _quantity_after_item(
                lines,
                index,
                quantity_column_index=quantity_column_index,
                numeric_column_count=numeric_column_count,
            )
        candidates.append(name)
        quantities.append(quantity)

    return _AssetTableAnalysis(
        candidates=tuple(candidates),
        quantities=tuple(quantities),
    )


def _asset_name_matches_table(value: str | None, analysis: _AssetTableAnalysis) -> bool:
    if not _is_meaningful_asset_candidate(value):
        return False
    if len(analysis.candidates) != 1 or value is None:
        return False
    return _normalized_evidence(value) == _normalized_evidence(analysis.candidates[0])


def _source_requires_multiple_items(
    source: str,
    analysis: _AssetTableAnalysis,
) -> bool:
    quantity_patterns = [
        r"(?:qty|quantity|數量|数量)\s*[:：]?\s*(?:\r?\n\s*)?"
        r"([2-9]|[1-9]\d+)",
        r"(?:[2-9]|[1-9]\d+)\s*[x×]\s+[^\n]+",
        r"[^\n]+(?:\s+[xX]\s+|×\s*)(?:[2-9]|[1-9]\d+)\b",
        r"(?:total\s*items|貨品總數|货品总数|項目總數|项目总数)\s*[:：]?\s*"
        r"([2-9]|[1-9]\d+)",
    ]
    if any(re.search(pattern, source, re.I) for pattern in quantity_patterns):
        return True

    numbered_items = re.findall(
        r"(?:item|項目|项目|貨品|货品)\s*(?:no\.?|#)?\s*\d+",
        source,
        re.I,
    )
    if len(numbered_items) >= 2:
        return True

    # 只有表格区恰好一条明细，且该条数量明确为 1，才允许单项回填。
    return not analysis.single_item_confirmed


def _category_from_asset_name(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.casefold()
    matches = [
        category
        for category, keywords in _CATEGORY_KEYWORDS.items()
        if any(keyword.casefold() in normalized for keyword in keywords)
    ]
    return matches[0] if len(matches) == 1 else None


def _validate_evidence(
    result: InvoicePromptResult,
    request: InvoiceAIStructureRequest,
) -> InvoicePromptResult:
    fields = result.fields.model_copy(deep=True)
    warnings = list(result.warnings)
    confidence = result.confidence
    source = request.ocr_text
    table_analysis = _analyze_asset_table(source)
    total_candidates = _total_amount_candidates(source)

    if _source_requires_multiple_items(source, table_analysis):
        if not fields.multiple_items:
            _append_warning(
                warnings,
                "OCR 明细表无法确认恰好一项且数量为 1，已禁止单项资产回填",
            )
        fields.multiple_items = True

    if not _asset_name_matches_table(fields.asset_name, table_analysis):
        fields.asset_name = None
        confidence = "low"
        _append_warning(
            warnings,
            "模型资产名称不是 Description/Item 明细区的唯一候选，已清空",
        )

    if fields.asset_name is None and fields.category is not None:
        fields.category = None
        _append_warning(warnings, "缺少可核对的资产名称，资产分类已清空")

    if fields.asset_name is None:
        fields.multiple_items = True
        confidence = "low"
        _append_warning(
            warnings,
            "无法从 OCR 原文确认一项具体资产，已禁止单项资产回填",
        )

    expected_category = _category_from_asset_name(fields.asset_name)
    if (
        fields.category is not None
        and expected_category is not None
        and fields.category != expected_category
    ):
        fields.category = None
        if confidence == "high":
            confidence = "medium"
        _append_warning(
            warnings,
            f"资产名称明显属于{expected_category}，与模型分类冲突，分类已清空",
        )

    if fields.amount is not None:
        model_cents = _amount_in_cents(fields.amount)
        candidate_cents = (
            _amount_in_cents(total_candidates[0])
            if len(total_candidates) == 1
            else None
        )
        if (
            len(total_candidates) != 1
            or model_cents is None
            or candidate_cents != model_cents
        ):
            fields.amount = None
            confidence = "low"
            if len(total_candidates) > 1:
                _append_warning(warnings, "OCR 原文存在冲突的最终总额，金额已清空")
            else:
                _append_warning(
                    warnings,
                    "模型金额缺少明确 HKD 最终总额证据，已清空并要求人工填写",
                )

    if fields.currency == "HKD" and len(total_candidates) != 1:
        fields.currency = None
        confidence = "low"
        _append_warning(
            warnings,
            "最终总额窗口没有唯一且明确的港币证据，币别已清空",
        )

    if fields.purchase_date is not None:
        candidates = _invoice_date_candidates(source)
        if len(candidates) != 1 or fields.purchase_date not in candidates:
            fields.purchase_date = None
            confidence = "low"
            if len(candidates) > 1:
                _append_warning(warnings, "发票日期存在多个候选，已清空")
            else:
                _append_warning(
                    warnings,
                    "模型日期无法作为非歧义发票日期在 OCR 原文中核对，已清空",
                )

    if _is_label_only(fields.vendor, _VENDOR_LABELS):
        fields.vendor = None
        _append_warning(warnings, "模型把供应商标签当成供应商名称，已清空")
    elif fields.vendor and not _vendor_has_seller_context(fields.vendor, source):
        fields.vendor = None
        _append_warning(
            warnings,
            "模型供应商只出现在 Bill To/Sold To 等买方位置，已清空",
        )

    if _is_label_only(fields.invoice_no, _INVOICE_NO_LABELS):
        fields.invoice_no = None
        _append_warning(warnings, "模型把发票号标签当成号码，已清空")
    elif fields.invoice_no and not _invoice_no_has_context(fields.invoice_no, source):
        fields.invoice_no = None
        _append_warning(warnings, "模型发票号缺少发票号码标签证据，已清空")

    if request.ocr_confidence < 50:
        fields.multiple_items = True
        fields.asset_name = None
        fields.category = None
        fields.amount = None
        confidence = "low"
        _append_warning(
            warnings,
            "OCR 整体信心低于 50，已禁止自动回填资产名称、分类及金额",
        )

    if fields.multiple_items:
        fields.asset_name = None
        fields.category = None
        fields.amount = None
        confidence = "low"
        _append_warning(
            warnings,
            "发票包含多项、数量大于 1 或无法确认单项，须人工拆分资产",
        )

    if (
        fields.asset_name is None
        or fields.amount is None
        or fields.currency is None
        or fields.purchase_date is None
    ):
        confidence = "low"
    elif (fields.vendor is None or fields.category is None) and confidence == "high":
        confidence = "medium"

    return InvoicePromptResult(
        fields=fields,
        confidence=confidence,
        warnings=warnings[:20],
        raw_text=source,
    )


def _build_deepseek_payload(
    request: InvoiceAIStructureRequest,
    *,
    retry: bool,
) -> dict[str, Any]:
    prompt_input = {
        "source_file_id": request.source_file_id,
        "ocr_engine": request.ocr_engine,
        "ocr_text": request.ocr_text,
        "ocr_confidence": round(request.ocr_confidence / 100, 4),
        "page": request.page,
        "lines": [line.model_dump(mode="json") for line in request.lines],
    }
    if retry:
        instruction = (
            "上一次回复无法通过 JSON 格式检查。请重新从以下原始 OCR 输入提取，"
            "不要参考或复述上一次回复。只输出 fields、confidence、warnings 三个顶层键；"
            "未知值使用 JSON null，multiple_items 使用 JSON boolean；禁止输出 raw_text、"
            "Markdown 或额外文字。输入数据如下：\n"
        )
    else:
        instruction = "请严格按系统指令只输出一个 JSON 对象。输入数据如下：\n"

    return {
        "model": request.model,
        "messages": [
            {"role": "system", "content": load_invoice_prompt()},
            {
                "role": "user",
                "content": instruction + json.dumps(prompt_input, ensure_ascii=False),
            },
        ],
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "temperature": 0,
        "max_tokens": 1600,
        "stream": False,
    }


async def structure_invoice_with_ai(
    request: InvoiceAIStructureRequest,
    api_key: str,
    *,
    transport: AITransport | None = None,
) -> InvoiceAIStructureResponse:
    if not api_key or len(api_key.strip()) < 8:
        raise AIInvoiceError("请输入有效的 DeepSeek API Key")

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    caller = transport or _post_json
    for attempt in range(1, MAX_AI_ATTEMPTS + 1):
        try:
            response = await caller(
                DEEPSEEK_CHAT_URL,
                headers,
                _build_deepseek_payload(request, retry=attempt > 1),
                REQUEST_TIMEOUT_SECONDS,
            )
        except AIInvoiceError:
            raise
        except AIReceiptError as exc:
            # 共用的 HTTP 传输层只会产生固定安全消息；转成模块专用异常。
            raise AIInvoiceError(str(exc)) from exc
        try:
            prompt_result = _extract_prompt_result(
                response,
                request.ocr_text,
                attempt,
            )
        except _InvoicePromptOutputError:
            if attempt < MAX_AI_ATTEMPTS:
                continue
            raise AIInvoiceError(
                "DeepSeek 已响应，但两次输出均不符合资产发票 JSON 规范，请稍后重试"
            ) from None

        validated = _validate_evidence(prompt_result, request)
        return InvoiceAIStructureResponse(
            **validated.model_dump(),
            provider="deepseek",
            model=request.model,
        )

    raise AIInvoiceError("DeepSeek 资产发票结构化未完成")
