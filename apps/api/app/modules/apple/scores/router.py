"""第二組：成績匯入、統計、AI 評語與 WhatsApp API。"""
from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.schemas import APIResponse
from app.core.permissions import Permissions, require_permission
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.accounts.models import User
from app.modules.audit.models import AuditLog
from app.modules.apple.scores import repository, service
from app.modules.apple.scores.ai_service import ScoreAIError
from app.modules.apple.scores.schemas import (
    CommentUpdate,
    ConfirmCommentsRequest,
    GenerateCommentsRequest,
    ScoreCommentResponse,
    SendCommentsRequest,
)

router = APIRouter()


def _audit(user: User, action: str, entity_type: str, detail: dict[str, Any], entity_id: int | None = None) -> AuditLog:
    return AuditLog(
        user_id=user.id,
        username=user.username,
        action=action,
        module="scores",
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail,
    )


@router.post("/import", response_model=APIResponse[dict[str, Any]])
async def import_scores(
    file: UploadFile = File(...),
    school_year: str = Query(..., alias="schoolYear", min_length=4, max_length=16),
    term: str = Query(..., min_length=1, max_length=24),
    exam_type: str = Query(..., alias="examType", min_length=1, max_length=80),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.STUDENTS_WRITE)),
):
    """匯入長表或寬表 .xlsx；合法列會成功，錯誤列逐項回報。"""
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="只支援 .xlsx 文件")
    try:
        result = await service.import_score_excel(
            db,
            await file.read(),
            file.filename or "scores.xlsx",
            school_year=school_year.strip(),
            term=term.strip(),
            exam_type=exam_type.strip(),
            user_id=user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.add(_audit(user, "import", "score", {key: result[key] for key in ("school_year", "term", "exam_type", "imported", "updated", "failed")}))
    await db.flush()
    return APIResponse(data=result)


@router.get("/stats/class", response_model=APIResponse[dict[str, Any]])
async def get_class_statistics(
    school_year: str = Query(..., alias="schoolYear"),
    term: str = Query(...),
    exam_type: str = Query(..., alias="examType"),
    class_name: str = Query(..., alias="className"),
    subject: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.STUDENTS_READ)),
):
    """班級平均、最高、最低、合格率、分數段、科目平均與排名。"""
    data = await service.class_statistics(
        db,
        school_year=school_year.strip(),
        term=term.strip(),
        exam_type=exam_type.strip(),
        class_name=class_name.strip(),
        subject=subject.strip() if subject else None,
    )
    return APIResponse(data=data)


@router.get("/stats/students/{student_id}", response_model=APIResponse[dict[str, Any]])
async def get_student_statistics(
    student_id: str,
    school_year: str = Query(..., alias="schoolYear"),
    term: str = Query(...),
    exam_type: str = Query(..., alias="examType"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.STUDENTS_READ)),
):
    """個人總分、百分比、班級排名及強弱科目。"""
    try:
        data = await service.student_statistics(
            db,
            student_id,
            school_year=school_year.strip(),
            term=term.strip(),
            exam_type=exam_type.strip(),
        )
    except service.ScoreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return APIResponse(data=data)


@router.get("/comments/status", response_model=APIResponse[dict[str, Any]])
async def get_comment_status(
    school_year: str | None = Query(default=None, alias="schoolYear"),
    term: str | None = None,
    exam_type: str | None = Query(default=None, alias="examType"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.STUDENTS_READ)),
):
    return APIResponse(data=await service.comment_status_counts(
        db, school_year=school_year, term=term, exam_type=exam_type
    ))


@router.get("/comments", response_model=APIResponse[list[ScoreCommentResponse]])
async def list_comments(
    school_year: str | None = Query(default=None, alias="schoolYear"),
    term: str | None = None,
    exam_type: str | None = Query(default=None, alias="examType"),
    status: Literal["pending", "confirmed", "sent"] | None = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    __: User = Depends(require_permission(Permissions.STUDENTS_READ)),
):
    return APIResponse(data=await repository.list_comments(
        db, school_year=school_year, term=term, exam_type=exam_type, status=status
    ))


@router.post("/comments/generate", response_model=APIResponse[dict[str, Any]])
async def generate_comments(
    body: GenerateCommentsRequest,
    x_ai_api_key: str | None = Header(default=None, alias="X-AI-API-Key"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.STUDENTS_WRITE)),
):
    """批量生成評語；DeepSeek Key 只在本次請求中使用，不記錄、不落庫。"""
    if not x_ai_api_key:
        raise HTTPException(status_code=422, detail="請輸入 DeepSeek API Key")
    try:
        result = await service.generate_score_comments(
            db,
            school_year=body.school_year,
            term=body.term,
            exam_type=body.exam_type,
            api_key=x_ai_api_key,
            model=body.model,
            user_id=user.id,
            student_ids=body.student_ids,
        )
    except service.ScoreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ScoreAIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    db.add(_audit(user, "generate", "score_comment", {
        "school_year": body.school_year,
        "term": body.term,
        "exam_type": body.exam_type,
        "generated": result["generated_count"],
        "failed": result["failed_count"],
    }))
    await db.flush()
    return APIResponse(data=result)


@router.patch("/comments/{comment_id}", response_model=APIResponse[ScoreCommentResponse])
async def edit_comment(
    comment_id: int,
    body: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.STUDENTS_WRITE)),
):
    try:
        comment = await service.update_comment(db, comment_id, body.model_dump(exclude_unset=True))
    except service.ScoreNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.ScoreWorkflowError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.add(_audit(user, "update", "score_comment", {"fields": sorted(body.model_fields_set)}, comment_id))
    await db.flush()
    return APIResponse(data=comment)


@router.post("/comments/confirm", response_model=APIResponse[dict[str, Any]])
async def confirm_comments(
    body: ConfirmCommentsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.STUDENTS_WRITE)),
):
    result = await service.confirm_comments(db, body.comment_ids, user_id=user.id)
    db.add(_audit(user, "approve", "score_comment", result))
    await db.flush()
    return APIResponse(data=result)


@router.post("/comments/{exam_type}/send", response_model=APIResponse[dict[str, Any]])
async def send_comments(
    exam_type: str,
    body: SendCommentsRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _: User = Depends(require_permission(Permissions.NOTIFICATIONS_SEND)),
):
    if body.exam_type != exam_type:
        raise HTTPException(status_code=422, detail="路徑與請求內容的考試類型不一致")
    result = await service.send_score_comments(
        db,
        school_year=body.school_year,
        term=body.term,
        exam_type=exam_type,
        comment_ids=body.comment_ids,
        resend=body.resend,
    )
    db.add(_audit(user, "send", "score_comment", {
        "school_year": body.school_year,
        "term": body.term,
        "exam_type": exam_type,
        "success": result["success"],
        "failed": result["failed"],
        "skipped": result["skipped"],
    }))
    await db.flush()
    return APIResponse(data=result)
