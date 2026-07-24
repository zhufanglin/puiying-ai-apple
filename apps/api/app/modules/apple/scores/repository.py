"""成績與評語的資料庫存取函數。"""
from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.apple.scores.models import Score, ScoreComment
from app.modules.apple.students.models import Attendance, Student


async def students_by_numbers(db: AsyncSession, student_numbers: Iterable[str]) -> dict[str, Student]:
    numbers = sorted({number.strip().upper() for number in student_numbers if number.strip()})
    if not numbers:
        return {}
    result = await db.execute(select(Student).where(Student.student_no.in_(numbers)))
    return {student.student_no.upper(): student for student in result.scalars().all()}


async def get_student(db: AsyncSession, student_id: str) -> Student | None:
    return await db.get(Student, student_id)


async def list_scores(
    db: AsyncSession,
    *,
    school_year: str,
    term: str,
    exam_type: str,
    class_name: str | None = None,
    student_id: str | None = None,
    subject: str | None = None,
) -> list[tuple[Score, Student]]:
    statement = (
        select(Score, Student)
        .join(Student, Student.id == Score.student_id)
        .where(
            Score.school_year == school_year,
            Score.term == term,
            Score.exam_type == exam_type,
        )
    )
    if class_name:
        statement = statement.where(Student.class_name == class_name)
    if student_id:
        statement = statement.where(Score.student_id == student_id)
    if subject:
        statement = statement.where(Score.subject == subject)
    statement = statement.order_by(Student.class_name, Student.student_no, Score.subject)
    result = await db.execute(statement)
    return list(result.all())


async def existing_scores(
    db: AsyncSession,
    *,
    school_year: str,
    term: str,
    exam_type: str,
    student_ids: Iterable[str],
    subjects: Iterable[str],
) -> dict[tuple[str, str], Score]:
    student_ids = list(set(student_ids))
    subjects = list(set(subjects))
    if not student_ids or not subjects:
        return {}
    result = await db.execute(
        select(Score).where(
            Score.school_year == school_year,
            Score.term == term,
            Score.exam_type == exam_type,
            Score.student_id.in_(student_ids),
            Score.subject.in_(subjects),
        )
    )
    return {(score.student_id, score.subject): score for score in result.scalars().all()}


async def attendance_summary(db: AsyncSession, student_ids: Iterable[str]) -> dict[str, dict[str, int | float]]:
    ids = list(set(student_ids))
    summaries: dict[str, dict[str, int | float]] = {
        student_id: {"total": 0, "present": 0, "late": 0, "absent": 0, "sick_leave": 0, "attendance_rate": 0.0}
        for student_id in ids
    }
    if not ids:
        return summaries
    result = await db.execute(select(Attendance).where(Attendance.student_id.in_(ids)))
    for attendance in result.scalars().all():
        summary = summaries.setdefault(attendance.student_id, {"total": 0})
        summary["total"] = int(summary.get("total", 0)) + 1
        summary[attendance.status] = int(summary.get(attendance.status, 0)) + 1
    for summary in summaries.values():
        total = int(summary.get("total", 0))
        attended = int(summary.get("present", 0)) + int(summary.get("late", 0))
        summary["attendance_rate"] = round(attended / total * 100, 2) if total else 0.0
    return summaries


async def get_comment(db: AsyncSession, comment_id: int) -> ScoreComment | None:
    return await db.get(ScoreComment, comment_id)


async def list_comments(
    db: AsyncSession,
    *,
    school_year: str | None = None,
    term: str | None = None,
    exam_type: str | None = None,
    status: str | None = None,
    comment_ids: Iterable[int] | None = None,
) -> list[ScoreComment]:
    statement = select(ScoreComment)
    if school_year:
        statement = statement.where(ScoreComment.school_year == school_year)
    if term:
        statement = statement.where(ScoreComment.term == term)
    if exam_type:
        statement = statement.where(ScoreComment.exam_type == exam_type)
    if status:
        statement = statement.where(ScoreComment.status == status)
    if comment_ids is not None:
        ids = list(set(comment_ids))
        if not ids:
            return []
        statement = statement.where(ScoreComment.id.in_(ids))
    result = await db.execute(statement.order_by(ScoreComment.id))
    return list(result.scalars().all())


async def comments_by_students(
    db: AsyncSession,
    *,
    school_year: str,
    term: str,
    exam_type: str,
    student_ids: Iterable[str],
) -> dict[str, ScoreComment]:
    ids = list(set(student_ids))
    if not ids:
        return {}
    result = await db.execute(
        select(ScoreComment).where(
            ScoreComment.school_year == school_year,
            ScoreComment.term == term,
            ScoreComment.exam_type == exam_type,
            ScoreComment.student_id.in_(ids),
        )
    )
    return {comment.student_id: comment for comment in result.scalars().all()}
