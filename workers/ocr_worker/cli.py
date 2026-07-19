from __future__ import annotations

import argparse
import json

from workers.ocr_worker.services import OcrEngine


def main() -> None:
    parser = argparse.ArgumentParser(description="OCR Worker 单文件冒烟测试")
    parser.add_argument("file", help="需要识别的图片或 PDF 路径")
    parser.add_argument("--engine", default="baidu", choices=["baidu", "paddleocr", "tesseract", "auto"])
    args = parser.parse_args()
    result = OcrEngine(args.engine).extract(args.file)
    print(json.dumps({
        "engine": result.engine,
        "confidence": result.confidence,
        "pages": result.pages,
        "warnings": result.warnings,
        "text": result.text,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
