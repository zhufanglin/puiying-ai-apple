"""FastAPI 应用入口"""
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()  # 加载 .env 到 os.environ（OCR 配置依赖此步骤）

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging import setup_logging

settings = get_settings()
setup_logging()


# ============== 生命周期 ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动/关闭钩子"""
    # 启动时：数据库引擎已由 db/session.py 创建
    yield
    # 关闭时：清理资源
    from app.db.session import engine
    await engine.dispose()


# ============== 应用实例 ==============

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# ---- CORS（开发期全开，生产收紧）----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== 注册路由 ==============

@app.get(f"{settings.API_PREFIX}/health", tags=["系统"])
async def health_check():
    """健康检查（docker-compose depends_on 用）"""
    return {"status": "ok", "app": settings.APP_NAME}


# ---- 认证路由（底座自带）----
from app.modules.accounts.router import router as auth_router
app.include_router(auth_router, prefix=settings.API_PREFIX)

# ---- 各模块路由（同学写完后在这里加一行）----

from app.modules.apple.awards.router import router as awards_router
from app.modules.apple.finance.router import router as finance_router
from app.modules.apple.assets.router import router as assets_router
from app.modules.apple.students.router import router as students_router
# 新模块：确保模型注册到 Base.metadata
from app.modules.apple.notifications import models as _notification_models
from app.modules.apple.notifications.router import router as notifications_router
from app.modules.apple.notifications.webhook import router as webhook_router
from app.modules.apple.scores import models as _score_models
from app.modules.apple.scores.router import router as scores_router
from app.modules.files.router import router as files_router
from app.modules.ocr.router import router as ocr_router

app.include_router(awards_router, prefix=f"{settings.API_PREFIX}/apple/awards", tags=["Apple-奖状奖学金"])
app.include_router(finance_router, prefix=f"{settings.API_PREFIX}/apple/finance", tags=["Apple-财务收支"])
app.include_router(assets_router, prefix=f"{settings.API_PREFIX}/apple/assets", tags=["Apple-资产盘点"])
app.include_router(students_router, prefix=f"{settings.API_PREFIX}/apple/students", tags=["Apple-学生事务"])
app.include_router(notifications_router, prefix=settings.API_PREFIX, tags=["Apple-通告通知"])
app.include_router(webhook_router, prefix=settings.API_PREFIX, tags=["Apple-WhatsApp Webhook"])
app.include_router(scores_router, prefix=f"{settings.API_PREFIX}/apple/scores", tags=["Apple-成績評語"])
app.include_router(files_router, prefix=f"{settings.API_PREFIX}/files", tags=["文件管理"])
app.include_router(ocr_router, prefix=f"{settings.API_PREFIX}/ocr", tags=["OCR 任务"])


# ============== 全局异常处理 ==============

from fastapi import Request
from fastapi.responses import JSONResponse
from app.common.errors import AppError


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"code": 50001, "message": f"服务器内部错误: {str(exc)}", "data": None},
    )
