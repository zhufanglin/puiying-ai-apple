"""奖状奖学金模块单元测试"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "venv_dir"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))

import pytest
from fastapi.testclient import TestClient

from app.main import app

API_PREFIX = "/api/v1"
client = TestClient(app)


# ==================== 辅助函数 ====================

def get_token() -> str:
    """登录获取管理员 token"""
    resp = client.post(f"{API_PREFIX}/auth/login", json={
        "username": "admin",
        "password": "admin123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    return data["data"]["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def token():
    return get_token()


# ==================== 1. 奖状模板 CRUD ====================

class TestAwardTemplates:
    """奖状模板 CRUD 测试"""

    _token = None
    _created_id = None

    @classmethod
    def setup_class(cls):
        cls._token = get_token()

    def test_01_list_templates(self):
        """查询奖状模板列表"""
        resp = client.get(
            f"{API_PREFIX}/apple/awards/templates",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "items" in data["data"]
        # 应该有 seed 数据中的模板（三好学生等）
        assert len(data["data"]["items"]) > 0

    def test_02_create_template(self):
        """创建奖状模板"""
        resp = client.post(
            f"{API_PREFIX}/apple/awards/templates",
            headers=auth_headers(self._token),
            json={
                "name": "單元測試模板",
                "description": "由自動化測試建立的模板",
                "category": "其他",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["name"] == "單元測試模板"
        TestAwardTemplates._created_id = data["data"]["id"]

    def test_03_get_template(self):
        """获取单个奖状模板（使用 seed 数据中的 ID 1）"""
        resp = client.get(
            f"{API_PREFIX}/apple/awards/templates/1",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert len(data["data"]["name"]) > 0

    def test_04_update_template(self):
        """更新奖状模板"""
        if not TestAwardTemplates._created_id:
            pytest.skip("需要先创建模板")
        resp = client.put(
            f"{API_PREFIX}/apple/awards/templates/{TestAwardTemplates._created_id}",
            headers=auth_headers(self._token),
            json={"description": "已更新的描述"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0

    def test_05_delete_template(self):
        """删除奖状模板（清理先前创建的测试数据）"""
        if not TestAwardTemplates._created_id:
            pytest.skip("需要先创建模板")
        resp = client.delete(
            f"{API_PREFIX}/apple/awards/templates/{TestAwardTemplates._created_id}",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["deleted"] is True


# ==================== 2. 奖状 CRUD（含获奖学生） ====================

class TestAwards:
    """奖状 CRUD 测试"""

    _token = None
    _created_award_id = None

    @classmethod
    def setup_class(cls):
        cls._token = get_token()

    def test_01_create_award_with_recipients(self):
        """创建奖状并附带获奖学生"""
        resp = client.post(
            f"{API_PREFIX}/apple/awards",
            headers=auth_headers(self._token),
            json={
                "template_id": 1,  # 三好学生
                "title": "測試獎狀 — 2025學年三好學生",
                "issuer": "德育處（測試）",
                "remark": "由自動化測試建立",
                "recipients": [
                    {"student_name": "測試學生甲", "student_class": "中五甲班", "rank": "一等獎"},
                    {"student_name": "測試學生乙", "student_class": "中五乙班", "rank": "二等獎"},
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["title"] == "測試獎狀 — 2025學年三好學生"
        assert data["data"]["total_recipients"] == 2
        assert len(data["data"]["recipients"]) == 2
        TestAwards._created_award_id = data["data"]["id"]

    def test_02_get_award(self):
        """获取单个奖状详情"""
        if not TestAwards._created_award_id:
            pytest.skip("需要先创建奖状")
        resp = client.get(
            f"{API_PREFIX}/apple/awards/{TestAwards._created_award_id}",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["template"] is not None
        assert len(data["data"]["recipients"]) > 0

    def test_03_list_awards(self):
        """查询奖状列表"""
        resp = client.get(
            f"{API_PREFIX}/apple/awards?page=1&page_size=10",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "items" in data["data"]

    def test_04_update_award(self):
        """更新奖状"""
        if not TestAwards._created_award_id:
            pytest.skip("需要先创建奖状")
        resp = client.put(
            f"{API_PREFIX}/apple/awards/{TestAwards._created_award_id}",
            headers=auth_headers(self._token),
            json={"remark": "已更新的備註（測試）"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0


# ==================== 3. 奖状状态操作 ====================

class TestAwardStatus:
    """奖状发布/取消测试"""

    _token = None
    _award_id = None

    @classmethod
    def setup_class(cls):
        cls._token = get_token()
        # 先创建一个草稿奖状用于测试
        resp = client.post(
            f"{API_PREFIX}/apple/awards",
            headers=auth_headers(cls._token),
            json={
                "template_id": 1,
                "title": "狀態測試獎狀",
                "issuer": "測試",
                "recipients": [
                    {"student_name": "狀態測試學生", "student_class": "中五甲班"},
                ],
            },
        )
        assert resp.status_code == 200
        cls._award_id = resp.json()["data"]["id"]

    def test_01_publish_award(self):
        """发布奖状（draft -> published）"""
        resp = client.post(
            f"{API_PREFIX}/apple/awards/{TestAwardStatus._award_id}/publish",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["status"] == "confirmed"

    def test_02_cancel_published_award(self):
        """取消已发布的奖状（confirmed -> cancelled）"""
        resp = client.post(
            f"{API_PREFIX}/apple/awards/{TestAwardStatus._award_id}/cancel",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["status"] == "cancelled"

    def test_03_cancel_already_cancelled_should_fail(self):
        """重复取消应返回业务错误"""
        resp = client.post(
            f"{API_PREFIX}/apple/awards/{TestAwardStatus._award_id}/cancel",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 400
        data = resp.json()
        assert data["code"] != 0  # 业务错误


# ==================== 4. 获奖学生操作 ====================

class TestRecipients:
    """获奖学生添加/删除测试"""

    _token = None

    @classmethod
    def setup_class(cls):
        cls._token = get_token()

    def test_01_add_recipients(self):
        """先创建一个奖状，再添加获奖学生"""
        # 创建奖状
        resp = client.post(
            f"{API_PREFIX}/apple/awards",
            headers=auth_headers(self._token),
            json={
                "template_id": 1,
                "title": "獲獎學生測試",
                "issuer": "測試",
            },
        )
        assert resp.status_code == 200
        award_id = resp.json()["data"]["id"]
        TestRecipients._award_id = award_id

        # 添加获奖学生
        resp = client.post(
            f"{API_PREFIX}/apple/awards/{award_id}/recipients",
            headers=auth_headers(self._token),
            json=[
                {"student_name": "新增學生甲", "student_class": "中四甲班"},
                {"student_name": "新增學生乙", "student_class": "中四乙班"},
            ],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert len(data["data"]) == 2
        TestRecipients._recipient_ids = [r["id"] for r in data["data"]]

    def test_02_remove_recipient(self):
        """删除获奖学生"""
        if not hasattr(TestRecipients, "_recipient_ids"):
            pytest.skip("需要先添加获奖学生")
        recipient_id = TestRecipients._recipient_ids[0]
        resp = client.delete(
            f"{API_PREFIX}/apple/awards/recipients/{recipient_id}",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0

    _award_id = None
    _recipient_ids = []


# ==================== 5. 奖学金申请 ====================

class TestScholarships:
    """奖学金申请测试"""

    _token = None

    @classmethod
    def setup_class(cls):
        cls._token = get_token()

    def test_01_create_scholarship_application(self):
        """提交奖学金申请"""
        resp = client.post(
            f"{API_PREFIX}/apple/awards/scholarships",
            headers=auth_headers(self._token),
            json={
                "student_name": "申請學生",
                "student_class": "中六甲班",
                "student_grade": "中六",
                "scholarship_type": "學業優秀",
                "academic_year": "2025-2026",
                "semester": "上",
                "amount": 5000.00,
                "reason": "全年成績排名年級前10%",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["status"] == "pending"
        assert float(data["data"]["amount"]) == 5000.00
        TestScholarships._app_id = data["data"]["id"]

    def test_02_list_scholarships(self):
        """查询奖学金申请列表"""
        resp = client.get(
            f"{API_PREFIX}/apple/awards/scholarships?page=1&page_size=10",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "items" in data["data"]

    def test_03_get_scholarship(self):
        """获取单个奖学金申请"""
        if not hasattr(TestScholarships, "_app_id"):
            pytest.skip("需要先创建申请")
        resp = client.get(
            f"{API_PREFIX}/apple/awards/scholarships/{TestScholarships._app_id}",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0

    _app_id = None


# ==================== 6. 奖学金审核 ====================

class TestScholarshipReview:
    """奖学金审核测试"""

    _token = None
    _app_id = None

    @classmethod
    def setup_class(cls):
        cls._token = get_token()
        # 创建待审核申请
        resp = client.post(
            f"{API_PREFIX}/apple/awards/scholarships",
            headers=auth_headers(cls._token),
            json={
                "student_name": "審核測試學生",
                "student_class": "中六甲班",
                "scholarship_type": "學業優秀",
                "academic_year": "2025-2026",
                "semester": "上",
                "amount": 3000.00,
                "reason": "審核測試用",
            },
        )
        assert resp.status_code == 200
        cls._app_id = resp.json()["data"]["id"]

    def test_01_approve_scholarship(self):
        """审核通过奖学金申请"""
        resp = client.post(
            f"{API_PREFIX}/apple/awards/scholarships/{TestScholarshipReview._app_id}/review",
            headers=auth_headers(self._token),
            json={"status": "approved", "review_comment": "符合條件，批准"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["status"] == "approved"
        assert data["data"]["review_comment"] == "符合條件，批准"

    def test_02_review_already_approved_should_fail(self):
        """重复审核应返回业务错误"""
        resp = client.post(
            f"{API_PREFIX}/apple/awards/scholarships/{TestScholarshipReview._app_id}/review",
            headers=auth_headers(self._token),
            json={"status": "rejected", "review_comment": "重複操作"},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert data["code"] != 0  # 业务错误，状态不允许


# ==================== 7. 统计 ====================

class TestStatistics:
    """统计接口测试"""

    _token = None

    @classmethod
    def setup_class(cls):
        cls._token = get_token()

    def test_01_get_statistics(self):
        """获取综合统计"""
        resp = client.get(
            f"{API_PREFIX}/apple/awards/statistics",
            headers=auth_headers(self._token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert "awards" in data["data"]
        assert "scholarships" in data["data"]
        # 验证统计字段
        assert "total_awards" in data["data"]["awards"]
        assert "total_applications" in data["data"]["scholarships"]


# ==================== 8. 证书生成服务（单元测试） ====================

class TestCertificateService:
    """证书生成服务测试（仅验证导入与函数签名）"""

    def test_01_service_imports(self):
        """验证 service 模块可正常导入"""
        from app.modules.apple.awards import service as svc
        assert svc is not None
        assert hasattr(svc, "create_award")
        assert hasattr(svc, "publish_award")
        assert hasattr(svc, "review_scholarship")

    def test_02_schemas_imports(self):
        """验证 schema 模型可正常导入"""
        from app.modules.apple.awards.schemas import (
            AwardTemplateCreate, AwardCreate, AwardOut,
            ScholarshipApplicationCreate, ScholarshipApplicationOut,
            AwardStatistics, ScholarshipStatistics,
        )
        assert AwardTemplateCreate is not None
        assert AwardOut is not None
        assert ScholarshipStatistics is not None
