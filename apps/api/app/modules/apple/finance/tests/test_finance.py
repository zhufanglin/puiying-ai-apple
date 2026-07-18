"""A2 财务收支 — 单元测试（≥4个）

测试覆盖:
- test_create_income           新增收入记录
- test_create_expense          新增支出记录
- test_list_income_with_filters  收入列表筛选
- test_analyze_quotations_single_bid  单一报价识别
- test_analyze_quotations_non_lowest  未采纳最低报价识别
- test_create_quotation        新增报价单
- test_generate_address_labels 地址标签生成
- test_ocr_receipt_analyze     OCR 收据识别

运行: pytest apps/api/app/modules/apple/finance/tests/ -v
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date


# ================================================================
# Mock 工具
# ================================================================

def mock_db():
    """创建模拟的 AsyncSession"""
    db = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.delete = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock()
    return db


def make_record(**overrides):
    """创建模拟的 FinanceRecord"""
    from app.modules.apple.finance.models import FinanceRecord

    defaults = {
        "id": 1,
        "record_type": "income",
        "date": date(2026, 7, 15),
        "project": "中六畢業禮活動經費",
        "amount": 1500,
        "status": "pending",
        "payment_method": "現金",
        "handler": "陳大明",
        "invoice_no": None,
        "supplier": None,
        "approver": None,
        "attachment_file_id": None,
        "created_by": 1,
    }
    defaults.update(overrides)

    r = MagicMock(spec=FinanceRecord)
    for k, v in defaults.items():
        setattr(r, k, v)
    return r


def make_quotation(**overrides):
    """创建模拟的 Quotation"""
    from app.modules.apple.finance.models import Quotation

    defaults = {
        "id": 1,
        "project_name": "校慶紀念品採購",
        "vendor": "精美禮品公司",
        "amount": 15000,
        "is_lowest": True,
        "is_selected": True,
        "remark": "品質優",
        "created_by": 1,
    }
    defaults.update(overrides)

    q = MagicMock(spec=Quotation)
    for k, v in defaults.items():
        setattr(q, k, v)
    return q


# ================================================================
# 测试：收支记录 CRUD
# ================================================================

class TestFinanceRepository:
    """数据访问层 — 严格按文档 API 端点测试"""

    @pytest.mark.asyncio
    async def test_create_income(self):
        """POST /income — 新增收入"""
        from app.modules.apple.finance.repository import create_record

        db = mock_db()
        data = {
            "record_type": "income", "date": date(2026, 7, 15),
            "project": "中六畢業禮活動經費", "amount": 1500,
            "payment_method": "現金", "handler": "陳大明", "status": "pending",
        }

        result = await create_record(db, data, user_id=1)

        db.add.assert_called_once()
        db.flush.assert_awaited()
        db.refresh.assert_awaited()
        assert result is not None

    @pytest.mark.asyncio
    async def test_create_expense(self):
        """POST /expense — 新增支出"""
        from app.modules.apple.finance.repository import create_record

        db = mock_db()
        data = {
            "record_type": "expense", "date": date(2026, 7, 14),
            "project": "辦公用品採購", "amount": 2350,
            "invoice_no": "INV-2026-0715", "supplier": "永發文具公司",
            "status": "pending",
        }

        result = await create_record(db, data, user_id=1)

        db.add.assert_called_once()
        db.flush.assert_awaited()
        assert result is not None

    @pytest.mark.asyncio
    async def test_list_income_with_filters(self):
        """GET /income?status=&project= — 筛选查询"""
        from app.modules.apple.finance.repository import list_income

        db = mock_db()

        with patch("app.modules.apple.finance.repository.paginate") as mock_paginate:
            mock_paginate.return_value = (
                [make_record(id=1), make_record(id=2)], 2, 1,
            )
            items, total, total_pages = await list_income(
                db, page=1, page_size=20, status="confirmed", project="活動",
            )

            assert total == 2
            assert len(items) == 2
            mock_paginate.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_record_not_found(self):
        """GET /income/{id} — 记录不存在返回 None"""
        from app.modules.apple.finance.repository import get_record_by_id

        db = mock_db()
        db.execute.return_value.scalar_one_or_none.return_value = None

        result = await get_record_by_id(db, 999)
        assert result is None


# ================================================================
# 测试：报价单分析
# ================================================================

class TestQuotationAnalysis:
    """报价单分析 — 文档 rules: 单一报价(黄) / 未采纳最低(红)"""

    @pytest.mark.asyncio
    async def test_single_bid_detection(self):
        """POST /quotations/analyze — 识别单一报价（黄色高亮）"""
        from app.modules.apple.finance.service import quotation_analyze

        db = mock_db()
        grouped = {
            "單一報價項目": [
                make_quotation(id=1, project_name="單一報價項目",
                               vendor="唯一供應商", amount=10000,
                               is_lowest=True, is_selected=True),
            ],
        }

        with patch("app.modules.apple.finance.service.get_quotations_grouped",
                   return_value=grouped):
            result = await quotation_analyze(db)

            item = result.items[0]
            assert item.is_single_bid is True
            assert any("比价" in w for w in item.warnings)

    @pytest.mark.asyncio
    async def test_non_lowest_selected(self):
        """POST /quotations/analyze — 识别未采纳最低报价（红色高亮）"""
        from app.modules.apple.finance.service import quotation_analyze

        db = mock_db()
        grouped = {
            "校園綠化工程": [
                make_quotation(id=1, project_name="校園綠化工程",
                               vendor="春暉園藝公司", amount=28000,
                               is_lowest=True, is_selected=False),
                make_quotation(id=2, project_name="校園綠化工程",
                               vendor="綠意園林設計", amount=35000,
                               is_lowest=False, is_selected=True),
            ],
        }

        with patch("app.modules.apple.finance.service.get_quotations_grouped",
                   return_value=grouped):
            result = await quotation_analyze(db)

            item = result.items[0]
            assert item.non_lowest_selected is True
            assert len(item.warnings) >= 1

    @pytest.mark.asyncio
    async def test_normal_bidding(self):
        """POST /quotations/analyze — 正常比价无异常"""
        from app.modules.apple.finance.service import quotation_analyze

        db = mock_db()
        grouped = {
            "正常項目": [
                make_quotation(id=1, project_name="正常項目",
                               vendor="最低商", amount=10000,
                               is_lowest=True, is_selected=True),
                make_quotation(id=2, project_name="正常項目",
                               vendor="其他商", amount=12000,
                               is_lowest=False, is_selected=False),
            ],
        }

        with patch("app.modules.apple.finance.service.get_quotations_grouped",
                   return_value=grouped):
            result = await quotation_analyze(db)

            item = result.items[0]
            assert item.is_single_bid is False
            assert item.non_lowest_selected is False

    @pytest.mark.asyncio
    async def test_address_labels(self):
        """POST /address-labels — 生成地址标签"""
        from app.modules.apple.finance.service import generate_address_labels

        db = mock_db()

        with patch("app.modules.apple.finance.service.get_record_by_id") as mock_get:
            mock_get.return_value = make_record(
                id=1, project="測試項目", amount=1500, handler="陳大明",
            )
            labels = await generate_address_labels(db, [1])

            assert len(labels) == 1
            assert "測試項目" in labels[0]
            assert "1,500" in labels[0]


# ================================================================
# 测试：OCR 收据识别
# ================================================================

class TestReceiptOCR:
    """OCR 识别 — 文档要求 receipt_ocr_service"""

    @pytest.mark.asyncio
    async def test_ocr_return_format(self):
        """验证 OCR 返回格式符合 receipt_extract_zh_hk.md"""
        from app.modules.apple.finance.service import receipt_ocr_analyze
        from app.modules.files.models import File as FileModel

        db = mock_db()
        mock_file = MagicMock(spec=FileModel)
        mock_file.stored_path = "/uploads/receipt.jpg"
        mock_file.filename = "receipt.jpg"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_file
        db.execute.return_value = mock_result

        result = await receipt_ocr_analyze(db, file_id=1, user_id=1)

        # 严格按文档字段检查
        assert "amount" in result
        assert "currency" in result
        assert result["currency"] == "HKD"
        assert "date" in result
        assert "payer" in result
        assert "purpose" in result
        assert result["confidence"] in ("low", "medium", "high")
        assert isinstance(result["warnings"], list)
        assert "raw_text" in result
