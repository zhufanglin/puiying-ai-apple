from __future__ import annotations

import unittest

from pydantic import ValidationError

from app.core.permissions import Permissions
from app.main import app
from app.modules.apple.notifications.router import router
from app.modules.apple.notifications.schemas import NoticeTemplateCreate
from app.modules.apple.notifications.service import render_template_content


class NotificationsModuleTest(unittest.TestCase):
    def test_render_template_content_replaces_placeholders(self) -> None:
        result = render_template_content(
            "尊敬的家长：{{date}} {{time}} 到校。",
            "Dear parent, please come on {{date}} at {{time}}.",
            {"date": "2026-07-24", "time": "09:00"},
        )

        self.assertEqual(result["content_zh"], "尊敬的家长：2026-07-24 09:00 到校。")
        self.assertEqual(result["content_en"], "Dear parent, please come on 2026-07-24 at 09:00.")

    def test_template_category_validation(self) -> None:
        valid = NoticeTemplateCreate(
            name="考试通知",
            category="考试",
            zh_content_template="考试日期：{{date}}",
        )
        self.assertEqual(valid.category, "考试")

        with self.assertRaises(ValidationError):
            NoticeTemplateCreate(
                name="非法模板",
                category="无效分类",
                zh_content_template="内容",
            )

    def test_notification_permissions_are_declared(self) -> None:
        self.assertEqual(Permissions.NOTIFICATIONS_READ, "apple:notifications:read")
        self.assertEqual(Permissions.NOTIFICATIONS_WRITE, "apple:notifications:write")
        self.assertEqual(Permissions.NOTIFICATIONS_SEND, "apple:notifications:send")

    def test_notification_routes_are_registered_in_order(self) -> None:
        paths = [route.path for route in router.routes]

        self.assertEqual(len(paths), 11)
        self.assertIn("/apple/notifications/templates", paths)
        self.assertIn("/apple/notifications/{notification_id}/send", paths)
        self.assertLess(
            paths.index("/apple/notifications/stats"),
            paths.index("/apple/notifications/{notification_id}"),
        )

    def test_notification_routes_are_in_app(self) -> None:
        paths = {route.path for route in app.routes}

        self.assertIn("/api/v1/apple/notifications/templates", paths)
        self.assertIn("/api/v1/apple/notifications/{notification_id}/send", paths)
        self.assertIn("/api/v1/apple/notifications/{notification_id}/logs", paths)


if __name__ == "__main__":
    unittest.main()
