"""使用用户提供的 DeepSeek Key 对收据 OCR 原文做语义结构化。

API Key 只存在于单次函数调用和上游 Authorization 请求头中；本模块不记录、
不持久化，也不会把它放入异常消息或返回值。
"""

from __future__ import annotations

import json
import logging
import math
import re
from collections.abc import Awaitable, Callable
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from pydantic import ValidationError

from app.modules.ocr.schemas import (
    ReceiptAIStructureRequest,
    ReceiptAIStructureResponse,
    ReceiptPromptResult,
)

DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions"
PROMPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "apple"
    / "prompts"
    / "receipt_extract_zh_hk.md"
)
REQUEST_TIMEOUT_SECONDS = 45.0
MAX_AI_ATTEMPTS = 2

logger = logging.getLogger(__name__)

AITransport = Callable[
    [str, dict[str, str], dict[str, Any], float],
    Awaitable[dict[str, Any]],
]


class AIReceiptError(RuntimeError):
    """可安全返回给前端的 AI 结构化错误。"""


class _PromptOutputError(RuntimeError):
    """模型响应无法安全归一化；只携带固定原因码，不携带响应正文。"""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


@lru_cache(maxsize=1)
def load_receipt_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise AIReceiptError("收据 Prompt 文件不可用") from exc


async def _post_json(
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout: float,
) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
        ) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise AIReceiptError("DeepSeek 请求超时，请稍后重试") from exc
    except httpx.RequestError as exc:
        raise AIReceiptError("无法连接 DeepSeek，请检查网络后重试") from exc

    if response.status_code == 401:
        raise AIReceiptError("DeepSeek API Key 无效")
    if response.status_code == 402:
        raise AIReceiptError("DeepSeek 账户余额不足")
    if response.status_code == 429:
        raise AIReceiptError("DeepSeek 请求过于频繁，请稍后重试")
    if response.status_code >= 500:
        raise AIReceiptError("DeepSeek 服务暂时不可用，请稍后重试")
    if response.status_code != 200:
        raise AIReceiptError(f"DeepSeek 请求失败（HTTP {response.status_code}）")

    try:
        data = response.json()
    except ValueError as exc:
        raise AIReceiptError("DeepSeek 返回了无法解析的响应") from exc
    if not isinstance(data, dict):
        raise AIReceiptError("DeepSeek 返回格式不正确")
    return data


def _strip_json_fence(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.I)
        content = re.sub(r"\s*```$", "", content)
    return content.strip()


_FIELD_NAMES = ("amount", "currency", "date", "payer", "purpose")
_MONEY_NUMBER_PATTERN = r"((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d.,])"
_NULL_TEXT_VALUES = {
    "",
    "null",
    "none",
    "n/a",
    "na",
    "unknown",
    "未知",
    "不明",
    "未识别",
    "未識別",
    "无法识别",
    "無法識別",
}


def _append_warning(warnings: list[str], warning: str) -> None:
    if warning not in warnings:
        warnings.append(warning)


def _log_prompt_rejection(
    attempt: int,
    reason: str,
    *,
    issues: list[str] | None = None,
) -> None:
    """仅记录固定原因码和 Schema 路径，绝不记录响应、OCR 原文或 Key。"""

    if issues:
        logger.warning(
            "DeepSeek receipt output rejected attempt=%s reason=%s issues=%s",
            attempt,
            reason,
            issues[:10],
        )
        return
    logger.warning(
        "DeepSeek receipt output rejected attempt=%s reason=%s",
        attempt,
        reason,
    )


def _is_null_text(value: str) -> bool:
    return value.strip().casefold() in _NULL_TEXT_VALUES


def _normalize_amount(value: Any, warnings: list[str]) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        _append_warning(warnings, "模型金额类型异常，已清空")
        return None
    if isinstance(value, (int, float)):
        try:
            amount = float(value)
        except (OverflowError, ValueError):
            _append_warning(warnings, "模型金额超出可处理范围，已清空")
            return None
        if math.isfinite(amount) and amount >= 0:
            return amount
        _append_warning(warnings, "模型金额不是有效非负数，已清空")
        return None
    if not isinstance(value, str) or _is_null_text(value):
        if value is not None and not isinstance(value, str):
            _append_warning(warnings, "模型金额类型异常，已清空")
        return None

    candidate = re.sub(
        r"^(?:HKD|HK\$|港幣|港币|港元)\s*",
        "",
        value.strip(),
        flags=re.I,
    ).strip()
    if not re.fullmatch(
        r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?",
        candidate,
    ):
        _append_warning(warnings, "模型金额格式异常，已清空")
        return None
    amount = float(candidate.replace(",", ""))
    if not math.isfinite(amount):
        _append_warning(warnings, "模型金额不是有限数值，已清空")
        return None
    return amount


def _normalize_currency(value: Any, warnings: list[str]) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        _append_warning(warnings, "模型币别类型异常，已清空")
        return None
    if _is_null_text(value):
        return None
    compact = re.sub(r"\s+", "", value).casefold()
    if compact in {"hkd", "hk$", "hkd$", "港幣", "港币", "港元"}:
        return "HKD"
    _append_warning(warnings, "模型币别不是明确的港币标记，已清空")
    return None


def _safe_iso_date(year: int, month: int, day: int) -> str | None:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _normalize_date(value: Any, warnings: list[str]) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        _append_warning(warnings, "模型日期类型异常，已清空")
        return None
    candidate = value.strip()
    if _is_null_text(candidate):
        return None

    year_first = re.fullmatch(
        r"(\d{4})\s*(?:年|[-/])\s*(\d{1,2})\s*(?:月|[-/])\s*(\d{1,2})\s*日?",
        candidate,
    )
    if year_first:
        normalized = _safe_iso_date(*(int(part) for part in year_first.groups()))
        if normalized:
            return normalized
        _append_warning(warnings, "模型日期不是有效日历日期，已清空")
        return None

    day_first = re.fullmatch(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", candidate)
    if day_first:
        day_value, month_value, year_value = (int(part) for part in day_first.groups())
        if day_value <= 12 and month_value <= 12:
            _append_warning(warnings, "模型日期的日月次序有歧义，已清空")
            return None
        normalized = _safe_iso_date(year_value, month_value, day_value)
        if normalized:
            return normalized

    _append_warning(warnings, "模型日期格式异常，已清空")
    return None


def _normalize_optional_text(
    value: Any,
    field_name: str,
    max_length: int,
    warnings: list[str],
) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        _append_warning(warnings, f"模型{field_name}类型异常，已清空")
        return None
    candidate = value.strip()
    if _is_null_text(candidate):
        return None
    if len(candidate) > max_length:
        _append_warning(warnings, f"模型{field_name}超过长度限制，已清空")
        return None
    return candidate


def _normalize_confidence(value: Any, warnings: list[str]) -> str:
    if isinstance(value, str):
        mapping = {
            "low": "low",
            "medium": "medium",
            "high": "high",
            "低": "low",
            "中": "medium",
            "高": "high",
        }
        normalized = mapping.get(value.strip().casefold())
        if normalized:
            return normalized
    _append_warning(warnings, "模型信心等级格式异常，已按低信心处理")
    return "low"


def _normalize_warnings(value: Any) -> list[str]:
    normalized: list[str] = []
    if value is None:
        return normalized
    if isinstance(value, str):
        candidates: list[Any] = [value]
    elif isinstance(value, list):
        candidates = value
    else:
        return ["模型警告格式异常，系统已忽略"]

    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        warning = candidate.strip()[:300]
        if warning:
            _append_warning(normalized, warning)
        if len(normalized) >= 10:
            break
    return normalized


def _select_model_object(decoded: Any, attempt: int) -> dict[str, Any]:
    if not isinstance(decoded, dict):
        _log_prompt_rejection(attempt, "top_level_not_object")
        raise _PromptOutputError("top_level_not_object")
    if "fields" in decoded or any(name in decoded for name in _FIELD_NAMES):
        return decoded
    for wrapper in ("result", "data", "receipt"):
        candidate = decoded.get(wrapper)
        if isinstance(candidate, dict) and (
            "fields" in candidate or any(name in candidate for name in _FIELD_NAMES)
        ):
            return candidate
    _log_prompt_rejection(attempt, "missing_fields")
    raise _PromptOutputError("missing_fields")


def _normalize_prompt_result(
    decoded: Any,
    source: str,
    attempt: int,
) -> ReceiptPromptResult:
    body = _select_model_object(decoded, attempt)
    raw_fields = body.get("fields")
    if raw_fields is None and any(name in body for name in _FIELD_NAMES):
        raw_fields = {name: body.get(name) for name in _FIELD_NAMES}
    if not isinstance(raw_fields, dict):
        _log_prompt_rejection(attempt, "fields_not_object")
        raise _PromptOutputError("fields_not_object")

    warnings = _normalize_warnings(body.get("warnings"))
    normalized = {
        "fields": {
            "amount": _normalize_amount(raw_fields.get("amount"), warnings),
            "currency": _normalize_currency(raw_fields.get("currency"), warnings),
            "date": _normalize_date(raw_fields.get("date"), warnings),
            "payer": _normalize_optional_text(
                raw_fields.get("payer"), "付款人", 200, warnings
            ),
            "purpose": _normalize_optional_text(
                raw_fields.get("purpose"), "用途", 500, warnings
            ),
        },
        "confidence": _normalize_confidence(body.get("confidence"), warnings),
        "warnings": warnings[:20],
        # OCR 原文来自受控请求，不信任也不要求模型逐字复述。
        "raw_text": source,
    }
    try:
        return ReceiptPromptResult.model_validate(normalized)
    except ValidationError as exc:
        issues = [
            ".".join(str(part) for part in error.get("loc", ()))
            + ":"
            + str(error.get("type", "unknown"))
            for error in exc.errors(include_url=False, include_input=False)
        ]
        _log_prompt_rejection(attempt, "schema_validation", issues=issues)
        raise _PromptOutputError("schema_validation") from None


def _extract_prompt_result(
    payload: dict[str, Any],
    source: str,
    attempt: int,
) -> ReceiptPromptResult:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        _log_prompt_rejection(attempt, "missing_content")
        raise _PromptOutputError("missing_content") from None
    if not isinstance(content, str) or not content.strip():
        _log_prompt_rejection(attempt, "empty_content")
        raise _PromptOutputError("empty_content")

    try:
        decoded = json.loads(_strip_json_fence(content))
    except json.JSONDecodeError as exc:
        _log_prompt_rejection(
            attempt,
            "json_decode",
            issues=[f"line={exc.lineno}", f"column={exc.colno}"],
        )
        raise _PromptOutputError("json_decode") from None
    return _normalize_prompt_result(decoded, source, attempt)


def _normalized_evidence(value: str) -> str:
    return re.sub(r"[\s:：,，。;；()（）\[\]【】]", "", value).casefold()


_PAYER_ONLY_LABELS = {
    "今收到",
    "收到",
    "付款人",
    "繳款人",
    "缴款人",
    "姓名",
    "payer",
}
_PURPOSE_ONLY_LABELS = {
    "用途",
    "事由",
    "摘要",
    "項目",
    "项目",
    "日期",
    "收據",
    "收据",
    "purpose",
}


def _is_label_only(value: str | None, labels: set[str]) -> bool:
    if not value:
        return False
    normalized = _normalized_evidence(value)
    return normalized in {_normalized_evidence(label) for label in labels}


def _has_text_evidence(value: str | None, source: str) -> bool:
    if not value:
        return True
    return _normalized_evidence(value) in _normalized_evidence(source)


def _money_candidates(text: str) -> list[float]:
    patterns = [
        rf"(?:HK\$|HKD|港幣|港币|港元)\s*\$?\s*{_MONEY_NUMBER_PATTERN}",
        r"(?:金額|金额|總額|总额|合計|合计)[：:\s]*"
        rf"(?:HK\$|HKD|港幣|港币|港元|\$)?\s*{_MONEY_NUMBER_PATTERN}",
        rf"\$\s*{_MONEY_NUMBER_PATTERN}",
    ]
    candidates: list[float] = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.I):
            try:
                value = float(match.group(1).replace(",", ""))
            except ValueError:
                continue
            if value not in candidates:
                candidates.append(value)
    return candidates


def _date_candidates(text: str) -> set[str]:
    candidates: set[str] = set()
    patterns = [
        (r"(?<!\d)(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", (1, 2, 3)),
        (r"(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)", (1, 2, 3)),
        (r"(?<!\d)(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?!\d)", (3, 2, 1)),
    ]
    for pattern, order in patterns:
        for match in re.finditer(pattern, text):
            try:
                if order == (3, 2, 1):
                    day_value = int(match.group(1))
                    month_value = int(match.group(2))
                    if day_value <= 12 and month_value <= 12:
                        continue
                values = [int(match.group(index)) for index in order]
                candidates.add(date(*values).isoformat())
            except ValueError:
                continue
    return candidates


def _validate_evidence(
    result: ReceiptPromptResult,
    request: ReceiptAIStructureRequest,
) -> ReceiptPromptResult:
    """清除没有 OCR 原文证据的模型字段，防止编号、幻觉内容自动入库。"""

    fields = result.fields.model_copy(deep=True)
    warnings = list(result.warnings)
    confidence = result.confidence
    source = request.ocr_text

    if fields.amount is not None:
        candidates = _money_candidates(source)
        if not any(abs(candidate - fields.amount) < 0.005 for candidate in candidates):
            fields.amount = None
            confidence = "low"
            _append_warning(warnings, "模型金额缺少货币或金额标签证据，已清空并要求人工填写")

    if fields.currency == "HKD" and not re.search(
        r"HK\$|HKD|港幣|港币|港元", source, re.I
    ):
        fields.currency = None
        _append_warning(warnings, "OCR 原文没有明确币别，币别未自动确认")

    if fields.date is not None and fields.date not in _date_candidates(source):
        fields.date = None
        confidence = "low"
        _append_warning(warnings, "模型日期无法在 OCR 原文中核对，已清空")

    if _is_label_only(fields.payer, _PAYER_ONLY_LABELS):
        fields.payer = None
        confidence = "low"
        _append_warning(warnings, "模型把付款标签当成付款人，已清空")
    elif not _has_text_evidence(fields.payer, source):
        fields.payer = None
        confidence = "low"
        _append_warning(warnings, "模型付款人不在 OCR 原文中，已清空")

    if _is_label_only(fields.purpose, _PURPOSE_ONLY_LABELS):
        fields.purpose = None
        confidence = "low"
        _append_warning(warnings, "模型把字段标签当成用途，已清空")
    elif not _has_text_evidence(fields.purpose, source):
        fields.purpose = None
        confidence = "low"
        _append_warning(warnings, "模型用途不在 OCR 原文中，已清空")

    if fields.amount is None or fields.date is None:
        confidence = "low"
    elif (
        fields.currency is None
        or fields.payer is None
        or fields.purpose is None
    ) and confidence == "high":
        confidence = "medium"

    return ReceiptPromptResult(
        fields=fields,
        confidence=confidence,
        warnings=warnings[:20],
        raw_text=source,
    )


def _build_deepseek_payload(
    request: ReceiptAIStructureRequest,
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
            "未知值使用 JSON null，禁止输出 raw_text、Markdown 或额外文字。输入数据如下：\n"
        )
    else:
        instruction = "请严格按系统指令只输出一个 JSON 对象。输入数据如下：\n"

    return {
        "model": request.model,
        "messages": [
            {"role": "system", "content": load_receipt_prompt()},
            {
                "role": "user",
                "content": instruction + json.dumps(prompt_input, ensure_ascii=False),
            },
        ],
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "temperature": 0,
        "max_tokens": 1200,
        "stream": False,
    }


async def structure_receipt_with_ai(
    request: ReceiptAIStructureRequest,
    api_key: str,
    *,
    transport: AITransport | None = None,
) -> ReceiptAIStructureResponse:
    if not api_key or len(api_key.strip()) < 8:
        raise AIReceiptError("请输入有效的 DeepSeek API Key")

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    caller = transport or _post_json
    for attempt in range(1, MAX_AI_ATTEMPTS + 1):
        response = await caller(
            DEEPSEEK_CHAT_URL,
            headers,
            _build_deepseek_payload(request, retry=attempt > 1),
            REQUEST_TIMEOUT_SECONDS,
        )
        try:
            prompt_result = _extract_prompt_result(
                response,
                request.ocr_text,
                attempt,
            )
        except _PromptOutputError:
            if attempt < MAX_AI_ATTEMPTS:
                continue
            raise AIReceiptError(
                "DeepSeek 已响应，但两次输出均不符合收据 JSON 规范，请稍后重试"
            ) from None

        validated = _validate_evidence(prompt_result, request)
        return ReceiptAIStructureResponse(
            **validated.model_dump(),
            provider="deepseek",
            model=request.model,
        )

    raise AIReceiptError("DeepSeek 收据结构化未完成")
