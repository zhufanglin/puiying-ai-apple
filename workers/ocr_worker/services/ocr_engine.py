"""OCR 引擎封装 — PaddleOCR / Tesseract 双引擎

引擎选择策略:
    1. PaddleOCR (优先) — 文档指定主引擎，中文识别率高
    2. pytesseract (回退) — 需要系统安装 Tesseract-OCR
    3. 浏览器 Tesseract.js — 前端回退（见 apps/web/lib/ocr-engine.ts）

使用:
    from workers.ocr_worker.services.ocr_engine import recognize_file
    result = await recognize_file("/path/to/image.jpg")
"""

import asyncio
import os
from pathlib import Path
from typing import Optional


# ================================================================
# 引擎检测
# ================================================================

def _has_paddleocr() -> bool:
    """检查 PaddleOCR 是否可用"""
    try:
        import paddleocr  # noqa: F401
        return True
    except ImportError:
        return False


def _has_tesseract() -> bool:
    """检查 pytesseract + Tesseract 是否可用"""
    try:
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
        # 尝试获取 Tesseract 版本
        version = pytesseract.get_tesseract_version()
        return version is not None
    except Exception:
        return False


# ================================================================
# PaddleOCR 引擎
# ================================================================

async def _paddleocr_recognize(file_path: str) -> dict:
    """使用 PaddleOCR 进行识别

    PaddleOCR 优势:
    - 中文（繁体/简体）识别率业界领先
    - 支持角度检测和文本方向分类
    - 轻量级模型，CPU 可运行
    """
    import asyncio as _asyncio
    from paddleocr import PaddleOCR  # type: ignore

    # PaddleOCR 是同步的，在线程池中运行
    def _run():
        ocr = PaddleOCR(
            lang="ch",            # 中文（含繁体）
            use_angle_cls=True,   # 文本方向分类
            show_log=False,
            use_gpu=False,        # CPU 模式（Docker 环境常见）
        )
        result = ocr.ocr(file_path, cls=True)

        if not result or not result[0]:
            return {
                "raw_text": "",
                "lines": [],
                "confidence": 0,
                "engine": "paddleocr",
            }

        lines = []
        confidences = []
        for line_info in result[0]:
            text = line_info[1][0]
            conf = line_info[1][1]
            bbox = line_info[0]
            lines.append({
                "text": text,
                "confidence": conf,
                "bbox": {
                    "x0": bbox[0][0], "y0": bbox[0][1],
                    "x1": bbox[2][0], "y1": bbox[2][1],
                },
            })
            confidences.append(conf)

        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        raw = "\n".join(l["text"] for l in lines)

        return {
            "raw_text": raw,
            "lines": lines,
            "confidence": round(avg_conf, 1),
            "engine": "paddleocr",
        }

    return await _asyncio.to_thread(_run)


# ================================================================
# Tesseract 引擎（回退）
# ================================================================

async def _tesseract_recognize(file_path: str) -> dict:
    """使用 pytesseract 进行识别（回退引擎）"""
    import asyncio as _asyncio
    import pytesseract  # type: ignore
    from PIL import Image

    def _run():
        img = Image.open(file_path)

        # 获取详细数据（含置信度）
        data = pytesseract.image_to_data(
            img, lang="chi_sim+eng", output_type=pytesseract.Output.DICT,
        )

        lines = []
        confidences = []
        current_line = ""
        current_conf = 0
        current_block = data["block_num"][0] if data["block_num"] else 0
        current_par = data["par_num"][0] if data["par_num"] else 0
        current_line_num = data["line_num"][0] if data["line_num"] else 0

        for i in range(len(data["text"])):
            text = data["text"][i].strip()
            if not text:
                continue

            conf = int(data["conf"][i]) if data["conf"][i] != "-1" else 0
            ln = data["line_num"][i]

            if ln != current_line_num:
                if current_line:
                    lines.append({
                        "text": current_line,
                        "confidence": round(current_conf, 1),
                        "bbox": {"x0": 0, "y0": 0, "x1": 0, "y1": 0},
                    })
                current_line = text
                current_conf = conf
                current_line_num = ln
            else:
                current_line += " " + text
                current_conf = max(current_conf, conf)

            confidences.append(conf)

        # 最后一行
        if current_line:
            lines.append({
                "text": current_line,
                "confidence": round(current_conf, 1),
                "bbox": {"x0": 0, "y0": 0, "x1": 0, "y1": 0},
            })

        avg_conf = sum(confidences) / len(confidences) if confidences else 0
        raw = "\n".join(l["text"] for l in lines)

        return {
            "raw_text": raw,
            "lines": lines,
            "confidence": round(avg_conf, 1),
            "engine": "tesseract",
        }

    return await _asyncio.to_thread(_run)


# ================================================================
# 统一入口
# ================================================================

async def recognize_file(file_path: str) -> dict:
    """识别图片文件中的文本 — 自动选择可用引擎

    Args:
        file_path: 图片文件路径（支持 JPEG/PNG/BMP/TIFF/PDF）

    Returns:
        dict: {
            "raw_text": str,        原始识别文本
            "lines": list[dict],    每行文本 + 置信度 + 坐标
            "confidence": float,    平均置信度
            "engine": str,          使用的引擎 (paddleocr / tesseract)
        }

    Raises:
        RuntimeError: 无可用的 OCR 引擎
    """
    # 检查文件是否存在
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    # PDF 文件 → 先转为图片（使用 pdf2image）
    if path.suffix.lower() == ".pdf":
        return await _recognize_pdf(file_path)

    # 引擎选择
    if _has_paddleocr():
        return await _paddleocr_recognize(file_path)

    if _has_tesseract():
        return await _tesseract_recognize(file_path)

    raise RuntimeError(
        "未安装 OCR 引擎。请安装以下任一：\n"
        "  pip install paddleocr\n"
        "  或安装 Tesseract-OCR + pip install pytesseract pillow\n"
        "  或使用浏览器端 Tesseract.js（见 apps/web/lib/ocr-engine.ts）"
    )


async def _recognize_pdf(file_path: str) -> dict:
    """PDF 文件 OCR — 先转图片再识别"""
    try:
        from pdf2image import convert_from_path
        from tempfile import NamedTemporaryFile

        # 只处理第一页
        images = convert_from_path(file_path, first_page=1, last_page=1, dpi=300)
        if not images:
            raise ValueError("PDF 无页面")

        # 保存第一页为临时图片
        with NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            images[0].save(tmp.name, "PNG")
            tmp_path = tmp.name

        try:
            result = await recognize_file(tmp_path)
            result["engine"] = result.get("engine", "") + "+pdf2image"
            return result
        finally:
            os.unlink(tmp_path)

    except ImportError:
        raise RuntimeError(
            "PDF 处理需要 pdf2image 和 poppler。安装:\n"
            "  pip install pdf2image\n"
            "  并安装 poppler-utils (apt install poppler-utils / brew install poppler)"
        )
