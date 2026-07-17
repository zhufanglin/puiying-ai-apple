from __future__ import annotations

import shutil
import subprocess
from datetime import date
from pathlib import Path
from typing import Any

from docxtpl import DocxTemplate
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen.canvas import Canvas

from app.modules.apple.students.file_store import now_iso
from app.modules.apple.students.repository import StudentRepository
from app.modules.apple.students.schemas import CertificateCreate
from app.modules.apple.students.student_service import StudentNotFoundError


class CertificateNotFoundError(LookupError):
    pass


class CertificateService:
    def __init__(self, repository: StudentRepository | None = None) -> None:
        self.repository = repository or StudentRepository()
        self.template_path = Path(__file__).resolve().parents[4] / "templates" / "apple" / "student_certificate.docx"

    def list(self, student_id: str) -> list[dict[str, Any]]:
        state = self.repository.state()
        if not self.repository.get_student(state, student_id):
            raise StudentNotFoundError(student_id)
        return self.repository.certificates(state, student_id)

    def create(self, student_id: str, body: CertificateCreate) -> dict[str, Any]:
        state = self.repository.state()
        student = self.repository.get_student(state, student_id)
        if not student:
            raise StudentNotFoundError(student_id)
        row = {
            "id": self.repository.storage.new_id("certificate"),
            "studentId": student_id,
            "requestDate": date.today().isoformat(),
            "certificateType": body.certificateType.value,
            "language": body.language,
            "purpose": body.purpose,
            "status": "pending",
            "docxPath": None,
            "pdfPath": None,
            "generatedAt": None,
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
            "createdBy": "Apple",
            "updatedBy": "Apple",
        }
        state["certificateRequests"].append(row)
        self.repository.storage.audit(state, "student_certificate.requested", "student", student_id, {"studentId": student_id, "certificateId": row["id"], "type": row["certificateType"]})
        self.repository.save(state)
        return row

    def generate_pdf(self, student_id: str, certificate_id: str) -> tuple[Path, dict[str, Any]]:
        state = self.repository.state()
        student = self.repository.get_student(state, student_id)
        if not student:
            raise StudentNotFoundError(student_id)
        request = self.repository.get_certificate(state, student_id, certificate_id)
        if not request:
            raise CertificateNotFoundError(certificate_id)
        if request.get("pdfPath") and Path(request["pdfPath"]).is_file():
            return Path(request["pdfPath"]), request
        if request["certificateType"] == "transcript_reissue":
            title_zh, title_en = "成績表補領確認", "Transcript Reissue Confirmation"
        else:
            title_zh, title_en = "在學證明書", "Certificate of Enrollment"
        issue_date = date.today()
        context = {
            "school_name_zh": "香港培英中學",
            "school_name_en": "Hong Kong Pui Ying Secondary School",
            "title_zh": title_zh,
            "title_en": title_en,
            "student_name_zh": student["nameZh"],
            "student_name_en": student.get("nameEn") or student["nameZh"],
            "student_no": student["studentNo"],
            "class_name": student["className"],
            "admission_date": student.get("admissionDate") or "未提供",
            "purpose": request.get("purpose") or "学校事务",
            "issue_date_zh": f"{issue_date.year}年{issue_date.month}月{issue_date.day}日",
            "issue_date_en": issue_date.strftime("%d %B %Y"),
        }
        if not self.template_path.is_file():
            raise FileNotFoundError("在学证明模板不存在")
        docx_path = self.repository.storage.artifact_path(f"student-{student_id}", f"{certificate_id}.docx")
        pdf_path = self.repository.storage.artifact_path(f"student-{student_id}", f"{certificate_id}.pdf")
        template = DocxTemplate(self.template_path)
        template.render(context)
        template.save(docx_path)
        if not self._convert_with_libreoffice(docx_path, pdf_path):
            self._render_fallback_pdf(pdf_path, context)
        request.update({"status": "generated", "docxPath": str(docx_path), "pdfPath": str(pdf_path), "generatedAt": now_iso(), "updatedAt": now_iso(), "updatedBy": "Apple"})
        artifact = {"id": self.repository.storage.new_id("artifact"), "caseId": f"student:{student_id}", "artifactType": "student_certificate_pdf", "fileName": pdf_path.name, "path": str(pdf_path), "version": 1, "templateVersion": "student-certificate-v1", "status": "generated", "hash": self.repository.storage.hash_file(pdf_path), "createdAt": now_iso()}
        state["artifacts"].append(artifact)
        self.repository.storage.audit(state, "student_certificate.generated", "student", student_id, {"studentId": student_id, "certificateId": certificate_id, "artifactId": artifact["id"]})
        self.repository.save(state)
        return pdf_path, request

    @staticmethod
    def _convert_with_libreoffice(docx_path: Path, pdf_path: Path) -> bool:
        executable = shutil.which("soffice") or shutil.which("libreoffice")
        if not executable:
            return False
        try:
            completed = subprocess.run([executable, "--headless", "--convert-to", "pdf", "--outdir", str(pdf_path.parent), str(docx_path)], capture_output=True, timeout=60, check=False)
            converted = pdf_path.parent / f"{docx_path.stem}.pdf"
            return completed.returncode == 0 and converted.is_file()
        except (OSError, subprocess.TimeoutExpired):
            return False

    @staticmethod
    def _render_fallback_pdf(path: Path, context: dict[str, Any]) -> None:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        canvas = Canvas(str(path), pagesize=A4)
        width, height = A4
        canvas.setTitle(f"{context['title_zh']} - {context['student_no']}")
        canvas.setFont("STSong-Light", 18)
        canvas.drawCentredString(width / 2, height - 72, context["school_name_zh"])
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawCentredString(width / 2, height - 92, context["school_name_en"])
        canvas.setFont("STSong-Light", 22)
        canvas.drawCentredString(width / 2, height - 145, context["title_zh"])
        canvas.setFont("Helvetica-Bold", 13)
        canvas.drawCentredString(width / 2, height - 166, context["title_en"])
        canvas.setFont("STSong-Light", 12)
        zh = f"茲證明本校學生 {context['student_name_zh']}（學號：{context['student_no']}），現就讀 {context['class_name']} 班。此證明應申請人要求簽發，用途為：{context['purpose']}。"
        y = height - 235
        for line in _wrap_cjk(zh, 34):
            canvas.drawString(72, y, line); y -= 22
        canvas.setFont("Helvetica", 11)
        en = f"This is to certify that {context['student_name_en']} (Student No. {context['student_no']}) is currently enrolled in Class {context['class_name']} at our school. This certificate is issued upon request for the stated purpose."
        for line in _wrap_words(en, 78):
            canvas.drawString(72, y - 12, line); y -= 17
        canvas.setFont("STSong-Light", 11)
        canvas.drawString(72, 135, f"簽發日期：{context['issue_date_zh']}")
        canvas.setFont("Helvetica", 10)
        canvas.drawString(72, 117, f"Date of Issue: {context['issue_date_en']}")
        canvas.setFont("STSong-Light", 11)
        canvas.drawRightString(width - 72, 135, "校長簽署：________________")
        canvas.save()


def _wrap_cjk(text: str, width: int) -> list[str]:
    return [text[index:index + width] for index in range(0, len(text), width)]


def _wrap_words(text: str, width: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if len(candidate) > width and line:
            lines.append(line); line = word
        else:
            line = candidate
    if line: lines.append(line)
    return lines
