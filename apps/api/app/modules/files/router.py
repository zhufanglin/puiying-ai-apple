"""文件上传路由。"""

from fastapi import APIRouter, Depends, File as FormFile, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.schemas import APIResponse
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.accounts.models import User
from app.modules.files.models import File
from app.modules.files.schemas import FileResponse
from app.modules.files.service import save_upload

router = APIRouter()


@router.post("/upload", response_model=APIResponse[FileResponse])
async def upload_file(
    file: UploadFile = FormFile(...),
    module: str = Form(...),
    entity_type: str | None = Form(None),
    entity_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = await save_upload(
        db, file, module=module, user_id=user.id,
        entity_type=entity_type, entity_id=entity_id,
    )
    return APIResponse(data=record)


@router.get("/{file_id}", response_model=APIResponse[FileResponse])
async def get_file_metadata(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(File).where(File.id == file_id, File.uploaded_by == user.id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="文件不存在")
    return APIResponse(data=record)
