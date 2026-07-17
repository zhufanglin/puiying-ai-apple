from __future__ import annotations

from io import BytesIO
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.modules.apple.students.attendance_service import AttendanceService
from app.modules.apple.students.certificate_service import CertificateNotFoundError, CertificateService
from app.modules.apple.students.photo_service import StudentPhotoNotFoundError, StudentPhotoService
from app.modules.apple.students.score_service import ScoreService
from app.modules.apple.students.schemas import CertificateCreate, StudentCreate, StudentUpdate
from app.modules.apple.students.student_service import StudentConflictError, StudentNotFoundError, StudentService

router = APIRouter(prefix="/api/v1/apple/students", tags=["Apple - 学生事务"])


def response(data: Any, **extra: Any) -> dict[str, Any]:
    return {"code": 0, "message": "success", "data": data, **extra}


def not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="学生记录不存在")


@router.get("")
def list_students(
    search: str | None = None,
    class_name: str | None = Query(default=None, alias="className"),
    status: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=200),
) -> dict[str, Any]:
    rows = StudentService().list(search=search, class_name=class_name, status=status)
    start = (page - 1) * page_size
    return response(rows[start:start + page_size], pagination={"page": page, "page_size": page_size, "total": len(rows)})


@router.get("/summary")
def student_summary() -> dict[str, Any]:
    return response(StudentService().summary())


@router.get("/work-items")
def student_work_items(
    category: str = Query(pattern="^(attendance|transcript_reissue|enrollment_certificate)$"),
    search: str | None = None,
    class_name: str | None = Query(default=None, alias="className"),
    status: str | None = None,
    date_from: str | None = Query(default=None, alias="dateFrom"),
    date_to: str | None = Query(default=None, alias="dateTo"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, alias="pageSize", ge=1, le=100),
) -> dict[str, Any]:
    try:
        rows = StudentService().work_items(
            category=category,
            search=search,
            class_name=class_name,
            status=status,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    classes = sorted({row["className"] for row in rows})
    start = (page - 1) * page_size
    return response({
        "items": rows[start:start + page_size],
        "pagination": {"page": page, "pageSize": page_size, "total": len(rows)},
        "availableClasses": classes,
    })


@router.post("/attendance/import")
async def import_bulk_attendance(file: UploadFile = File(...)) -> dict[str, Any]:
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="只支持 .xlsx 文件")
    try:
        result = AttendanceService().import_bulk_excel(await file.read(), file.filename or "attendance.xlsx")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return response(result)


@router.post("/photos")
async def upload_student_photo(file: UploadFile = File(...)) -> dict[str, Any]:
    service = StudentPhotoService()
    try:
        content = await file.read(service.MAX_BYTES + 1)
        return response(service.save(content, file.filename or "student-photo", file.content_type))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/photos/{photo_id}")
def student_photo(photo_id: str) -> FileResponse:
    try:
        path, media_type = StudentPhotoService().get(photo_id)
    except StudentPhotoNotFoundError as exc:
        raise HTTPException(status_code=404, detail="学生照片不存在") from exc
    return FileResponse(path, media_type=media_type)


@router.post("/import")
async def import_students(file: UploadFile = File(...)) -> dict[str, Any]:
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="只支持 .xlsx 文件")
    try:
        result = StudentService().import_excel(await file.read(), file.filename or "students.xlsx")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return response(result)


@router.post("")
def create_student(body: StudentCreate) -> dict[str, Any]:
    try:
        return response(StudentService().create(body))
    except StudentConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{student_id}")
def get_student(student_id: str) -> dict[str, Any]:
    try:
        return response(StudentService().get(student_id))
    except StudentNotFoundError as exc:
        raise not_found() from exc


@router.patch("/{student_id}")
def update_student(student_id: str, body: StudentUpdate) -> dict[str, Any]:
    try:
        return response(StudentService().update(student_id, body))
    except StudentNotFoundError as exc:
        raise not_found() from exc


@router.delete("/{student_id}")
def delete_student(student_id: str) -> dict[str, Any]:
    try:
        return response(StudentService().delete(student_id))
    except StudentNotFoundError as exc:
        raise not_found() from exc


@router.get("/{student_id}/attendance")
def list_attendance(student_id: str) -> dict[str, Any]:
    try:
        rows = AttendanceService().list(student_id)
    except StudentNotFoundError as exc:
        raise not_found() from exc
    return response(rows, summary={"total": len(rows), "exceptions": sum(row["status"] != "present" for row in rows)})


@router.post("/{student_id}/attendance/import")
async def import_attendance(student_id: str, file: UploadFile = File(...)) -> dict[str, Any]:
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=422, detail="只支持 .xlsx 文件")
    try:
        result = AttendanceService().import_excel(student_id, await file.read(), file.filename or "attendance.xlsx")
    except StudentNotFoundError as exc:
        raise not_found() from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return response(result)


@router.get("/{student_id}/scores")
def list_scores(
    student_id: str,
    school_year: str | None = Query(default=None, alias="schoolYear"),
    term: str | None = None,
    subject: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    try:
        rows = ScoreService().list(student_id, school_year=school_year, term=term, subject=subject, search=search)
    except StudentNotFoundError as exc:
        raise not_found() from exc
    return response(rows)


@router.get("/{student_id}/scores/export")
def export_scores(
    student_id: str,
    school_year: str | None = Query(default=None, alias="schoolYear"),
    term: str | None = None,
    subject: str | None = None,
) -> StreamingResponse:
    try:
        content, filename = ScoreService().export_excel(student_id, school_year=school_year, term=term, subject=subject)
    except StudentNotFoundError as exc:
        raise not_found() from exc
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.get("/{student_id}/certificates")
def list_certificates(student_id: str) -> dict[str, Any]:
    try:
        return response(CertificateService().list(student_id))
    except StudentNotFoundError as exc:
        raise not_found() from exc


@router.post("/{student_id}/certificates")
def create_certificate(student_id: str, body: CertificateCreate) -> dict[str, Any]:
    try:
        return response(CertificateService().create(student_id, body))
    except StudentNotFoundError as exc:
        raise not_found() from exc


@router.get("/{student_id}/certificates/{certificate_id}/pdf")
def certificate_pdf(student_id: str, certificate_id: str) -> FileResponse:
    try:
        path, request = CertificateService().generate_pdf(student_id, certificate_id)
    except StudentNotFoundError as exc:
        raise not_found() from exc
    except CertificateNotFoundError as exc:
        raise HTTPException(status_code=404, detail="证明申请不存在") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return FileResponse(path, media_type="application/pdf", filename=f"{request['certificateType']}_{student_id}.pdf")
