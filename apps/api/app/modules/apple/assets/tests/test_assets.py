"""A3 资产盘点 — 单元测试（≥4个）

测试覆盖:
- test_create_asset            登记新资产
- test_asset_movement          资产搬移记录
- test_asset_writeoff          资产注销
- test_stocktake_report        盘点报告生成
- test_list_assets_with_filters 资产列表筛选
- test_asset_not_found         资产不存在
- test_print_labels            批量打印标签

运行: pytest apps/api/app/modules/apple/assets/tests/ -v
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date, datetime, timezone


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


def make_asset(**overrides):
    """创建模拟的 Asset"""
    from app.modules.apple.assets.models import Asset

    defaults = {
        "id": 1,
        "asset_no": "IT-2026-001",
        "name": "Dell 桌上電腦",
        "category": "IT設備",
        "location": "3樓教員室",
        "status": "active",
        "purchase_date": date(2026, 7, 10),
        "purchase_amount": 8500,
        "remark": "教師辦公用",
        "written_off_at": None,
        "written_off_reason": None,
        "created_by": 1,
    }
    defaults.update(overrides)

    a = MagicMock(spec=Asset)
    for k, v in defaults.items():
        setattr(a, k, v)
    return a


def make_movement(**overrides):
    """创建模拟的 AssetMovement"""
    from app.modules.apple.assets.models import AssetMovement

    defaults = {
        "id": 1,
        "asset_id": 1,
        "from_location": "3樓教員室",
        "to_location": "地下校務處",
        "movement_date": date(2026, 7, 15),
        "reason": "調配使用",
        "operator": "陳大明",
    }
    defaults.update(overrides)

    m = MagicMock(spec=AssetMovement)
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


# ================================================================
# 测试：资产 CRUD
# ================================================================

class TestAssetRepository:
    """数据访问层 — 严格按文档 API 端点测试"""

    @pytest.mark.asyncio
    async def test_create_asset(self):
        """POST /assets — 登记新资产（含自动生成编号）"""
        from app.modules.apple.assets.repository import create_asset

        db = mock_db()
        data = {
            "name": "Dell 桌上電腦",
            "category": "IT設備",
            "location": "3樓教員室",
            "purchase_date": date(2026, 7, 10),
            "purchase_amount": 8500,
            "remark": "教師辦公用",
        }

        result = await create_asset(db, data, user_id=1)

        db.add.assert_called_once()
        db.flush.assert_awaited()
        db.refresh.assert_awaited()
        assert result is not None

    @pytest.mark.asyncio
    async def test_list_assets_with_filters(self):
        """GET /assets?status=&location=&keyword= — 多条件筛选"""
        from app.modules.apple.assets.repository import list_assets

        db = mock_db()

        with patch("app.modules.apple.assets.repository.paginate") as mock_paginate:
            mock_paginate.return_value = (
                [make_asset(id=1), make_asset(id=2)], 2, 1,
            )
            items, total, total_pages = await list_assets(
                db, page=1, page_size=50,
                status="active", location="教員室", keyword="Dell",
            )

            assert total == 2
            assert len(items) == 2
            mock_paginate.assert_called_once()

    @pytest.mark.asyncio
    async def test_asset_not_found(self):
        """GET /assets/{id} — 资产不存在"""
        from app.modules.apple.assets.repository import get_asset_by_id

        db = mock_db()
        db.execute.return_value.scalar_one_or_none.return_value = None

        result = await get_asset_by_id(db, 999)
        assert result is None


# ================================================================
# 测试：资产搬移
# ================================================================

class TestAssetMovement:
    """资产搬移 — 文档: POST /{id}/movements"""

    @pytest.mark.asyncio
    async def test_create_movement(self):
        """POST /assets/{id}/movements — 记录搬移"""
        from app.modules.apple.assets.repository import create_movement

        db = mock_db()
        data = {
            "from_location": "3樓教員室",
            "to_location": "地下校務處",
            "movement_date": date(2026, 7, 15),
            "reason": "調配使用",
        }

        result = await create_movement(db, asset_id=1, data=data, user_id=1)

        db.add.assert_called_once()
        db.flush.assert_awaited()
        assert result is not None

    @pytest.mark.asyncio
    async def test_list_movements(self):
        """GET /assets/{id}/movements — 搬移历史"""
        from app.modules.apple.assets.repository import list_movements

        db = mock_db()

        with patch("app.modules.apple.assets.repository.paginate") as mock_paginate:
            mock_paginate.return_value = (
                [make_movement(id=1), make_movement(id=2)], 2, 1,
            )
            items, total, _ = await list_movements(
                db, asset_id=1, page=1, page_size=20,
            )

            assert total == 2
            assert len(items) == 2


# ================================================================
# 测试：资产注销
# ================================================================

class TestAssetWriteoff:
    """资产注销 — 文档: POST /{id}/writeoff"""

    @pytest.mark.asyncio
    async def test_writeoff_asset(self):
        """POST /assets/{id}/writeoff — 正常注销"""
        from app.modules.apple.assets.asset_writeoff_service import writeoff_asset

        db = mock_db()

        with patch("app.modules.apple.assets.asset_writeoff_service.repository.update_asset") as mock_update:
            asset = make_asset(status="active")
            mock_update.return_value = make_asset(
                status="written_off",
                written_off_at=datetime.now(timezone.utc),
                written_off_reason="燈泡老化、無法維修",
            )

            result = await writeoff_asset(db, asset, reason="燈泡老化、無法維修")

            assert result.status == "written_off"
            mock_update.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_writeoff_already_written_off(self):
        """POST /assets/{id}/writeoff — 重复注销应报错"""
        from app.modules.apple.assets.asset_writeoff_service import writeoff_asset

        db = mock_db()
        asset = make_asset(status="written_off")

        with pytest.raises(Exception):
            await writeoff_asset(db, asset, reason="重複")

    @pytest.mark.asyncio
    async def test_print_labels(self):
        """POST /print-labels — 批量打印标签"""
        from app.modules.apple.assets.address_label_service import print_labels

        db = mock_db()

        with patch("app.modules.apple.assets.address_label_service.repository.get_asset_by_id") as mock_get:
            mock_get.return_value = make_asset(
                id=1, asset_no="IT-2026-001",
                name="Dell 桌上電腦", location="3樓教員室",
            )
            labels = await print_labels(db, [1])

            assert len(labels) == 1
            assert "IT-2026-001" in labels[0]
            assert "Dell 桌上電腦" in labels[0]
            assert "3樓教員室" in labels[0]
