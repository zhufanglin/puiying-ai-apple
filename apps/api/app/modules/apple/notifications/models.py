"""通告 & WhatsApp 发送记录 数据库模型

表说明：
  - apple_notice_templates     通告模板（如"考试通知"、"家长会通知"）
  - apple_notifications        发送记录（一次发送任务）
  - apple_notification_logs    每条消息的发送状态追踪

关联关系：
  Notification → NoticeTemplate (M:1)
  NotificationLog → Notification (M:1)
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text, VARCHAR

from app.db.base import Base, TimestampMixin


class NoticeTemplate(Base, TimestampMixin):
    """通告模板"""
    __tablename__ = "apple_notice_templates"

    name = Column(VARCHAR(100), nullable=False, comment="模板名称")
    category = Column(VARCHAR(50), nullable=False, comment="分类：考试/活动/放假/其他")
    zh_content_template = Column(Text, nullable=False, comment="中文内容模板（含占位符）")
    en_content_template = Column(Text, nullable=True, comment="英文内容模板")
    is_active = Column(Boolean, default=True, nullable=False, comment="是否启用")


class Notification(Base, TimestampMixin):
    """发送记录"""
    __tablename__ = "apple_notifications"

    template_id = Column(Integer, ForeignKey("apple_notice_templates.id"), nullable=True, comment="关联模板")
    title_zh = Column(VARCHAR(200), nullable=False, comment="中文标题")
    title_en = Column(VARCHAR(200), nullable=True, comment="英文标题")
    content_zh = Column(Text, nullable=False, comment="中文正文")
    content_en = Column(Text, nullable=True, comment="英文正文")
    target_classes = Column(Text, nullable=True, comment="目标班级（JSON数组）")
    status = Column(VARCHAR(20), default="draft", nullable=False, comment="draft/sent/partial/failed")
    pdf_path = Column(VARCHAR(500), nullable=True, comment="PDF导出路径")
    sent_at = Column(DateTime(timezone=True), nullable=True, comment="发送时间")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, comment="创建人")


class NotificationLog(Base, TimestampMixin):
    """发送日志——每条消息的追踪"""
    __tablename__ = "apple_notification_logs"

    notification_id = Column(Integer, ForeignKey("apple_notifications.id"), nullable=False, comment="关联发送记录")
    parent_phone = Column(VARCHAR(20), nullable=False, comment="家长WhatsApp号")
    student_name = Column(VARCHAR(100), nullable=False, comment="学生姓名")
    message_status = Column(VARCHAR(20), default="pending", nullable=False, comment="pending/sent/delivered/read/failed")
    error_msg = Column(VARCHAR(500), nullable=True, comment="失败原因")
    status_updated_at = Column(DateTime(timezone=True), nullable=True, comment="状态更新时间")
