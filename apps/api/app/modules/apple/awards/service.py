"""奖状证书生成服务

依赖：pip install python-docx docxtpl

需要先创建模板：
    python scripts/create_certificate_template.py
"""

import io
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from docx import Document
from docxtpl import DocxTemplate


# 模板路径（相对于 api 目录）
TEMPLATE_DIR = Path(__file__).resolve().parents[4] / "templates" / "apple"
CERTIFICATE_TEMPLATE = TEMPLATE_DIR / "certificate.docx"


class CertificateService:
    """奖状证书生成"""

    @staticmethod
    def fill_template(
        template_path: Path,
        context: dict,
    ) -> bytes:
        """
        用 DocxTemplate 替换 Word 模板中的占位符（{{ placeholders }}）

        context 示例:
        {
            "school_name": "培英中學",
            "student_name": "張小明",
            "award_name": "三好學生",
            "class_name": "六年級甲班",
            "date": "2026年7月17日",
            "signatory": "陳校長",
            "remarks": "品學兼優，模範學生",
        }
        """
        doc = DocxTemplate(str(template_path))
        doc.render(context)

        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def word_to_pdf(docx_bytes: bytes) -> Optional[bytes]:
        """
        Word 转 PDF（需要安装 LibreOffice）
        转换失败时不抛异常，返回 None，调用方降级为 Word 下载
        """
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp_docx:
            tmp_docx.write(docx_bytes)
            docx_path = tmp_docx.name

        try:
            output_dir = tempfile.mkdtemp()
            result = subprocess.run(
                [
                    "soffice",
                    "--headless",
                    "--convert-to", "pdf",
                    "--outdir", output_dir,
                    docx_path,
                ],
                capture_output=True,
                timeout=30,
            )
            if result.returncode != 0:
                return None

            pdf_name = Path(docx_path).stem + ".pdf"
            pdf_path = Path(output_dir) / pdf_name
            if not pdf_path.exists():
                return None

            return pdf_path.read_bytes()

        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            return None
        finally:
            try:
                os.unlink(docx_path)
            except OSError:
                pass

    @classmethod
    def generate(
        cls,
        context: dict,
        output_format: str = "docx",
        template_path: Optional[Path] = None,
    ) -> tuple[bytes, str]:
        """
        一步生成证书

        参数:
            context: 模板变量
            output_format: "docx" 或 "pdf"
            template_path: 模板路径，默认用 CERTIFICATE_TEMPLATE

        返回:
            (文件字节, MIME类型)
        """
        tp = template_path or CERTIFICATE_TEMPLATE
        if not tp.exists():
            raise FileNotFoundError(
                f"模板文件不存在: {tp}\n"
                f"请先运行: python scripts/create_certificate_template.py"
            )

        # 1. 生成 Word
        docx_bytes = cls.fill_template(tp, context)

        # 2. Word only
        if output_format == "docx":
            return docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        # 3. Word → PDF
        pdf_bytes = cls.word_to_pdf(docx_bytes)
        if pdf_bytes:
            return pdf_bytes, "application/pdf"
        else:
            # 降级：PDF 不可用时返回 Word
            return docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
