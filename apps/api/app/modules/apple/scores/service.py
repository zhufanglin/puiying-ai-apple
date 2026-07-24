"""成績匯入、統計、AI 評語審閱及 WhatsApp 發送的業務流程。"""
from __future__ import annotations

import asyncio
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.apple.scores import repository
from app.modules.apple.scores.ai_service import AITransport, ScoreAIError, generate_comment_with_ai
from app.modules.apple.scores.models import Score, ScoreComment
from app.modules.apple.students.models import Student
from app.modules.apple.students.score_service import (
    ParsedScore,
    calc_class_stats,
    calc_student_stats,
    parse_score_workbook,
)
from services.whatsapp_client import WhatsAppClient


class ScoreNotFoundError(LookupError):
    pass


class ScoreWorkflowError(RuntimeError):
    pass


def _row_dict(score: Score, student: Student) -> dict[str, Any]:
    return {
        "student_id": score.student_id,
        "student_no": student.student_no,
        "student_name": student.name_zh,
        "class_name": student.class_name,
        "subject": score.subject,
        "score": float(score.score),
        "full_mark": float(score.full_mark),
    }


async def import_score_excel(
    db: AsyncSession,
    content: bytes,
    filename: str,
    *,
    school_year: str,
    term: str,
    exam_type: str,
    user_id: int,
) -> dict[str, Any]:
    if len(content) > 10 * 1024 * 1024:
        raise ValueError("成績 Excel 不可超過 10MB")
    parsed, errors = parse_score_workbook(content)
    students = await repository.students_by_numbers(db, (row.student_no for row in parsed))

    resolved: list[tuple[ParsedScore, Student]] = []
    for row in parsed:
        student = students.get(row.student_no.upper())
        if not student:
            errors.append({"row": row.row, "subject": row.subject, "message": f"找不到學號 {row.student_no}"})
            continue
        if row.student_name and row.student_name.casefold() != student.name_zh.strip().casefold():
            errors.append({"row": row.row, "subject": row.subject, "message": "學號與學生姓名不符"})
            continue
        resolved.append((row, student))

    existing = await repository.existing_scores(
        db,
        school_year=school_year,
        term=term,
        exam_type=exam_type,
        student_ids=(student.id for _, student in resolved),
        subjects=(row.subject for row, _ in resolved),
    )
    imported = updated = 0
    for row, student in resolved:
        key = (student.id, row.subject)
        score = existing.get(key)
        if score:
            score.score = row.score
            score.full_mark = row.full_mark
            score.source = "excel"
            score.source_filename = Path(filename).name[:255]
            updated += 1
        else:
            score = Score(
                student_id=student.id,
                school_year=school_year,
                term=term,
                exam_type=exam_type,
                subject=row.subject,
                score=row.score,
                full_mark=row.full_mark,
                source="excel",
                source_filename=Path(filename).name[:255],
                created_by=user_id,
            )
            db.add(score)
            existing[key] = score
            imported += 1
    await db.flush()
    return {
        "school_year": school_year,
        "term": term,
        "exam_type": exam_type,
        "imported": imported,
        "updated": updated,
        "failed": len(errors),
        "errors": sorted(errors, key=lambda error: (int(error.get("row", 0)), str(error.get("subject", "")))),
    }


async def class_statistics(
    db: AsyncSession,
    *,
    school_year: str,
    term: str,
    exam_type: str,
    class_name: str,
    subject: str | None = None,
) -> dict[str, Any]:
    pairs = await repository.list_scores(
        db,
        school_year=school_year,
        term=term,
        exam_type=exam_type,
        class_name=class_name,
        subject=subject,
    )
    rows = [_row_dict(score, student) for score, student in pairs]
    result = calc_class_stats(rows)
    names = {student.id: {"student_no": student.student_no, "student_name": student.name_zh} for _, student in pairs}
    for ranking in result["rankings"]:
        ranking.update(names.get(ranking["student_id"], {}))
    return {
        "school_year": school_year,
        "term": term,
        "exam_type": exam_type,
        "class_name": class_name,
        "subject": subject,
        **result,
    }


async def student_statistics(
    db: AsyncSession,
    student_id: str,
    *,
    school_year: str,
    term: str,
    exam_type: str,
) -> dict[str, Any]:
    student = await repository.get_student(db, student_id)
    if not student:
        raise ScoreNotFoundError("學生不存在")
    pairs = await repository.list_scores(
        db,
        school_year=school_year,
        term=term,
        exam_type=exam_type,
        class_name=student.class_name,
    )
    result = calc_student_stats((_row_dict(score, owner) for score, owner in pairs), student_id)
    if result is None:
        raise ScoreNotFoundError("該學生在指定考試沒有成績")
    return {
        "school_year": school_year,
        "term": term,
        "exam_type": exam_type,
        "student_no": student.student_no,
        "student_name": student.name_zh,
        "class_name": student.class_name,
        **result,
    }


def _profiles(pairs: list[tuple[Score, Student]]) -> dict[str, dict[str, Any]]:
    by_class: dict[str, list[tuple[Score, Student]]] = defaultdict(list)
    for pair in pairs:
        by_class[pair[1].class_name].append(pair)

    profiles: dict[str, dict[str, Any]] = {}
    for class_name, class_pairs in by_class.items():
        rows = [_row_dict(score, student) for score, student in class_pairs]
        stats = calc_class_stats(rows)
        ranks = {row["student_id"]: row for row in stats["rankings"]}
        subject_average = {row["subject"]: row["average_percentage"] for row in stats["subject_averages"]}
        students: dict[str, Student] = {student.id: student for _, student in class_pairs}
        student_rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            student_rows[row["student_id"]].append(row)
        for student_id, score_rows in student_rows.items():
            student = students[student_id]
            personal = calc_student_stats(rows, student_id)
            profiles[student_id] = {
                "student_name": student.name_zh,
                "class_name": class_name,
                "subjects": [
                    {
                        "subject": row["subject"],
                        "score": row["score"],
                        "full_mark": row["full_mark"],
                        "class_average_percentage": subject_average.get(row["subject"], 0),
                    }
                    for row in score_rows
                ],
                "average_percentage": personal["average_percentage"] if personal else 0,
                "rank": ranks.get(student_id, {}).get("rank"),
                "class_size": stats["student_count"],
            }
    return profiles


async def generate_score_comments(
    db: AsyncSession,
    *,
    school_year: str,
    term: str,
    exam_type: str,
    api_key: str,
    model: str,
    user_id: int,
    student_ids: list[str] | None = None,
    transport: AITransport | None = None,
) -> dict[str, Any]:
    """批量調用 DeepSeek，逐名寫入 pending 評語，單名失敗不回滾其他學生。"""

    if not api_key or len(api_key.strip()) < 8:
        raise ScoreAIError("請輸入有效的 DeepSeek API Key")
    pairs = await repository.list_scores(
        db,
        school_year=school_year,
        term=term,
        exam_type=exam_type,
    )
    if student_ids is not None:
        selected = set(student_ids)
        pairs = [pair for pair in pairs if pair[0].student_id in selected]
    profiles = _profiles(pairs)
    if not profiles:
        raise ScoreNotFoundError("指定考試沒有可生成評語的成績")

    attendance = await repository.attendance_summary(db, profiles)
    existing = await repository.comments_by_students(
        db,
        school_year=school_year,
        term=term,
        exam_type=exam_type,
        student_ids=profiles,
    )
    generated: list[ScoreComment] = []
    errors: list[dict[str, str]] = []
    for student_id, profile in profiles.items():
        profile["attendance"] = attendance.get(student_id, {"total": 0, "attendance_rate": 0})
        try:
            value = await generate_comment_with_ai(profile, api_key, model, transport=transport)
        except ScoreAIError as exc:
            errors.append({"student_id": student_id, "student_name": str(profile["student_name"]), "message": str(exc)})
            continue

        comment = existing.get(student_id)
        if comment is None:
            comment = ScoreComment(
                student_id=student_id,
                school_year=school_year,
                term=term,
                exam_type=exam_type,
                created_by=user_id,
                comment_text=str(value["comment_text"]),
            )
            db.add(comment)
        comment.comment_text = str(value["comment_text"])
        comment.highlight_subject = value["highlight_subject"]
        comment.improve_subject = value["improve_subject"]
        comment.suggestion = value["suggestion"]
        comment.status = "pending"
        comment.delivery_status = "not_sent"
        comment.reviewed_by = None
        comment.reviewed_at = None
        comment.sent_at = None
        comment.whatsapp_message_id = None
        comment.send_error = None
        generated.append(comment)
    await db.flush()
    return {"generated": generated, "generated_count": len(generated), "failed_count": len(errors), "errors": errors}


async def update_comment(
    db: AsyncSession,
    comment_id: int,
    values: dict[str, Any],
) -> ScoreComment:
    comment = await repository.get_comment(db, comment_id)
    if not comment:
        raise ScoreNotFoundError("評語不存在")
    if comment.status == "sent":
        raise ScoreWorkflowError("已發送評語不可修改")
    for field in ("comment_text", "highlight_subject", "improve_subject", "suggestion"):
        if field in values:
            setattr(comment, field, values[field])
    await db.flush()
    return comment


async def confirm_comments(db: AsyncSession, comment_ids: list[int], *, user_id: int) -> dict[str, Any]:
    comments = await repository.list_comments(db, comment_ids=comment_ids)
    found = {comment.id for comment in comments}
    missing = sorted(set(comment_ids) - found)
    confirmed = skipped = 0
    now = datetime.now(timezone.utc)
    for comment in comments:
        if comment.status == "sent":
            skipped += 1
            continue
        comment.status = "confirmed"
        comment.reviewed_by = user_id
        comment.reviewed_at = now
        confirmed += 1
    await db.flush()
    return {"confirmed": confirmed, "skipped": skipped, "missing_ids": missing}


async def send_score_comments(
    db: AsyncSession,
    *,
    school_year: str,
    term: str,
    exam_type: str,
    comment_ids: list[int] | None = None,
    resend: bool = False,
    client: WhatsAppClient | None = None,
) -> dict[str, Any]:
    comments = await repository.list_comments(
        db,
        school_year=school_year,
        term=term,
        exam_type=exam_type,
        comment_ids=comment_ids,
    )
    student_ids = {comment.student_id for comment in comments}
    result = await db.execute(select(Student).where(Student.id.in_(student_ids))) if student_ids else None
    students = {student.id: student for student in result.scalars().all()} if result is not None else {}
    whatsapp = client or WhatsAppClient()
    success = failed = skipped = 0
    details: list[dict[str, Any]] = []
    for comment in comments:
        if comment.status == "sent" and not resend:
            skipped += 1
            continue
        if comment.status not in {"confirmed", "sent"}:
            skipped += 1
            continue
        student = students.get(comment.student_id)
        phone = (student.parent_phone or "").strip() if student else ""
        if not phone:
            comment.delivery_status = "failed"
            comment.send_error = "未設定家長 WhatsApp 號碼"
            failed += 1
            details.append({"comment_id": comment.id, "student_id": comment.student_id, "status": "failed", "error": comment.send_error})
            continue

        comment.delivery_status = "pending"
        message = (
            f"家長您好：\n\n以下是{student.name_zh}同學 {school_year} {term} {exam_type}的成績評語：\n"
            f"{comment.comment_text}\n\n如有疑問，請與班主任聯絡。"
        )
        send_result = await asyncio.to_thread(whatsapp.send_text, phone, message)
        if send_result.get("status") == "sent":
            comment.status = "sent"
            comment.delivery_status = "sent"
            comment.sent_at = datetime.now(timezone.utc)
            comment.whatsapp_message_id = str(send_result.get("message_id") or "") or None
            comment.send_error = None
            success += 1
            details.append({"comment_id": comment.id, "student_id": comment.student_id, "status": "sent", "message_id": comment.whatsapp_message_id})
        else:
            comment.delivery_status = "failed"
            comment.send_error = str(send_result.get("error") or "WhatsApp 發送失敗")[:500]
            failed += 1
            details.append({"comment_id": comment.id, "student_id": comment.student_id, "status": "failed", "error": comment.send_error})
    await db.flush()
    return {"total": len(comments), "success": success, "failed": failed, "skipped": skipped, "details": details}


async def comment_status_counts(
    db: AsyncSession,
    *,
    school_year: str | None = None,
    term: str | None = None,
    exam_type: str | None = None,
) -> dict[str, Any]:
    comments = await repository.list_comments(db, school_year=school_year, term=term, exam_type=exam_type)
    workflow = Counter(comment.status for comment in comments)
    delivery = Counter(comment.delivery_status for comment in comments)
    return {
        "total": len(comments),
        "workflow": {name: workflow.get(name, 0) for name in ("pending", "confirmed", "sent")},
        "delivery": {name: delivery.get(name, 0) for name in ("not_sent", "pending", "sent", "delivered", "read", "failed")},
    }
