from __future__ import annotations

import os
import shutil
import tempfile
import unittest
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook, load_workbook

from app.modules.apple.file_store import AppleFileStore
from app.modules.apple.students.attendance_service import AttendanceService
from app.modules.apple.students.certificate_service import CertificateService
from app.modules.apple.students.models import Attendance, CertificateRequest, Student
from app.modules.apple.students.photo_service import StudentPhotoService
from app.modules.apple.students.repository import StudentRepository
from app.modules.apple.students.schemas import CertificateCreate, StudentCreate, StudentUpdate
from app.modules.apple.students.score_service import ScoreService
from app.modules.apple.students.student_service import StudentConflictError, StudentService


class StudentServicesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        source_data = Path(__file__).resolve().parents[5] / "data"
        data_dir = Path(self.temp.name) / "data"
        data_dir.mkdir()
        shutil.copy2(source_data / "apple_state.json", data_dir / "apple_state.json")
        shutil.copytree(source_data / "imports", data_dir / "imports")
        self.previous_data_dir = os.environ.get("APPLE_DATA_DIR")
        os.environ["APPLE_DATA_DIR"] = str(data_dir)
        self.store = AppleFileStore()
        self.repository = StudentRepository(self.store)
        self.students = StudentService(self.repository)
        self.attendance = AttendanceService(self.repository)
        self.certificates = CertificateService(self.repository)
        self.photos = StudentPhotoService(self.repository)
        self.scores = ScoreService(self.repository)

    def tearDown(self) -> None:
        if self.previous_data_dir is None:
            os.environ.pop("APPLE_DATA_DIR", None)
        else:
            os.environ["APPLE_DATA_DIR"] = self.previous_data_dir
        self.temp.cleanup()

    def test_list_and_summary(self) -> None:
        rows = self.students.list()
        self.assertGreaterEqual(len(rows), 3)
        self.assertEqual(self.students.summary()["activeStudents"], 3)
        self.assertGreaterEqual(self.students.summary()["monthlyAttendanceExceptions"], 2)

    def test_create_update_and_delete(self) -> None:
        created = self.students.create(StudentCreate(studentNo="S26999", nameZh="测试学生", nameEn="Test Student", className="3C", parentEmail="parent@example.com"))
        self.assertEqual(created["studentNo"], "S26999")
        updated = self.students.update(created["id"], StudentUpdate(className="3D", parentPhone="61230000"))
        self.assertEqual(updated["className"], "3D")
        self.assertTrue(self.students.delete(created["id"])["deleted"])
        self.assertFalse(any(row["id"] == created["id"] for row in self.students.list()))

    def test_duplicate_student_number_is_rejected(self) -> None:
        with self.assertRaises(StudentConflictError):
            self.students.create(StudentCreate(studentNo="S26001", nameZh="重复", className="2A"))

    def test_student_excel_import_upserts_and_reports_errors(self) -> None:
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["学号", "姓名", "班级", "入学日期", "家长电邮"])
        sheet.append(["S26001", "陈嘉怡", "2C", "2025-09-01", "parent.s26001@example.edu.hk"])
        sheet.append(["S26998", "新同学", "1A", "2026-09-01", "new.parent@example.edu.hk"])
        sheet.append(["", "缺学号", "1A", "2026-09-01", "bad@example.edu.hk"])
        stream = BytesIO(); workbook.save(stream)
        result = self.students.import_excel(stream.getvalue(), "students.xlsx")
        self.assertEqual(result["imported"], 1)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(len(result["errors"]), 1)
        self.assertEqual(self.students.list(search="S26998")[0]["nameZh"], "新同学")

    def test_attendance_excel_import_and_anomaly_detection(self) -> None:
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["日期", "状态", "备注", "学号"])
        sheet.append(["2026-07-10", "出勤", "", "S26001"])
        sheet.append(["2026-07-11", "迟到", "交通延误", "S26001"])
        sheet.append(["2026-07-12", "缺席", "错误学生", "S26002"])
        stream = BytesIO(); workbook.save(stream)
        result = self.attendance.import_excel("student-001", stream.getvalue(), "attendance.xlsx")
        self.assertEqual(result["imported"], 2)
        self.assertEqual(len(result["errors"]), 1)
        self.assertTrue(any(row["date"] == "2026-07-11" for row in self.attendance.anomalies("student-001")))

    def test_bulk_attendance_import_across_students(self) -> None:
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["学号", "日期", "状态", "备注"])
        sheet.append(["S26001", "2026-07-20", "迟到", "交通延误"])
        sheet.append(["S26002", "2026-07-20", "病假", "已交证明"])
        sheet.append(["S99999", "2026-07-20", "缺席", "不存在的学生"])
        stream = BytesIO(); workbook.save(stream)
        result = self.attendance.import_bulk_excel(stream.getvalue(), "attendance-bulk.xlsx")
        self.assertEqual(result["imported"], 2)
        self.assertEqual(result["affectedStudents"], 2)
        self.assertEqual(len(result["errors"]), 1)

    def test_work_items_can_filter_by_type_class_and_time(self) -> None:
        rows = self.students.work_items(
            category="attendance",
            class_name="2A",
            status="late",
            date_from="2026-07-01",
            date_to="2026-07-31",
        )
        self.assertTrue(rows)
        self.assertTrue(all(row["className"] == "2A" and row["status"] == "late" for row in rows))
        pending = self.students.work_items(category="enrollment_certificate")
        self.assertTrue(all(row["status"] != "generated" for row in pending))

    def test_score_export_filters_by_subject(self) -> None:
        content, filename = self.scores.export_excel("student-001", subject="中国语文")
        workbook = load_workbook(BytesIO(content), data_only=True)
        sheet = workbook["成绩记录"]
        self.assertIn("S26001", filename)
        self.assertEqual(sheet["C5"].value, "中国语文")
        self.assertEqual(sheet.max_row, 5)

    def test_student_photo_upload_and_lookup(self) -> None:
        content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
        saved = self.photos.save(content, "student.png", "image/png")
        path, media_type = self.photos.get(saved["photoId"])
        self.assertTrue(path.is_file())
        self.assertEqual(media_type, "image/png")
        self.assertTrue(saved["photoUrl"].startswith("/api/v1/apple/students/photos/"))

    def test_certificate_request_and_pdf_generation(self) -> None:
        request = self.certificates.create("student-001", CertificateCreate(certificateType="enrollment_bilingual", language="bilingual", purpose="测试用途"))
        pdf_path, updated = self.certificates.generate_pdf("student-001", request["id"])
        self.assertTrue(pdf_path.is_file())
        self.assertGreater(pdf_path.stat().st_size, 500)
        self.assertEqual(updated["status"], "generated")

    def test_orm_table_contract(self) -> None:
        self.assertEqual(Student.__tablename__, "apple_students")
        self.assertEqual(Attendance.__tablename__, "apple_attendance")
        self.assertEqual(CertificateRequest.__tablename__, "apple_certificate_requests")
        self.assertIn("student_no", Student.__table__.columns)


if __name__ == "__main__":
    unittest.main()
