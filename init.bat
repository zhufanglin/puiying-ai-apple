@echo off
chcp 65001 > nul
title 培英中学 - 首次初始化
echo.
echo ============================================
echo   首次初始化脚本
echo ============================================
echo.

cd /d "%~dp0apps\api"

echo [1/4] 创建 Python 虚拟环境...
if not exist ".venv" py -m venv .venv

echo [2/4] 安装 Python 依赖（清华镜像加速）...
.venv\Scripts\pip install -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn fastapi uvicorn "sqlalchemy[asyncio]" aiosqlite alembic pydantic pydantic-settings "python-jose[cryptography]" "passlib[bcrypt]" python-multipart httpx python-docx docxtpl openpyxl pillow fpdf2 email-validator greenlet "bcrypt==4.2.1" reportlab

echo [3/4] 创建数据库表...
set DATABASE_URL=sqlite+aiosqlite:///./puiying_apple.db
.venv\Scripts\python -c "import asyncio; from app.db.base import Base; from app.db.session import engine; from app.modules.accounts.models import User, Role, Permission, RolePermission; from app.modules.files.models import File; from app.modules.ocr.models import OCRJob; from app.modules.ai.models import AIJob; from app.modules.audit.models import AuditLog; from app.modules.approvals.models import Approval; from app.modules.apple.finance.models import FinanceRecord, Quotation; from app.modules.apple.assets.models import Asset, AssetMovement; from app.modules.apple.awards.models import AwardTemplate, Award, AwardRecipient, ScholarshipApplication, ScholarshipReview; from app.modules.apple.students.models import Student, Attendance, CertificateRequest; async def m(): async with engine.begin() as c: await c.run_sync(Base.metadata.create_all); print('OK'); asyncio.run(m())"

echo [4/4] 导入演示数据...
set PYTHONIOENCODING=utf-8
.venv\Scripts\python scripts/seed_demo_data.py

echo.
echo ============================================
echo   初始化完成！运行 start.bat 启动项目
echo ============================================
pause
