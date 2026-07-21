"""受控文件存储。"""

import asyncio
import mimetypes
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.files.models import File

ALLOWED_MODULES = {"awards", "finance", "assets", "students"}
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".pdf"}


async def save_upload(
    db: AsyncSession,
    upload: UploadFile,
    *,
    module: str,
    user_id: int,
    entity_type: str | None = None,
    entity_id: int | None = None,
) -> File:
    settings = get_settings()
    if module not in ALLOWED_MODULES:
        raise HTTPException(status_code=422, detail="不支持的文件模块")

    original_name = Path(upload.filename or "upload").name
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=422, detail="只支持 JPG、PNG、BMP 或 PDF 文件")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await upload.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"文件不能超过 {settings.MAX_UPLOAD_SIZE_MB}MB")
    if not content:
        raise HTTPException(status_code=422, detail="不能上传空文件")

    module_dir = Path(settings.UPLOAD_DIR).resolve() / module
    await asyncio.to_thread(module_dir.mkdir, parents=True, exist_ok=True)
    stored_path = module_dir / f"{uuid4().hex}{suffix}"
    await asyncio.to_thread(stored_path.write_bytes, content)

    mime_type = upload.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    record = File(
        filename=original_name,
        stored_path=str(stored_path),
        mime_type=mime_type,
        size_bytes=len(content),
        module=module,
        uploaded_by=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(record)
    try:
        await db.flush()
        await db.refresh(record)
    except Exception:
        await asyncio.to_thread(stored_path.unlink, missing_ok=True)
        raise
    return record
