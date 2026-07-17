"""奖状 & 奖学金 Pydantic Schema — 请求体 / 响应体

所有 Schema 遵循以下规范：
  - 创建请求: XxxCreate
  - 更新请求: XxxUpdate
  - 列表查询: XxxQuery (继承 PageParams)
  - 列表响应: XxxOut (带 id / created_at / updated_at)
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.common.pagination import PageParams


# ==================== 奖状模板 ====================

class AwardTemplateCreate(BaseModel):
    """创建奖状模板"""
    name: str = Field(..., min_length=1, max_length=100, description="模板名称")
    description: Optional[str] = Field(None, max_length=500, description="描述")
    category: str = Field("其他", description="分类: 学业/品德/活动/其他")
    default_content: Optional[str] = Field(None, description="默认内容")
    badge_style: Optional[str] = Field(None, description="徽章样式")
    is_active: bool = Field(True, description="是否启用")


class AwardTemplateUpdate(BaseModel):
    """更新奖状模板"""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = None
    default_content: Optional[str] = None
    badge_style: Optional[str] = None
    is_active: Optional[bool] = None


class AwardTemplateQuery(PageParams):
    """奖状模板查询参数"""
    name: Optional[str] = Field(None, description="模板名称模糊搜索")
    category: Optional[str] = Field(None, description="分类筛选")
    is_active: Optional[bool] = Field(None, description="启用状态")


class AwardTemplateOut(BaseModel):
    """奖状模板响应"""
    id: int
    name: str
    description: Optional[str] = None
    category: str
    default_content: Optional[str] = None
    badge_style: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==================== 奖状 ====================

class AwardCreate(BaseModel):
    """创建奖状（含获奖学生列表）"""
    template_id: int = Field(..., description="奖状模板ID")
    title: str = Field(..., min_length=1, max_length=200, description="奖状标题")
    issue_date: Optional[date] = Field(None, description="颁发日期, 默认今天")
    issuer: Optional[str] = Field(None, max_length=100, description="颁发部门")
    amount: Optional[Decimal] = Field(None, ge=0, description="奖学金金额（HKD）")
    remark: Optional[str] = Field(None, description="备注")
    recipients: list["AwardRecipientCreate"] = Field(
        default_factory=list, description="获奖学生列表"
    )


class AwardUpdate(BaseModel):
    """更新奖状"""
    template_id: Optional[int] = Field(None, description="奖状模板ID")
    title: Optional[str] = Field(None, max_length=200)
    issue_date: Optional[date] = None
    issuer: Optional[str] = Field(None, max_length=100)
    amount: Optional[Decimal] = Field(None, ge=0, description="奖学金金额（HKD）")
    remark: Optional[str] = None


class AwardQuery(PageParams):
    """奖状查询参数"""
    title: Optional[str] = Field(None, description="标题模糊搜索")
    template_id: Optional[int] = Field(None, description="模板ID筛选")
    status: Optional[str] = Field(None, description="狀態: draft/calculated/confirmed/cancelled")
    date_from: Optional[date] = Field(None, description="颁发日期起")
    date_to: Optional[date] = Field(None, description="颁发日期止")


class AwardRecipientCreate(BaseModel):
    """添加获奖学生"""
    student_name: str = Field(..., min_length=1, max_length=50, description="学生姓名")
    student_class: str = Field(..., min_length=1, max_length=50, description="班级")
    student_grade: Optional[str] = Field(None, max_length=20, description="年级")
    certificate_no: Optional[str] = Field(None, max_length=50, description="证书编号")
    reason: Optional[str] = Field(None, description="获奖原因")
    rank: Optional[str] = Field(None, description="获奖等级")


class AwardRecipientOut(BaseModel):
    """获奖学生响应"""
    id: int
    award_id: int
    student_name: str
    student_class: str
    student_grade: Optional[str] = None
    certificate_no: Optional[str] = None
    reason: Optional[str] = None
    rank: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AwardOut(BaseModel):
    """奖状响应"""
    id: int
    template_id: int
    title: str
    issue_date: date
    issuer: Optional[str] = None
    status: str
    amount: Optional[Decimal] = None
    remark: Optional[str] = None
    total_recipients: int
    created_at: datetime
    updated_at: datetime
    template: Optional[AwardTemplateOut] = None
    recipients: list[AwardRecipientOut] = []

    model_config = {"from_attributes": True}


class AwardListItem(BaseModel):
    """奖状列表项（精简）"""
    id: int
    title: str
    template_name: Optional[str] = None
    template_category: Optional[str] = None
    issue_date: date
    issuer: Optional[str] = None
    amount: Optional[Decimal] = None
    status: str
    total_recipients: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== 奖学金申请 ====================

class ScholarshipApplicationCreate(BaseModel):
    """提交奖学金申请"""
    student_name: str = Field(..., min_length=1, max_length=50, description="学生姓名")
    student_class: str = Field(..., min_length=1, max_length=50, description="班级")
    student_grade: Optional[str] = Field(None, max_length=20, description="年级")
    scholarship_type: str = Field(
        ..., description="类型: 学业优秀/品德风尚/科技竞赛/体艺特长/助学金"
    )
    academic_year: str = Field(..., min_length=1, max_length=20, description="学年, 如: 2025-2026")
    semester: str = Field(..., description="学期: 上/下")
    amount: Decimal = Field(..., ge=0, description="申请金额（HKD）")
    reason: Optional[str] = Field(None, description="申请理由")
    remark: Optional[str] = Field(None, description="备注")


class ScholarshipApplicationQuery(PageParams):
    """奖学金查询参数"""
    student_name: Optional[str] = Field(None, description="学生姓名搜索")
    scholarship_type: Optional[str] = Field(None, description="类型筛选")
    status: Optional[str] = Field(None, description="状态: pending/approved/rejected")
    academic_year: Optional[str] = Field(None, description="学年筛选")


class ScholarshipReviewCreate(BaseModel):
    """审核奖学金申请"""
    status: str = Field(..., description="审核结果: approved / rejected")
    review_comment: Optional[str] = Field(None, description="审核意见")


class ScholarshipApplicationOut(BaseModel):
    """奖学金申请响应"""
    id: int
    student_name: str
    student_class: str
    student_grade: Optional[str] = None
    scholarship_type: str
    academic_year: str
    semester: str
    application_date: date
    status: str
    amount: Decimal
    reason: Optional[str] = None
    remark: Optional[str] = None
    reviewer_id: Optional[int] = None
    review_comment: Optional[str] = None
    review_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScholarshipStatistics(BaseModel):
    """奖学金统计"""
    total_applications: int = 0
    pending_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    total_amount: Decimal = Decimal("0.00")
    approved_amount: Decimal = Decimal("0.00")


class AwardStatistics(BaseModel):
    """奖状统计"""
    total_awards: int = 0
    draft_count: int = 0
    calculated_count: int = 0
    confirmed_count: int = 0
    cancelled_count: int = 0
    total_recipients: int = 0
    template_count: int = 0


# ==================== 证书批量生成 ====================

class BatchGenerateRecipient(BaseModel):
    """批量生成证书的单个学生"""
    student_name: str = Field(..., min_length=1, max_length=50, description="学生姓名")
    student_class: str = Field(..., min_length=1, max_length=50, description="班级")


class BatchGenerateRequest(BaseModel):
    """批量生成证书请求"""
    template_id: int = Field(..., description="奖状模板ID")
    recipients: list[BatchGenerateRecipient] = Field(..., min_length=1, description="获奖学生列表")
    issue_date: str = Field(..., description="颁发日期, 如: 2026-07-17")
    award_year: str = Field(..., description="学年, 如: 2025-2026")


class BatchGenerateFileInfo(BaseModel):
    """生成的证书文件信息"""
    student_name: str = Field(..., description="学生姓名")
    file_path: str = Field(..., description="文件名（可用于下载）")


class BatchGenerateData(BaseModel):
    """批量生成响应数据"""
    files: list[BatchGenerateFileInfo] = Field(default_factory=list, description="生成的文件列表")
    download_token: str = Field(default="", description="下载令牌")


# ==================== 批量导出证书 ====================

class BatchExportRequest(BaseModel):
    """批量导出证书请求"""
    ids: list[int] = Field(..., min_length=1, description="奖状ID列表 或 奖学金申请ID列表")


class BatchDeleteRequest(BaseModel):
    """批量删除奖状请求"""
    ids: list[int] = Field(..., min_length=1, description="要删除的奖状ID列表")


# ==================== 奖学金核算 ====================

class CalculateRequest(BaseModel):
    """奖学金核算请求"""
    rules: Optional[dict[str, Decimal]] = Field(
        None,
        description="核算规则, 如: {\"一等奖\": 1000, \"二等奖\": 500}",
    )


class CalculateResultItem(BaseModel):
    """单个学生奖学金核算结果"""
    student_name: str = Field(..., description="学生姓名")
    student_class: str = Field(..., description="班级")
    rank: Optional[str] = Field(None, description="获奖等级")
    base_amount: Decimal = Field(Decimal("0.00"), description="基础金额")
    final_amount: Decimal = Field(Decimal("0.00"), description="最终金额")
    remark: Optional[str] = Field(None, description="备注")


class CalculateResult(BaseModel):
    """奖学金核算结果"""
    items: list[CalculateResultItem] = Field(default_factory=list, description="核算明细")
    total_amount: Decimal = Field(Decimal("0.00"), description="总计金额")


# ==================== 读稿生成 ====================

class ScriptQueryParams(BaseModel):
    """读稿生成查询参数"""
    group_by: str = Field(
        default="class",
        description="排序方式: grade=按年级 / class=按班级 / student_no=按学号",
    )


class ScriptItem(BaseModel):
    """单条读稿记录"""
    student_name: str = Field(..., description="学生姓名")
    student_class: str = Field(..., description="班级")
    student_grade: Optional[str] = Field(None, description="年级")
    script_text: str = Field(..., description="读稿文本")


class ScriptOut(BaseModel):
    """读稿生成响应"""
    award_title: str = Field(..., description="奖状标题")
    total: int = Field(0, description="总人数")
    items: list[ScriptItem] = Field(default_factory=list, description="读稿列表（已排序）")


# ==================== 证书批量生成（基于现有奖状） ====================

class CertificateRequest(BaseModel):
    """批量生成证书请求"""
    template_id: Optional[int] = Field(None, description="奖状模板ID（可选，默认使用奖状已有模板）")
    recipient_ids: list[int] = Field(..., min_length=1, description="获奖学生ID列表")
    signatory: Optional[str] = Field(None, max_length=100, description="签发人/校长签名")
