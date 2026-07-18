"""A2 财务收支 — Pydantic Schema

严格按任务指南 §4.2 字段定义。
"""
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


# ============== 收支记录 ==============

class FinanceRecordCreate(BaseModel):
    """新增收支记录"""
    type: str = Field(..., pattern="^(income|expense)$", description="income / expense")
    date: str = Field(..., description="日期 YYYY-MM-DD")
    project: str = Field(..., min_length=1, max_length=200, description="项目名称")
    amount: Decimal = Field(..., gt=0, description="金额")
    payment_method: Optional[str] = Field(None, max_length=50, description="支付方式")
    handler: str = Field(..., max_length=50, description="经手人")
    invoice_no: Optional[str] = Field(None, max_length=100, description="发票号")
    supplier: Optional[str] = Field(None, max_length=200, description="供应商")
    file_id: Optional[int] = Field(None, description="关联文件 ID")


class FinanceRecordUpdate(BaseModel):
    """更新收支记录（所有字段可选）"""
    date: Optional[str] = None
    project: Optional[str] = Field(None, max_length=200)
    amount: Optional[Decimal] = Field(None, gt=0)
    payment_method: Optional[str] = Field(None, max_length=50)
    handler: Optional[str] = Field(None, max_length=50)
    invoice_no: Optional[str] = Field(None, max_length=100)
    supplier: Optional[str] = Field(None, max_length=200)
    approver: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, pattern="^(pending|confirmed|approved|rejected)$")


class FinanceRecordResponse(BaseModel):
    """收支记录响应"""
    id: int
    type: str
    date: str
    project: str
    amount: Decimal
    status: str
    payment_method: Optional[str] = None
    handler: str
    invoice_no: Optional[str] = None
    supplier: Optional[str] = None
    approver: Optional[str] = None
    file_id: Optional[int] = None
    created_by: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ============== 报价单 ==============

class QuotationCreate(BaseModel):
    """新增报价单"""
    project_name: str = Field(..., min_length=1, max_length=200, description="项目名称")
    vendor: str = Field(..., min_length=1, max_length=200, description="报价单位")
    amount: Decimal = Field(..., gt=0, description="报价金额")
    is_lowest: bool = Field(False, description="是否最低报价")
    is_selected: bool = Field(False, description="是否采纳")
    remark: Optional[str] = Field(None, description="备注")


class QuotationResponse(BaseModel):
    """报价单响应"""
    id: int
    project_name: str
    vendor: str
    amount: Decimal
    is_lowest: bool
    is_selected: bool
    remark: Optional[str] = None
    created_by: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ============== 报价分析（AI） ==============

class QuotationAnalysisItem(BaseModel):
    """单个项目的报价分析"""
    project_name: str
    quotation_count: int
    lowest_vendor: Optional[str] = None
    lowest_amount: Optional[Decimal] = None
    selected_vendor: Optional[str] = None
    selected_amount: Optional[Decimal] = None
    is_single_bid: bool = False
    non_lowest_selected: bool = False
    warnings: List[str] = Field(default_factory=list)


class QuotationAnalysisResponse(BaseModel):
    """报价分析汇总"""
    items: List[QuotationAnalysisItem] = Field(default_factory=list)
    summary: str = ""


# ============== 地址标签 ==============

class AddressLabelRequest(BaseModel):
    """生成地址 LABEL 请求"""
    record_ids: List[int] = Field(..., min_length=1, description="需要生成标签的记录 ID 列表")


class AddressLabelResponse(BaseModel):
    """地址 LABEL 响应"""
    labels: List[str] = Field(default_factory=list, description="生成的标签文本列表")
    generated_count: int = 0
