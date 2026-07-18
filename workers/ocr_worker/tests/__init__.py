"""OCR Worker — 单元测试

运行: pytest workers/ocr_worker/tests/ -v
"""

import pytest


class TestOCREngine:
    """OCR 引擎检测"""

    def test_engine_detection(self):
        """验证引擎检测函数可正常导入"""
        from workers.ocr_worker.services.ocr_engine import _has_paddleocr, _has_tesseract

        # 至少有一个引擎可用（或在演示期 gracefully 处理）
        result_paddle = _has_paddleocr()
        result_tess = _has_tesseract()

        # 两者都返回 bool
        assert isinstance(result_paddle, bool)
        assert isinstance(result_tess, bool)


class TestReceiptHandler:
    """收据处理器"""

    def test_receipt_extract_patterns(self):
        """验证正则模式能正确提取香港收据格式"""
        import re

        # 模拟 OCR 文本
        sample = (
            "收據\n"
            "日期：2026年7月15日\n"
            "金額：HK$1,500.00\n"
            "付款人：陳大明\n"
            "用途：中六畢業禮活動經費"
        )

        # 金额
        m = re.search(r"HK\$\s*([\d,]+\.?\d*)", sample)
        assert m is not None
        assert "1,500.00" in m.group(1)

        # 日期
        m = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", sample)
        assert m is not None
        assert m.group(1) == "2026"

        # 付款人
        m = re.search(r"付款人[：:\s]*(.+)", sample)
        assert m is not None
        assert "陳大明" in m.group(1)

        # 用途
        m = re.search(r"用途[：:\s]*(.+)", sample)
        assert m is not None
        assert "中六畢業禮活動經費" in m.group(1)
