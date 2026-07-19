"""百度智能云 OCR 适配器。

密钥只从 Worker 环境变量读取，不写入数据库、任务结果或日志。
"""

from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


@dataclass
class OcrResult:
    text: str
    confidence: float
    engine: str
    lines: list[dict[str, Any]] = field(default_factory=list)
    pages: int = 1
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw_text": self.text,
            "confidence": round(self.confidence, 2),
            "engine": self.engine,
            "lines": self.lines,
            "pages": self.pages,
            "warnings": self.warnings,
        }


HttpTransport = Callable[[str, dict[str, str] | None, str, float], dict[str, Any]]


class BaiduOcrBackend:
    """百度文字识别 HTTP 客户端，支持手写和通用文字识别。"""

    name = "baidu_ocr"
    TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"
    ENDPOINTS = {
        "handwriting": "https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting",
        "accurate_basic": "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic",
        "general_basic": "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic",
    }
    _token_cache: dict[tuple[str, str], tuple[str, float]] = {}
    _token_lock = Lock()

    def __init__(
        self,
        *,
        api_key: str | None = None,
        secret_key: str | None = None,
        access_token: str | None = None,
        mode: str | None = None,
        timeout: float | None = None,
        transport: HttpTransport | None = None,
    ) -> None:
        self.api_key = api_key or os.getenv("BAIDU_OCR_API_KEY", "")
        self.secret_key = secret_key or os.getenv("BAIDU_OCR_SECRET_KEY", "")
        self.access_token = access_token or os.getenv("BAIDU_OCR_ACCESS_TOKEN", "")
        self.mode = (mode or os.getenv("BAIDU_OCR_MODE", "handwriting")).lower()
        self.timeout = timeout or float(os.getenv("BAIDU_OCR_TIMEOUT", "20"))
        self.transport = transport or self._request_json

        if self.mode not in self.ENDPOINTS:
            raise ValueError(f"不支持的百度 OCR 模式：{self.mode}")
        if not self.access_token and not (self.api_key and self.secret_key):
            raise RuntimeError("百度 OCR 缺少 BAIDU_OCR_API_KEY / BAIDU_OCR_SECRET_KEY")

    def extract(self, path: str | Path) -> OcrResult:
        resolved = Path(path).resolve()
        if not resolved.is_file():
            raise FileNotFoundError(resolved)

        suffix = resolved.suffix.lower()
        supported = {".jpg", ".jpeg", ".png", ".bmp", ".pdf"}
        if suffix not in supported:
            raise ValueError("百度 OCR 仅接收 JPG、JPEG、PNG、BMP 或 PDF")

        encoded = base64.b64encode(resolved.read_bytes()).decode("ascii")
        file_field = "pdf_file" if suffix == ".pdf" else "image"
        form: dict[str, str] = {
            file_field: encoded,
            "detect_direction": "true",
            "probability": "true",
        }
        if suffix == ".pdf":
            form["pdf_file_num"] = os.getenv("BAIDU_OCR_PDF_PAGE", "1")
        if self.mode == "handwriting":
            form.update({
                "recognize_granularity": "big",
                "eng_granularity": "word",
                "language_type": os.getenv("BAIDU_OCR_LANGUAGE", "CHN_ENG"),
            })
        else:
            form.update({
                "language_type": os.getenv("BAIDU_OCR_LANGUAGE", "CHN_ENG"),
                "paragraph": "true",
            })

        body_size = len(urlencode(form).encode("utf-8"))
        limit = 8 * 1024 * 1024 if self.mode == "handwriting" else 4 * 1024 * 1024
        if body_size > limit:
            raise ValueError(f"百度 OCR 请求编码后超过 {limit // 1024 // 1024}MB 限制")

        token = self._get_access_token()
        endpoint = f"{self.ENDPOINTS[self.mode]}?{urlencode({'access_token': token})}"
        payload = self.transport(endpoint, form, "POST", self.timeout)
        if "error_code" in payload:
            raise RuntimeError(
                f"百度 OCR 错误 {payload.get('error_code')}：{payload.get('error_msg', '未知错误')}"
            )

        lines: list[dict[str, Any]] = []
        confidences: list[float] = []
        for item in payload.get("words_result") or []:
            text = str(item.get("words", "")).strip()
            if not text:
                continue
            probability = item.get("probability") or {}
            try:
                confidence = float(probability["average"]) * 100
                confidences.append(confidence)
            except (KeyError, TypeError, ValueError):
                confidence = 0.0
            location = item.get("location") or {}
            x0 = int(location.get("left", 0) or 0)
            y0 = int(location.get("top", 0) or 0)
            lines.append({
                "text": text,
                "confidence": round(confidence, 2),
                "bbox": {
                    "x0": x0,
                    "y0": y0,
                    "x1": x0 + int(location.get("width", 0) or 0),
                    "y1": y0 + int(location.get("height", 0) or 0),
                },
            })

        texts = [line["text"] for line in lines]
        warnings: list[str] = []
        if not texts:
            warnings.append("百度 OCR 未识别到文字")
        elif not confidences:
            warnings.append("百度 OCR 未返回行置信度，请人工复核")
        confidence = sum(confidences) / len(confidences) if confidences else (50.0 if texts else 0.0)
        return OcrResult(
            text="\n".join(texts),
            confidence=confidence,
            engine=self.name,
            lines=lines,
            warnings=warnings,
        )

    def _get_access_token(self) -> str:
        if self.access_token:
            return self.access_token

        cache_key = (self.api_key, self.secret_key)
        now = time.monotonic()
        with self._token_lock:
            cached = self._token_cache.get(cache_key)
            if cached and cached[1] > now + 60:
                return cached[0]

            token_url = f"{self.TOKEN_URL}?{urlencode({'grant_type': 'client_credentials', 'client_id': self.api_key, 'client_secret': self.secret_key})}"
            payload = self.transport(token_url, None, "GET", self.timeout)
            token = str(payload.get("access_token", ""))
            if not token:
                message = payload.get("error_description") or payload.get("error") or "未知错误"
                raise RuntimeError(f"百度 OCR 获取 access_token 失败：{message}")
            expires_in = int(payload.get("expires_in", 2592000))
            self._token_cache[cache_key] = (token, now + max(expires_in, 120))
            return token

    @staticmethod
    def _request_json(
        url: str,
        data: dict[str, str] | None,
        method: str,
        timeout: float,
    ) -> dict[str, Any]:
        body = urlencode(data).encode("utf-8") if data is not None else None
        request = Request(
            url,
            data=body,
            method=method,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=timeout) as response:  # noqa: S310 - 固定百度域名
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise OSError(f"百度 OCR HTTP {exc.code}：{detail}") from exc
        except (URLError, TimeoutError) as exc:
            raise OSError(f"百度 OCR 网络错误：{exc}") from exc
        except json.JSONDecodeError as exc:
            raise RuntimeError("百度 OCR 返回的不是合法 JSON") from exc


class PaddleOcrBackend:
    """PaddleOCR 本地引擎，无需联网，作为百度 OCR 回退。"""

    name = "paddleocr"

    def __init__(self) -> None:
        from paddleocr import PaddleOCR

        lang = os.getenv("PADDLE_OCR_LANG", "ch")
        try:
            # PaddleOCR 3.x：use_textline_orientation 替代 use_angle_cls，移除 show_log
            self.client = PaddleOCR(
                use_textline_orientation=True, lang=lang, enable_mkldnn=False
            )
        except TypeError:
            try:
                # PaddleOCR 2.x 兼容回退
                self.client = PaddleOCR(
                    use_angle_cls=True, lang=lang, show_log=False, enable_mkldnn=False
                )
            except TypeError:
                self.client = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)

    def extract(self, path: Path) -> OcrResult:
        try:
            result = self.client.ocr(str(path), cls=True)
        except TypeError:
            # PaddleOCR 3.x：predict() 不接受 cls
            result = self.client.ocr(str(path))

        # PaddleOCR 3.x：dict-like OCRResult（rec_texts / rec_scores）
        if result and hasattr(result[0], "keys") and "rec_texts" in result[0]:
            texts = [str(t) for t in result[0].get("rec_texts", [])]
            scores = [float(s) for s in result[0].get("rec_scores", [])]
            if not texts:
                return OcrResult("", 0.0, self.name, warnings=["PaddleOCR 未识别到文字。"])
            return OcrResult(
                "\n".join(texts),
                sum(scores) / len(scores) if scores else 0.5,
                self.name,
            )

        # PaddleOCR 2.x：经典 list[list[tuple]] 格式
        texts: list[str] = []
        confidences: list[float] = []
        for page in result or []:
            for line in page or []:
                if len(line) >= 2 and isinstance(line[1], (tuple, list)):
                    texts.append(str(line[1][0]))
                    confidences.append(float(line[1][1]))
        if not texts:
            return OcrResult("", 0.0, self.name, warnings=["PaddleOCR 未识别到文字。"])
        return OcrResult(
            "\n".join(texts),
            sum(confidences) / len(confidences),
            self.name,
        )


class OcrEngine:
    """OCR 引擎调度：直接使用 PaddleOCR 本地引擎（无需 API key）。"""

    def __init__(self) -> None:
        pass

    def extract(self, path: str | Path, *, job_type: str = "document") -> OcrResult:
        resolved = Path(path).resolve()
        if not resolved.is_file():
            raise FileNotFoundError(resolved)

        # 直接使用 PaddleOCR 本地引擎
        try:
            return PaddleOcrBackend().extract(resolved)
        except Exception as e:
            raise RuntimeError(f"PaddleOCR 识别失败：{e}")
