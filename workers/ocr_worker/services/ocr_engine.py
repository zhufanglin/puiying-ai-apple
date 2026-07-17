"""百度 OCR / PaddleOCR / Tesseract / 文本 PDF 的统一 OCR 适配器。"""

from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


@dataclass
class OcrResult:
    text: str
    confidence: float
    engine: str
    pages: int = 1
    warnings: list[str] = field(default_factory=list)


class Backend(Protocol):
    name: str

    def extract(self, path: Path) -> OcrResult: ...


class DirectDocumentBackend:
    name = "direct_document"

    def extract(self, path: Path) -> OcrResult:
        suffix = path.suffix.lower()
        if suffix in {".txt", ".md", ".json", ".csv"}:
            return OcrResult(path.read_text(encoding="utf-8", errors="replace"), 1.0, self.name)
        if suffix == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(str(path))
            pages = [(page.extract_text() or "").strip() for page in reader.pages]
            text = "\n\n".join(page for page in pages if page)
            warning = [] if text else ["PDF 没有可提取文字，需要图片 OCR。"]
            return OcrResult(text, 0.95 if text else 0.0, self.name, len(reader.pages), warning)
        raise ValueError("该文件需要图片 OCR 引擎")


class PaddleOcrBackend:
    name = "paddleocr"

    def __init__(self) -> None:
        from paddleocr import PaddleOCR

        self.client = PaddleOCR(use_angle_cls=True, lang=os.getenv("PADDLE_OCR_LANG", "ch"), show_log=False)

    def extract(self, path: Path) -> OcrResult:
        result = self.client.ocr(str(path), cls=True)
        texts: list[str] = []
        confidences: list[float] = []
        for page in result or []:
            for line in page or []:
                if len(line) >= 2 and isinstance(line[1], (tuple, list)):
                    texts.append(str(line[1][0]))
                    confidences.append(float(line[1][1]))
        if not texts:
            return OcrResult("", 0.0, self.name, warnings=["PaddleOCR 未识别到文字。"])
        return OcrResult("\n".join(texts), sum(confidences) / len(confidences), self.name)


class TesseractBackend:
    name = "tesseract"

    def extract(self, path: Path) -> OcrResult:
        import pytesseract
        from PIL import Image
        from pytesseract import Output

        image = Image.open(path)
        data = pytesseract.image_to_data(image, lang=os.getenv("TESSERACT_LANG", "chi_tra+eng"), output_type=Output.DICT)
        words, confidences = [], []
        for text, confidence in zip(data.get("text", []), data.get("conf", [])):
            text = str(text).strip()
            try:
                score = float(confidence)
            except (TypeError, ValueError):
                score = -1
            if text:
                words.append(text)
                if score >= 0:
                    confidences.append(score / 100)
        if not words:
            return OcrResult("", 0.0, self.name, warnings=["Tesseract 未识别到文字。"])
        return OcrResult(" ".join(words), sum(confidences) / len(confidences) if confidences else 0.5, self.name)


HttpTransport = Callable[[str, dict[str, str] | None, str, float], dict[str, Any]]


class BaiduOcrBackend:
    """百度智能云文字识别 HTTP 适配器。

    密钥只从 Worker 环境变量读取；不会写入任务结果、日志或状态文件。
    """

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

    def extract(self, path: Path) -> OcrResult:
        suffix = path.suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".bmp", ".pdf"}:
            raise ValueError("百度 OCR 仅接收 JPG、JPEG、PNG、BMP 或 PDF")
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        file_field = "pdf_file" if suffix == ".pdf" else "image"
        form: dict[str, str] = {
            file_field: encoded,
            "detect_direction": "true",
            "probability": "true",
        }
        if suffix == ".pdf":
            form["pdf_file_num"] = os.getenv("BAIDU_OCR_PDF_PAGE", "1")
        if self.mode == "handwriting":
            form.update({"recognize_granularity": "big", "eng_granularity": "word"})
        else:
            form.update({"language_type": os.getenv("BAIDU_OCR_LANGUAGE", "CHN_ENG"), "paragraph": "true"})

        encoded_body_size = len(urlencode(form).encode("utf-8"))
        limit = 8 * 1024 * 1024 if self.mode == "handwriting" else 10 * 1024 * 1024
        if encoded_body_size > limit:
            raise ValueError(f"百度 OCR 请求编码后超过 {limit // 1024 // 1024}MB 限制")

        token = self._get_access_token()
        endpoint = f"{self.ENDPOINTS[self.mode]}?{urlencode({'access_token': token})}"
        payload = self.transport(endpoint, form, "POST", self.timeout)
        if "error_code" in payload:
            raise RuntimeError(f"百度 OCR 错误 {payload.get('error_code')}：{payload.get('error_msg', '未知错误')}")
        words_result = payload.get("words_result") or []
        texts = [str(item.get("words", "")).strip() for item in words_result if str(item.get("words", "")).strip()]
        confidences: list[float] = []
        for item in words_result:
            probability = item.get("probability") or {}
            try:
                confidences.append(float(probability["average"]))
            except (KeyError, TypeError, ValueError):
                continue
        warnings: list[str] = []
        if not texts:
            warnings.append("百度 OCR 未识别到文字。")
        if texts and not confidences:
            warnings.append("百度 OCR 未返回行置信度，结果必须人工复核。")
        confidence = sum(confidences) / len(confidences) if confidences else (0.5 if texts else 0.0)
        return OcrResult("\n".join(texts), confidence, self.name, warnings=warnings)

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
                raise RuntimeError(f"百度 OCR 获取 access_token 失败：{payload.get('error_description') or payload.get('error') or '未知错误'}")
            expires_in = int(payload.get("expires_in", 2592000))
            self._token_cache[cache_key] = (token, now + max(expires_in, 120))
            return token

    @staticmethod
    def _request_json(url: str, data: dict[str, str] | None, method: str, timeout: float) -> dict[str, Any]:
        body = urlencode(data).encode("utf-8") if data is not None else None
        request = Request(
            url,
            data=body,
            method=method,
            headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        )
        try:
            with urlopen(request, timeout=timeout) as response:  # noqa: S310 - endpoint is fixed by code
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise OSError(f"百度 OCR HTTP {exc.code}：{detail}") from exc
        except (URLError, TimeoutError) as exc:
            raise OSError(f"百度 OCR 网络错误：{exc}") from exc
        except json.JSONDecodeError as exc:
            raise RuntimeError("百度 OCR 返回的不是合法 JSON") from exc


class OcrEngine:
    """根据文件类型及 OCR_ENGINE 环境变量选择引擎。"""

    def __init__(self, engine: str | None = None) -> None:
        self.engine = (engine or os.getenv("OCR_ENGINE", "auto")).lower()

    def extract(self, path: str | Path) -> OcrResult:
        resolved = Path(path).resolve()
        if not resolved.is_file():
            raise FileNotFoundError(resolved)
        if resolved.suffix.lower() in {".txt", ".md", ".json", ".csv", ".pdf"}:
            direct = DirectDocumentBackend().extract(resolved)
            if direct.text or resolved.suffix.lower() != ".pdf":
                return direct
        errors: list[str] = []
        if self.engine == "auto":
            candidates = []
            if os.getenv("BAIDU_OCR_ENABLED", "false").lower() in {"1", "true", "yes"}:
                candidates.append("baidu")
            candidates.extend(["paddleocr", "tesseract"])
        else:
            candidates = [self.engine]
        for name in candidates:
            try:
                if name in {"baidu", "baidu_ocr"}:
                    backend: Backend = BaiduOcrBackend()
                elif name == "paddleocr":
                    backend = PaddleOcrBackend()
                elif name == "tesseract":
                    backend = TesseractBackend()
                else:
                    raise ValueError(f"未知 OCR 引擎：{name}")
                return backend.extract(resolved)
            except (ImportError, OSError, RuntimeError, ValueError) as exc:
                errors.append(f"{name}: {exc}")
        raise RuntimeError("没有可用的 OCR 引擎；" + "；".join(errors))
