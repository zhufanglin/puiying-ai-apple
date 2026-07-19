"""学生事务仓储接口及开发期文件适配器。"""

from __future__ import annotations

from typing import Any

from app.modules.apple.students.file_store import StudentFileStore, now_iso, store


class StudentRepository:
    def __init__(self, storage: StudentFileStore | None = None) -> None:
        self.storage = storage or store

    def state(self) -> dict[str, Any]:
        return self.storage.read()

    def save(self, state: dict[str, Any]) -> None:
        self.storage.write(state)

    def list_students(
        self,
        state: dict[str, Any],
        *,
        search: str | None = None,
        class_name: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        rows = [row for row in state["students"] if row.get("status") != "deleted"]
        if search:
            needle = search.casefold()
            rows = [
                row for row in rows
                if needle in row["studentNo"].casefold()
                or needle in row["nameZh"].casefold()
                or needle in (row.get("nameEn") or "").casefold()
            ]
        if class_name:
            rows = [row for row in rows if row["className"] == class_name]
        if status:
            rows = [row for row in rows if row["status"] == status]
        return sorted(rows, key=lambda row: (row["className"], row["studentNo"]))

    def get_student(self, state: dict[str, Any], student_id: str) -> dict[str, Any] | None:
        return next(
            (row for row in state["students"] if row["id"] == student_id and row.get("status") != "deleted"),
            None,
        )

    def get_by_no(self, state: dict[str, Any], student_no: str) -> dict[str, Any] | None:
        return next(
            (row for row in state["students"] if row["studentNo"] == student_no and row.get("status") != "deleted"),
            None,
        )

    def create_student(self, state: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
        timestamp = now_iso()
        row = {
            "id": self.storage.new_id("student"),
            **values,
            "createdAt": timestamp,
            "updatedAt": timestamp,
            "createdBy": "Apple",
            "updatedBy": "Apple",
            "lastReviewedBy": "Apple",
            "lastReviewedAt": timestamp,
            "sourceFileId": values.get("sourceFileId"),
        }
        state["students"].append(row)
        return row

    def update_student(self, row: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
        row.update({key: value for key, value in values.items() if value is not None})
        row.update({"updatedAt": now_iso(), "updatedBy": "Apple", "lastReviewedBy": "Apple", "lastReviewedAt": now_iso()})
        return row

    def attendance(self, state: dict[str, Any], student_id: str) -> list[dict[str, Any]]:
        return sorted(
            [row for row in state["attendanceRecords"] if row["studentId"] == student_id],
            key=lambda row: row["date"],
            reverse=True,
        )

    def upsert_attendance(self, state: dict[str, Any], values: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        existing = next(
            (
                row for row in state["attendanceRecords"]
                if row["studentId"] == values["studentId"] and row["date"] == values["date"]
            ),
            None,
        )
        if existing:
            existing.update(values)
            existing["updatedAt"] = now_iso()
            return existing, True
        row = {"id": self.storage.new_id("attendance"), **values, "createdAt": now_iso(), "updatedAt": now_iso(), "createdBy": "Apple", "updatedBy": "Apple"}
        state["attendanceRecords"].append(row)
        return row, False

    def certificates(self, state: dict[str, Any], student_id: str) -> list[dict[str, Any]]:
        return sorted(
            [row for row in state["certificateRequests"] if row["studentId"] == student_id],
            key=lambda row: row["requestDate"],
            reverse=True,
        )

    def get_certificate(self, state: dict[str, Any], student_id: str, certificate_id: str) -> dict[str, Any] | None:
        return next(
            (
                row for row in state["certificateRequests"]
                if row["id"] == certificate_id and row["studentId"] == student_id
            ),
            None,
        )

    def scores(self, state: dict[str, Any], student_id: str) -> list[dict[str, Any]]:
        return [row for row in state["scoreRecords"] if row["studentId"] == student_id]

