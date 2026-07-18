"""A3 资产盘点 — Pydantic Schema

严格按任务指南 §5.1 字段定义。
"""
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


# ============== 资产 ==============

class AssetCreate(BaseModel):
    """登记新资产"""
    asset_no: Optional[str] = Field(None, max_length=50, description="资产编号（留空自动生成）")
    name: str = Field(..., min_length=1, max_length=200, description="资产名称")
    category: str = Field(..., min_length=1, max_length=50, description="类别")
    location: str = Field(..., min_length=1, max_length=200, description="存放地点")
    purchase_date: Optional[str] = Field(None, description="购买日期 YYYY-MM-DD")
    purchase_amount: Optional[Decimal] = Field(None, ge=0, description="购买金额")
    remark: Optional[str] = Field(None, description="备注")
    file_id: Optional[int] = Field(None, description="关联发票文件 ID")


class AssetUpdate(BaseModel):
    """更新资产"""
    name: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, pattern="^(active|moved|written_off|missing)$")
    purchase_date: Optional[str] = None
    purchase_amount: Optional[Decimal] = Field(None, ge=0)
    remark: Optional[str] = None


class AssetResponse(BaseModel):
    """资产响应"""
    id: int
    asset_no: str
    name: str
    category: str
    location: str
    status: str
    purchase_date: Optional[str] = None
    purchase_amount: Optional[Decimal] = None
    remark: Optional[str] = None
    file_id: Optional[int] = None
    written_off_at: Optional[str] = None
    written_off_reason: Optional[str] = None
    created_by: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ============== 资产移动 ==============

class AssetMovementCreate(BaseModel):
    """记录资产搬移"""
    from_location: str = Field(..., min_length=1, max_length=200, description="原地点")
    to_location: str = Field(..., min_length=1, max_length=200, description="目标地点")
    movement_date: str = Field(..., description="搬移日期 YYYY-MM-DD")
    reason: Optional[str] = Field(None, description="搬移原因")


class AssetMovementResponse(BaseModel):
    """资产移动响应"""
    id: int
    asset_id: int
    from_location: str
    to_location: str
    movement_date: str
    reason: Optional[str] = None
    created_by: int
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


# ============== 盘点 ==============

class StocktakeRequest(BaseModel):
    """盘点请求"""
    location: Optional[str] = Field(None, description="按地点筛选，留空=全部")


class StocktakeLocationGroup(BaseModel):
    """按地点分组的盘点结果"""
    location: str
    total: int = 0
    active: int = 0
    moved: int = 0
    missing: int = 0
    assets: List[AssetResponse] = Field(default_factory=list)


class StocktakeResponse(BaseModel):
    """盘点报告"""
    generated_at: str = ""
    total_assets: int = 0
    total_active: int = 0
    total_moved: int = 0
    total_written_off: int = 0
    total_missing: int = 0
    location_groups: List[StocktakeLocationGroup] = Field(default_factory=list)


# ============== 注销 ==============

class WriteoffRequest(BaseModel):
    """注销请求"""
    reason: str = Field(..., min_length=1, max_length=500, description="注销原因")


# ============== 打印标签 ==============

class PrintLabelsRequest(BaseModel):
    """批量打印 LABEL 请求"""
    asset_ids: List[int] = Field(..., min_length=1, description="资产 ID 列表")


class PrintLabelsResponse(BaseModel):
    """打印 LABEL 响应"""
    labels: List[str] = Field(default_factory=list)
    generated_count: int = 0
