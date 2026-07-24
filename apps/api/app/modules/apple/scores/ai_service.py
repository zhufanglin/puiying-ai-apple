"""以使用者單次提供的 DeepSeek Key 生成繁體中文成績評語。"""
from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable
from functools import lru_cache
from pathlib import Path
from typing import Any

DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions"
PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "score_comment_zh_hk.md"
REQUEST_TIMEOUT_SECONDS = 45.0
MAX_AI_ATTEMPTS = 3

AITransport = Callable[
    [str, dict[str, str], dict[str, Any], float],
    Awaitable[dict[str, Any]],
]


class ScoreAIError(RuntimeError):
    """可安全回傳前端、不包含 Key 或模型原始輸出的錯誤。"""


class _InvalidModelOutput(RuntimeError):
    pass


@lru_cache(maxsize=1)
def load_score_comment_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise ScoreAIError("成績評語 Prompt 文件不可用") from exc


async def _post_json(
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout: float,
) -> dict[str, Any]:
    try:
        import httpx
    except ImportError as exc:  # requirements.txt 正常安裝時不會觸發
        raise ScoreAIError("後端缺少 httpx，暫時無法連接 DeepSeek") from exc
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise ScoreAIError("DeepSeek 請求逾時，請稍後重試") from exc
    except httpx.RequestError as exc:
        raise ScoreAIError("無法連接 DeepSeek，請檢查網絡後重試") from exc

    if response.status_code == 401:
        raise ScoreAIError("DeepSeek API Key 無效")
    if response.status_code == 402:
        raise ScoreAIError("DeepSeek 帳戶餘額不足")
    if response.status_code == 429:
        raise ScoreAIError("DeepSeek 請求過於頻繁，請稍後重試")
    if response.status_code >= 500:
        raise ScoreAIError("DeepSeek 服務暫時不可用，請稍後重試")
    if response.status_code != 200:
        raise ScoreAIError(f"DeepSeek 請求失敗（HTTP {response.status_code}）")
    try:
        data = response.json()
    except ValueError as exc:
        raise ScoreAIError("DeepSeek 回傳無法解析的內容") from exc
    if not isinstance(data, dict):
        raise ScoreAIError("DeepSeek 回傳格式不正確")
    return data


def _strip_json_fence(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.I)
        content = re.sub(r"\s*```$", "", content)
    return content.strip()


def _extract_comment(response: dict[str, Any]) -> dict[str, str | None]:
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise _InvalidModelOutput("missing_content") from exc
    if not isinstance(content, str):
        raise _InvalidModelOutput("invalid_content")
    try:
        value = json.loads(_strip_json_fence(content))
    except (json.JSONDecodeError, TypeError) as exc:
        raise _InvalidModelOutput("invalid_json") from exc
    if not isinstance(value, dict):
        raise _InvalidModelOutput("invalid_object")

    comment_text = str(value.get("comment_text") or "").strip()
    compact_length = len(re.sub(r"\s+", "", comment_text))
    if compact_length < 80 or compact_length > 120:
        raise _InvalidModelOutput("invalid_comment_length")

    def optional_text(name: str, max_length: int) -> str | None:
        raw = value.get(name)
        if raw is None:
            return None
        result = str(raw).strip()
        return result[:max_length] or None

    return {
        "comment_text": comment_text,
        "highlight_subject": optional_text("highlight_subject", 80),
        "improve_subject": optional_text("improve_subject", 80),
        "suggestion": optional_text("suggestion", 1000),
    }


def _payload(profile: dict[str, Any], model: str, *, retry: bool) -> dict[str, Any]:
    instruction = (
        "上一次輸出未通過 JSON 或字數檢查，請重新生成。"
        if retry
        else "請根據以下資料生成評語。"
    )
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": load_score_comment_prompt()},
            {
                "role": "user",
                "content": instruction + "只輸出 JSON。學生資料：\n" + json.dumps(profile, ensure_ascii=False),
            },
        ],
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "temperature": 0.4,
        "max_tokens": 800,
        "stream": False,
    }


async def generate_comment_with_ai(
    profile: dict[str, Any],
    api_key: str,
    model: str,
    *,
    transport: AITransport | None = None,
) -> dict[str, str | None]:
    """生成一名學生的評語；格式不合格時最多重試三次。"""

    if not api_key or len(api_key.strip()) < 8:
        raise ScoreAIError("請輸入有效的 DeepSeek API Key")
    if not model.startswith("deepseek-"):
        raise ScoreAIError("DeepSeek 模型名稱必須以 deepseek- 開頭")
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
            _payload(profile, model, retry=attempt > 1),
            REQUEST_TIMEOUT_SECONDS,
        )
        try:
            return _extract_comment(response)
        except _InvalidModelOutput:
            if attempt == MAX_AI_ATTEMPTS:
                raise ScoreAIError("DeepSeek 已回應，但三次輸出均不符合評語格式或 80–120 字要求") from None
    raise ScoreAIError("DeepSeek 成績評語生成未完成")
