from __future__ import annotations

from io import BytesIO
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from app.modules.apple.students.repository import StudentRepository
from app.modules.apple.students.student_service import StudentNotFoundError


class ScoreService:
    def __init__(self, repository: StudentRepository | None = None) -> None:
        self.repository = repository or StudentRepository()

    def list(
        self,
        student_id: str,
        *,
        school_year: str | None = None,
        term: str | None = None,
        subject: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        state = self.repository.state()
        if not self.repository.get_student(state, student_id):
            raise StudentNotFoundError(student_id)
        rows = list(self.repository.scores(state, student_id))
        if school_year:
            rows = [row for row in rows if row.get("schoolYear") == school_year]
        if term:
            rows = [row for row in rows if row.get("term") == term]
        if subject:
            rows = [row for row in rows if row.get("subject") == subject]
        if search:
            needle = search.casefold()
            rows = [
                row for row in rows
                if needle in str(row.get("subject", "")).casefold()
                or needle in str(row.get("grade", "")).casefold()
            ]
        return sorted(rows, key=lambda row: (row.get("schoolYear", ""), row.get("term", ""), row.get("subject", "")), reverse=True)

    def export_excel(
        self,
        student_id: str,
        *,
        school_year: str | None = None,
        term: str | None = None,
        subject: str | None = None,
    ) -> tuple[bytes, str]:
        state = self.repository.state()
        student = self.repository.get_student(state, student_id)
        if not student:
            raise StudentNotFoundError(student_id)
        rows = self.list(student_id, school_year=school_year, term=term, subject=subject)

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "成绩记录"
        sheet.sheet_view.showGridLines = False
        sheet.merge_cells("A1:E1")
        sheet["A1"] = f"{student['nameZh']}（{student['studentNo']}）成绩记录"
        sheet["A1"].font = Font(size=16, bold=True, color="FFFFFF")
        sheet["A1"].fill = PatternFill("solid", fgColor="0F766E")
        sheet["A1"].alignment = Alignment(horizontal="center")
        sheet.append(["筛选条件", f"学年：{school_year or '全部'}", f"学期：{term or '全部'}", f"科目：{subject or '全部'}", ""])
        sheet.append([])
        sheet.append(["学年", "学期", "科目", "分数", "等级"])
        for row in rows:
            sheet.append([row.get("schoolYear"), row.get("term"), row.get("subject"), row.get("score"), row.get("grade")])
        header = sheet[4]
        for cell in header:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="155E75")
            cell.alignment = Alignment(horizontal="center")
        sheet.freeze_panes = "A5"
        sheet.auto_filter.ref = f"A4:E{max(sheet.max_row, 4)}"
        widths = {"A": 16, "B": 14, "C": 22, "D": 12, "E": 12}
        for column, width in widths.items():
            sheet.column_dimensions[column].width = width
        for row in sheet.iter_rows(min_row=5, max_row=sheet.max_row):
            row[3].number_format = "0.00"
        output = BytesIO()
        workbook.save(output)
        suffix = "_".join(part for part in (school_year, term, subject) if part) or "all"
        filename = f"{student['studentNo']}_scores_{suffix}.xlsx"
        return output.getvalue(), filename
