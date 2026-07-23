"""成绩管理 数据库模型

表说明：
  - apple_exam_templates  试卷模板（定义试卷结构、题号位置、满分）
  - apple_exam_scores     考试成绩（每题得分，关联模板）
  - apple_score_comments  AI 生成的评语
  - apple_raw_scores      原始采集暂存（OCR/PDF提取后待确认）

关联关系：
  ExamScore → ExamTemplate (M:1)
  ExamScore → Student (M:1)
  ScoreComment → Student (M:1)
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, Numeric, Text, VARCHAR

from app.db.base import Base, TimestampMixin


class ExamTemplate(Base, TimestampMixin):
    """试卷模板"""
    __tablename__ = "apple_exam_templates"

    name = Column(VARCHAR(100), nullable=False, comment="模板名称")
    subject = Column(VARCHAR(50), nullable=False, comment="科目")
    full_mark = Column(Numeric(5, 1), nullable=False, comment="满分")
    total_questions = Column(Integer, nullable=False, comment="总题数")
    config_json = Column(JSON, nullable=True, comment="模板配置（坐标、题号、满分等）")
    is_active = Column(VARCHAR(20), default="active", nullable=False, comment="active/inactive")


class ExamScore(Base, TimestampMixin):
    """考试成绩"""
    __tablename__ = "apple_exam_scores"

    student_id = Column(VARCHAR(64), ForeignKey("apple_students.id"), nullable=False, comment="关联学生")
    exam_name = Column(VARCHAR(100), nullable=False, comment="考试名称")
    template_id = Column(Integer, ForeignKey("apple_exam_templates.id"), nullable=True, comment="关联试卷模板")
    question_no = Column(Integer, nullable=False, comment="题号")
    score = Column(Numeric(5, 1), nullable=False, comment="该题得分")
    full_mark = Column(Numeric(5, 1), nullable=False, comment="该题满分")
    source = Column(VARCHAR(20), default="excel", nullable=False, comment="数据来源：ocr/pdf/excel/manual")
    created_by = Column(VARCHAR(64), nullable=True, comment="录入人")


class ScoreComment(Base, TimestampMixin):
    """AI 评语"""
    __tablename__ = "apple_score_comments"

    student_id = Column(VARCHAR(64), ForeignKey("apple_students.id"), nullable=False, comment="关联学生")
    exam_name = Column(VARCHAR(100), nullable=False, comment="考试名称")
    comment_text = Column(Text, nullable=False, comment="评语正文")
    highlight_subject = Column(VARCHAR(50), nullable=True, comment="最强科目")
    improve_subject = Column(VARCHAR(50), nullable=True, comment="需加强科目")
    suggestion = Column(Text, nullable=True, comment="具体建议")
    status = Column(VARCHAR(20), default="pending", nullable=False, comment="pending/confirmed/sent")
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="审核人")
    reviewed_at = Column(DateTime(timezone=True), nullable=True, comment="审核时间")


class RawScore(Base, TimestampMixin):
    """原始采集数据临时表"""
    __tablename__ = "apple_raw_scores"

    exam_name = Column(VARCHAR(100), nullable=False, comment="考试名称")
    template_id = Column(Integer, ForeignKey("apple_exam_templates.id"), nullable=True, comment="关联试卷模板")
    source_type = Column(VARCHAR(20), nullable=False, comment="ocr/pdf/excel")
    source_file_id = Column(Integer, ForeignKey("files.id"), nullable=True, comment="关联上传文件")
    raw_data = Column(JSON, nullable=True, comment="OCR/PDF提取的原始JSON")
    matched_data = Column(JSON, nullable=True, comment="与学生匹配后的结构化数据")
    status = Column(VARCHAR(20), default="pending", nullable=False, comment="pending/matched/confirmed")
    confirmed_at = Column(DateTime(timezone=True), nullable=True, comment="人工确认时间")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, comment="创建人")
