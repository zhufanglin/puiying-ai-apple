"""证书生成服务（仅 PDF）

使用 fpdf2 直接生成 PDF 证书，无需外部依赖。
"""
import os
from datetime import datetime
from pathlib import Path

# ── 当前文件所在目录: services/ ──
_SERVICE_DIR = Path(__file__).parent
# ── templates/ ──
_TEMPLATES_DIR = _SERVICE_DIR.parent / "templates"
# ── templates/generated/（保存生成的证书）──
_OUTPUT_DIR = _TEMPLATES_DIR / "generated"


def _ensure_output_dir() -> Path:
    """确保生成的输出目录存在"""
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return _OUTPUT_DIR


def _build_filename(data: dict, ext: str) -> str:
    """生成唯一文件名：学生名_时间戳.ext"""
    ts = datetime.now().strftime("%Y%m%d%H%M%S%f")
    safe_name = data["student_name"].replace(" ", "_").replace("/", "_")
    return f"{safe_name}_{ts}.{ext}"


# ===================================================================
#  公共接口
# ===================================================================

def generate_certificate(data: dict) -> str:
    """生成 PDF 证书文件

    Args:
        data: 包含以下键的字典
            - student_name   (str) 学生姓名
            - student_class  (str) 班级
            - award_year     (str) 学年
            - award_title    (str) 奖状标题
            - issue_date     (str) 颁发日期

    Returns:
        生成的证书文件的绝对路径
    """
    output_dir = _ensure_output_dir()
    return _generate_pdf(data, output_dir)


# ===================================================================
#  PDF 生成
# ===================================================================

def _generate_pdf(data: dict, output_dir: Path) -> str:
    """生成 PDF 证书

    优先使用 fpdf（无需外部依赖），不可用时尝试 weasyprint。
    """
    filename = _build_filename(data, "pdf")
    output_path = output_dir / filename

    try:
        _generate_pdf_fallback(data, output_path)
    except Exception:
        # fpdf 失败时尝试 weasyprint（需 GTK 库）
        from weasyprint import HTML
        html = _render_certificate_html(data)
        HTML(string=html).write_pdf(str(output_path))

    return str(output_path.resolve())


def _generate_pdf_fallback(data: dict, output_path: Path) -> None:
    """使用 fpdf 生成精美证书样式 PDF（无需 GTK）"""
    from fpdf import FPDF

    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.add_page()

    # ── 注册中文字体 ──
    _SIMHEI = r"C:\Windows\Fonts\simhei.ttf"
    if os.path.exists(_SIMHEI):
        pdf.add_font("SimHei", "", _SIMHEI, uni=True)
        pdf.add_font("SimHei", "B", _SIMHEI, uni=True)
        FONT_CN = "SimHei"
    else:
        FONT_CN = "Helvetica"

    # ── 深绿色外边框（粗） ──
    pdf.set_draw_color(26, 92, 42)
    pdf.set_line_width(2.5)
    pdf.rect(8, 8, 281, 194)

    # ── 浅绿色内边框 ──
    pdf.set_draw_color(45, 138, 78)
    pdf.set_line_width(1.2)
    pdf.rect(13, 13, 271, 184)

    # ── 金色边角装饰（四角 ┐┌ ┘└）──
    def _corner_tl(x, y):
        """左上角 ┌"""
        pdf.line(x, y + 16, x, y)
        pdf.line(x, y, x + 16, y)

    def _corner_tr(x, y):
        """右上角 ┐"""
        pdf.line(x - 16, y, x, y)
        pdf.line(x, y, x, y + 16)

    def _corner_bl(x, y):
        """左下角 └"""
        pdf.line(x, y - 16, x, y)
        pdf.line(x, y, x + 16, y)

    def _corner_br(x, y):
        """右下角 ┘"""
        pdf.line(x - 16, y, x, y)
        pdf.line(x, y - 16, x, y)

    pdf.set_draw_color(184, 134, 11)  # 金色
    pdf.set_line_width(2)
    _corner_tl(12, 12)
    _corner_tr(284, 12)
    _corner_bl(12, 189)
    _corner_br(284, 189)

    # ── 背景装饰 ──
    pdf.set_fill_color(248, 250, 245)  # 浅绿色背景
    pdf.rect(15, 15, 267, 180, "F")

    # ── 学校名称 ──
    pdf.set_xy(0, 28)
    pdf.set_font(FONT_CN, "B", 26)
    pdf.set_text_color(26, 92, 42)
    pdf.cell(297, 14, "培 英 中 學", align="C", new_x="LMARGIN", new_y="NEXT")

    # ── 装饰线 ──
    pdf.set_draw_color(45, 138, 78)
    pdf.set_line_width(0.5)
    y_line = 44
    pdf.line(50, y_line, 247, y_line)

    # ── 荣誉奖状 ──
    pdf.set_xy(0, 48)
    pdf.set_font(FONT_CN, "B", 32)
    pdf.set_text_color(184, 134, 11)  # 金色
    pdf.cell(297, 14, "榮 譽 獎 狀", align="C", new_x="LMARGIN", new_y="NEXT")

    # ── 学生姓名 ──
    pdf.ln(12)
    pdf.set_font(FONT_CN, "B", 40)
    pdf.set_text_color(26, 58, 92)  # 深蓝
    sn = data.get("student_name") or ""
    pdf.cell(297, 18, sn, align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font(FONT_CN, "", 14)
    pdf.set_text_color(85, 85, 85)
    sc = data.get("student_class") or ""
    pdf.ln(2)
    pdf.cell(297, 8, sc, align="C", new_x="LMARGIN", new_y="NEXT")

    # ── 正文 ──
    pdf.ln(8)
    pdf.set_font(FONT_CN, "", 14)
    pdf.set_text_color(51, 51, 51)
    ay = data.get("award_year") or ""
    at = data.get("award_title") or ""
    body = f"茲證明該同學在 {ay} 學年表現優異，榮獲 {at} 之殊榮。特頒此狀，以資鼓勵。"

    # 使用多行居中显示
    pdf.set_x(35)
    pdf.multi_cell(227, 9, body, align="C")

    # ── 底部信息（仅日期）──
    pdf.ln(18)
    pdf.set_font(FONT_CN, "", 10)
    pdf.set_text_color(102, 102, 102)
    idate = data.get("issue_date") or ""
    pdf.cell(297, 6, f"頒 發 日 期：{idate}", align="C")

    # ── 底部水印装饰文字 ──
    pdf.set_font(FONT_CN, "", 40)
    pdf.set_text_color(220, 230, 220)  # 极浅绿色水印
    pdf.set_xy(0, 140)
    pdf.cell(297, 20, "PUI YING SECONDARY SCHOOL", align="C")

    # ── 保存 ──
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))


def _render_certificate_html(data: dict) -> str:
    """生成证书 HTML（繁體字，橫向 A4，綠色邊框裝飾）"""
    sn = data["student_name"]
    sc = data["student_class"]
    ay = data["award_year"]
    at = data["award_title"]
    idate = data["issue_date"]

    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>榮譽獎狀</title>
<style>
  @page {{
    size: A4 landscape;
    margin: 0;
  }}
  * {{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }}
  body {{
    font-family: 'Microsoft JhengHei', 'Noto Sans TC', 'Source Han Sans TC', 'SimHei', sans-serif;
    width: 297mm;
    height: 210mm;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f7f0;
  }}
  .certificate {{
    width: 277mm;
    height: 190mm;
    background: #ffffff;
    position: relative;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    overflow: hidden;
  }}
  /* ===== 外邊框 ===== */
  .border-outer {{
    position: absolute;
    top: 6mm;
    left: 6mm;
    right: 6mm;
    bottom: 6mm;
    border: 3px solid #1a5c2a;
  }}
  /* ===== 內邊框（裝飾） ===== */
  .border-inner {{
    position: absolute;
    top: 10mm;
    left: 10mm;
    right: 10mm;
    bottom: 10mm;
    border: 1.5px solid #2d8a4e;
  }}
  /* ===== 四角裝飾 ===== */
  .corner {{
    position: absolute;
    width: 20mm;
    height: 20mm;
    border-color: #b8860b;
    border-style: solid;
  }}
  .corner-tl {{ top: 12mm; left: 12mm; border-width: 3px 0 0 3px; }}
  .corner-tr {{ top: 12mm; right: 12mm; border-width: 3px 3px 0 0; }}
  .corner-bl {{ bottom: 12mm; left: 12mm; border-width: 0 0 3px 3px; }}
  .corner-br {{ bottom: 12mm; right: 12mm; border-width: 0 3px 3px 0; }}

  /* ===== Header ===== */
  .header {{
    text-align: center;
    padding-top: 18mm;
  }}
  .school-name {{
    font-size: 22pt;
    color: #1a5c2a;
    letter-spacing: 6px;
    font-weight: bold;
  }}
  .header-line {{
    width: 60%;
    height: 2px;
    background: linear-gradient(to right, transparent, #2d8a4e, transparent);
    margin: 4mm auto;
  }}
  .award-title-label {{
    font-size: 36pt;
    color: #b8860b;
    font-weight: bold;
    letter-spacing: 4px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  }}

  /* ===== 學生姓名 ===== */
  .student-name-section {{
    text-align: center;
    margin: 8mm 0 6mm 0;
  }}
  .student-name {{
    font-size: 48pt;
    color: #1a3a5c;
    font-weight: bold;
    letter-spacing: 8px;
  }}
  .student-class {{
    font-size: 16pt;
    color: #555;
    margin-top: 2mm;
  }}

  /* ===== 正文 ===== */
  .body-text {{
    text-align: center;
    font-size: 16pt;
    line-height: 2;
    color: #333;
    padding: 0 20mm;
    margin-bottom: 6mm;
  }}
  .body-text .highlight {{
    color: #b8860b;
    font-weight: bold;
  }}

  /* ===== Footer ===== */
  .footer {{
    display: flex;
    justify-content: space-between;
    padding: 0 20mm;
    position: absolute;
    bottom: 18mm;
    left: 0;
    right: 0;
  }}
  .footer-item {{
    font-size: 11pt;
    color: #666;
  }}
  .footer-item strong {{
    color: #333;
  }}

  /* ===== 浮水印裝飾 ===== */
  .watermark {{
    position: absolute;
    bottom: 40mm;
    right: 15mm;
    font-size: 80pt;
    color: rgba(26, 92, 42, 0.04);
    font-weight: bold;
    transform: rotate(-15deg);
    pointer-events: none;
  }}
</style>
</head>
<body>
<div class="certificate">
  <div class="border-outer"></div>
  <div class="border-inner"></div>
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <div class="watermark">CERTIFICATE</div>

  <div class="header">
    <div class="school-name">培 英 中 學</div>
    <div class="header-line"></div>
    <div class="award-title-label">榮 譽 獎 狀</div>
  </div>

  <div class="student-name-section">
    <div class="student-name">{sn}</div>
    <div class="student-class">{sc}</div>
  </div>

  <div class="body-text">
    茲證明該同學在 <span class="highlight">{ay}</span> 學年表現優異，<br>
    榮獲 <span class="highlight">{at}</span> 之殊榮。<br>
    特頒此狀，以資鼓勵。
  </div>

  <div class="footer">
    <div class="footer-item"></div>
    <div class="footer-item"><strong>頒發日期</strong>：{idate}</div>
  </div>
</div>
</body>
</html>"""
