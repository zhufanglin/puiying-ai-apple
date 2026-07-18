"""使用用户提供的 DeepSeek Key 对收据 OCR 原文做语义结构化。

API Key 只存在于单次函数调用和上游 Authorization 请求头中；本模块不记录、
不持久化，也不会把它放入异常消息或返回值。
"""

from __future__ import annotations

import json
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

AITransport = Callable[
    [str, dict[str, str], dict[str, Any], float],
    Awaitable[dict[str, Any]],
]


class AIReceiptError(RuntimeError):
    """可安全返回给前端的 AI 结构化错误。"""


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


def _extract_prompt_result(payload: dict[str, Any]) -> ReceiptPromptResult:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIReceiptError("DeepSeek 响应缺少结构化内容") from exc
    if not isinstance(content, str) or not content.strip():
        raise AIReceiptError("DeepSeek 返回了空内容，请重试")

    try:
        decoded = json.loads(_strip_json_fence(content))
        return ReceiptPromptResult.model_validate(decoded)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise AIReceiptError("DeepSeek 输出不符合收据 JSON 规范，请重试") from exc


def _normalized_evidence(value: str) -> str:
    return re.sub(r"[\s:：,，。;；()（）\[\]【】]", "", value).casefold()


def _has_text_evidence(value: str | None, source: str) -> bool:
    if not value:
        return True
    return _normalized_evidence(value) in _normalized_evidence(source)


def _money_candidates(text: str) -> list[float]:
    patterns = [
        r"(?:HK\$|HKD|港幣|港币|港元)\s*\$?\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
        r"(?:金額|金额|總額|总额|合計|合计)[：:\s]*"
        r"(?:HK\$|HKD|港幣|港币|港元|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
        r"\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
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
                values = [int(match.group(index)) for index in order]
                candidates.add(date(*values).isoformat())
            except ValueError:
                continue
    return candidates


def _append_warning(warnings: list[str], warning: str) -> None:
    if warning not in warnings:
        warnings.append(warning)


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
        r"HK\$|HKD|港幣|港币|港元|\$", source, re.I
    ):
        fields.currency = None
        _append_warning(warnings, "OCR 原文没有明确币别，币别未自动确认")

    if fields.date is not None and fields.date not in _date_candidates(source):
        fields.date = None
        confidence = "low"
        _append_warning(warnings, "模型日期无法在 OCR 原文中核对，已清空")

    if not _has_text_evidence(fields.payer, source):
        fields.payer = None
        confidence = "low"
        _append_warning(warnings, "模型付款人不在 OCR 原文中，已清空")

    if not _has_text_evidence(fields.purpose, source):
        fields.purpose = None
        confidence = "low"
        _append_warning(warnings, "模型用途不在 OCR 原文中，已清空")

    if result.raw_text != source:
        _append_warning(warnings, "模型未逐字返回 OCR 原文，系统已恢复原文")

    if fields.amount is None:
        confidence = "low"

    return ReceiptPromptResult(
        fields=fields,
        confidence=confidence,
        warnings=warnings[:20],
        raw_text=source,
    )


async def structure_receipt_with_ai(
    request: ReceiptAIStructureRequest,
    api_key: str,
    *,
    transport: AITransport | None = None,
) -> ReceiptAIStructureResponse:
    if not api_key or len(api_key.strip()) < 8:
        raise AIReceiptError("请输入有效的 DeepSeek API Key")

    line_payload = [line.model_dump(mode="json") for line in request.lines]
    prompt_input = {
        "source_file_id": request.source_file_id,
        "ocr_engine": request.ocr_engine,
        "ocr_text": request.ocr_text,
        "ocr_confidence": round(request.ocr_confidence / 100, 4),
        "page": request.page,
        "lines": line_payload,
    }
    payload = {
        "model": request.model,
        "messages": [
            {"role": "system", "content": load_receipt_prompt()},
            {
                "role": "user",
                "content": "请严格按系统指令输出一个 JSON 对象。输入数据如下：\n"
                + json.dumps(prompt_input, ensure_ascii=False),
            },
        ],
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "temperature": 0,
        "max_tokens": 1200,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    response = await (transport or _post_json)(
        DEEPSEEK_CHAT_URL,
        headers,
        payload,
        REQUEST_TIMEOUT_SECONDS,
    )
    validated = _validate_evidence(_extract_prompt_result(response), request)
    return ReceiptAIStructureResponse(
        **validated.model_dump(),
        provider="deepseek",
        model=request.model,
    )
