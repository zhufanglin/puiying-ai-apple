"""百度 OCR 单文件冒烟测试。"""

from __future__ import annotations

import argparse
import json

from workers.ocr_worker.services.ocr_engine import OcrEngine


def main() -> None:
    parser = argparse.ArgumentParser(description="百度 OCR Worker 单文件冒烟测试")
    parser.add_argument("file", help="需要识别的图片或 PDF 路径")
    parser.add_argument(
        "--job-type",
        default="receipt",
        choices=["receipt", "invoice", "certificate", "document"],
    )
    args = parser.parse_args()
    result = OcrEngine().extract(args.file, job_type=args.job_type)
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
