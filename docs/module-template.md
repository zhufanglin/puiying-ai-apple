# 模块开发模板

> 新建 Apple 子模块时复制此模板，替换 `<Module>` 为实际模块名。

## 目录结构

```
apps/api/app/modules/apple/<module>/
├── __init__.py
├── router.py          # FastAPI 路由（端点定义）
├── schemas.py         # Pydantic 请求/响应模型
├── models.py          # SQLAlchemy 数据表
├── repository.py      # 数据库读写封装（可选）
├── service.py         # 核心业务逻辑（可选）
├── permissions.py     # 权限定义（可选）
├── prompts/           # AI Prompt 文件（可选）
│   └── __init__.py
└── tests/
    ├── __init__.py
    └── test_<module>.py
```

## 注册路由

在 `apps/api/app/main.py` 中：

```python
from app.modules.apple.<module>.router import router as <module>_router
app.include_router(<module>_router, prefix=f"{settings.API_PREFIX}/apple/<module>", tags=["Apple-<标签>"])
```

## router.py 骨架

```python
"""<Module> API 路由。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.schemas import APIResponse
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.accounts.models import User
from app.modules.apple.<module>. import schemas, service

router = APIRouter()

@router.get("", response_model=APIResponse[list[schemas.<Module>Out]])
async def list_<module>(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = await service.get_all(db)
    return APIResponse(data=items)

@router.post("", response_model=APIResponse[schemas.<Module>Out], status_code=201)
async def create_<module>(
    body: schemas.<Module>Create,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = await service.create(db, body, user_id=user.id)
    return APIResponse(data=item)
```

## schemas.py 骨架

```python
from pydantic import BaseModel
from datetime import datetime

class <Module>Create(BaseModel):
    name: str
    # ... 其他字段

class <Module>Out(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
```

## models.py 骨架

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.db.base import Base

class <Module>(Base):
    __tablename__ = "apple_<module>s"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```

## 测试骨架

```python
# tests/test_<module>.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_list_empty():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/apple/<module>")
    assert resp.status_code == 200
```

## 检查清单

- [ ] router.py 已创建并在 main.py 注册
- [ ] schemas.py 定义了 Create / Out / Update 模型
- [ ] models.py 表名以 `apple_` 前缀
- [ ] 至少 1 个单元测试
- [ ] GET 端点支持分页（limit / offset）
