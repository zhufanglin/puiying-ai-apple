"""奖状 & 奖学金 — API 路由

路由前缀：/api/v1/apple/awards
注册位置：apps/api/app/main.py

测试用例示例（使用 httpie / curl）:
--------------------
# 1. 登录获取 token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. 创建奖状模板
curl -X POST http://localhost:8000/api/v1/apple/awards/templates \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"三好学生","category":"学业","description":"德智体美劳全面发展"}'

# 3. 创建奖状（带获奖学生）
curl -X POST http://localhost:8000/api/v1/apple/awards \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": 1,
    "title": "2025学年三好学生表彰",
    "issuer": "德育处",
    "recipients": [
      {"student_name":"张三","student_class":"中五甲班","rank":"一等奖"},
      {"student_name":"李四","student_class":"中五乙班","rank":"二等奖"}
    ]
  }'

# 4. 查询奖状列表
curl -X GET "http://localhost:8000/api/v1/apple/awards?page=1&page_size=10" \
  -H "Authorization: Bearer <TOKEN>"

# 5. 提交奖学金申请
curl -X POST http://localhost:8000/api/v1/apple/awards/scholarships \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "student_name":"王五","student_class":"中六甲班",
    "scholarship_type":"学业优秀","academic_year":"2025-2026",
    "semester":"上","amount": 5000.00,
    "reason":"全年成绩排名年级前10%"
  }'

# 6. 审核奖学金
curl -X POST http://localhost:8000/api/v1/apple/awards/scholarships/1/review \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved","review_comment":"符合条件，批准"}'
"""
import hashlib
import io
import os
import time
import uuid
import zipfile
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, Response
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.pagination import PageParams
from app.common.schemas import APIResponse, PaginatedData
from app.common.errors import raise_error, NOT_FOUND
from app.core.security import get_current_user
from app.core.permissions import require_permission, Permissions
from app.db.session import get_db
from app.modules.accounts.models import User
from app.modules.apple.awards import repository as repo
from app.modules.apple.awards import service as svc
from app.modules.apple.awards.schemas import (
    # 模板
    AwardTemplateCreate, AwardTemplateUpdate, AwardTemplateQuery, AwardTemplateOut,
    # 奖状
    AwardCreate, AwardUpdate, AwardQuery, AwardOut, AwardListItem,
    AwardRecipientCreate, AwardRecipientOut,
    # 奖学金
    ScholarshipApplicationCreate, ScholarshipApplicationQuery,
    ScholarshipReviewCreate, ScholarshipApplicationOut,
    ScholarshipStatistics, AwardStatistics,
    # 证书批量生成
    BatchGenerateRecipient, BatchGenerateRequest,
    BatchGenerateFileInfo, BatchGenerateData,
    # 批量导出
    BatchExportRequest, BatchDeleteRequest,
    # 奖学金核算 & 读稿 & 证书
    CalculateRequest, CalculateResult,
    ScriptQueryParams, ScriptOut,
    CertificateRequest,
)
from app.modules.apple.awards.services.certificate_service import generate_certificate

router = APIRouter()


# ==================== 统计 ====================

@router.get("/statistics", response_model=APIResponse[dict])
async def get_statistics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """获取综合统计（奖状 + 奖学金）"""
    data = await svc.get_statistics(db)
    return APIResponse(data=data)


# ==================== 奖状模板 CRUD ====================

@router.get("/templates", response_model=APIResponse[PaginatedData[AwardTemplateOut]])
async def list_templates(
    query: AwardTemplateQuery = Depends(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """查询奖状模板列表（分页）"""
    items, total, page, page_size, total_pages = await svc.query_templates(
        db, query.name, query.category, query.is_active,
        query.page, query.page_size,
    )
    return APIResponse(data=PaginatedData(
        items=[AwardTemplateOut.model_validate(t) for t in items],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.get("/templates/{template_id}", response_model=APIResponse[AwardTemplateOut])
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """获取单个奖状模板"""
    obj = await svc.get_template(db, template_id)
    return APIResponse(data=AwardTemplateOut.model_validate(obj))


@router.post("/templates", response_model=APIResponse[AwardTemplateOut])
async def create_template(
    body: AwardTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """创建奖状模板"""
    obj = await svc.create_template(db, body.model_dump())
    return APIResponse(data=AwardTemplateOut.model_validate(obj))


@router.put("/templates/{template_id}", response_model=APIResponse[AwardTemplateOut])
async def update_template(
    template_id: int,
    body: AwardTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """更新奖状模板"""
    obj = await svc.update_template(db, template_id, body.model_dump())
    return APIResponse(data=AwardTemplateOut.model_validate(obj))


@router.delete("/templates/{template_id}", response_model=APIResponse)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_DELETE)),
):
    """删除奖状模板"""
    result = await svc.delete_template(db, template_id)
    return APIResponse(data=result)


# ==================== 奖学金申请 ====================
# 奖学金路由必须放在 /{award_id} 动态路由之前，避免 "scholarships" 被捕获为 award_id

@router.get("/scholarships", response_model=APIResponse[PaginatedData[ScholarshipApplicationOut]])
async def list_scholarships(
    query: ScholarshipApplicationQuery = Depends(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """查询奖学金申请列表（分页）"""
    items, total, page, page_size, total_pages = await svc.query_scholarship_applications(
        db, query.student_name, query.scholarship_type,
        query.status, query.academic_year,
        query.page, query.page_size,
    )
    return APIResponse(data=PaginatedData(
        items=[ScholarshipApplicationOut.model_validate(a) for a in items],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.get("/scholarships/{app_id}", response_model=APIResponse[ScholarshipApplicationOut])
async def get_scholarship(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """获取单个奖学金申请详情"""
    obj = await svc.get_scholarship_application(db, app_id)
    return APIResponse(data=ScholarshipApplicationOut.model_validate(obj))


@router.post("/scholarships", response_model=APIResponse[ScholarshipApplicationOut])
async def create_scholarship(
    body: ScholarshipApplicationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """提交奖学金申请"""
    obj = await svc.create_scholarship_application(db, body.model_dump())
    return APIResponse(data=ScholarshipApplicationOut.model_validate(obj))


@router.post("/scholarships/{app_id}/review", response_model=APIResponse[ScholarshipApplicationOut])
async def review_scholarship(
    app_id: int,
    body: ScholarshipReviewCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_APPROVE)),
):
    """审核奖学金申请（approve / reject）

    权限要求: apple:awards:approve
    业务规则: 仅待审核状态可操作
    """
    obj = await svc.review_scholarship(
        db, app_id, user.id, body.status, body.review_comment,
    )
    return APIResponse(data=ScholarshipApplicationOut.model_validate(obj))


# ==================== 奖状 CRUD ====================

@router.get("", response_model=APIResponse[PaginatedData[AwardListItem]])
async def list_awards(
    query: AwardQuery = Depends(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """查询奖状列表（分页）

    筛选条件：标题、模板、状态、日期范围
    """
    items, total, page, page_size, total_pages = await svc.query_awards(
        db, query.title, query.template_id, query.status,
        query.date_from, query.date_to,
        query.page, query.page_size,
    )
    return APIResponse(data=PaginatedData(
        items=[AwardListItem(
            id=a.id, title=a.title,
            template_name=a.template.name if a.template else None,
            template_category=a.template.category if a.template else None,
            issue_date=a.issue_date, issuer=a.issuer,
            amount=a.amount,
            status=a.status, total_recipients=a.total_recipients,
            created_at=a.created_at,
        ) for a in items],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    ))


@router.post("", response_model=APIResponse[AwardOut])
async def create_award(
    body: AwardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """创建奖状（可同时添加获奖学生）

    请求体示例见文件顶部测试说明
    """
    obj = await svc.create_award(db, body.model_dump())
    return APIResponse(data=AwardOut.model_validate(obj))


@router.get("/{award_id}", response_model=APIResponse[AwardOut])
async def get_award(
    award_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """获取单个奖状详情（含模板 + 获奖学生列表）"""
    obj = await svc.get_award(db, award_id)
    return APIResponse(data=AwardOut.model_validate(obj))


@router.put("/{award_id}", response_model=APIResponse[AwardOut])
async def update_award(
    award_id: int,
    body: AwardUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """更新奖状基本信息（不含获奖学生）"""
    obj = await svc.update_award(db, award_id, body.model_dump())
    return APIResponse(data=AwardOut.model_validate(obj))


@router.delete("/{award_id}", response_model=APIResponse)
async def delete_award(
    award_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_DELETE)),
):
    """删除奖状（级联删除获奖学生记录）"""
    result = await svc.delete_award(db, award_id)
    return APIResponse(data=result)


@router.post("/batch-delete", response_model=APIResponse)
async def batch_delete_awards(
    body: BatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_DELETE)),
):
    """批量删除奖状"""
    result = await svc.batch_delete_awards(db, body.ids)
    return APIResponse(data=result)


# ==================== 奖学金核算 ====================

@router.post("/{award_id}/calculate", response_model=APIResponse[CalculateResult])
async def calculate_award_scholarship(
    award_id: int,
    body: CalculateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """核算奖学金金额

    根据获奖学生的获奖等级，按规则计算每人应得奖学金金额。
    请求体可传入自定义规则（如 {"一等奖": 1000, "二等奖": 500}），
    不传则使用默认规则。
    """
    result = await svc.calculate_scholarship(db, award_id, body.rules)
    return APIResponse(data=result)


@router.post("/{award_id}/confirm", response_model=APIResponse[dict])
async def confirm_award_scholarship(
    award_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """确认奖学金核算结果

    将奖状状态从 calculated 改为 confirmed，表示核算已确认。
    """
    result = await svc.confirm_scholarship(db, award_id)
    return APIResponse(data=result)


# ==================== 读稿生成 ====================

@router.get("/{award_id}/script", response_model=APIResponse[ScriptOut])
async def generate_award_script(
    award_id: int,
    query: ScriptQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """生成颁奖读稿

    按指定方式排序（grade=按年级 / class=按班级 / student_no=按学号），
    为每位获奖学生生成读稿文本。
    """
    result = await svc.generate_script(db, award_id, query.group_by)
    return APIResponse(data=result)


# ==================== 批量证书生成（基于现有奖状） ====================

@router.post("/{award_id}/certificates", response_model=APIResponse[BatchGenerateData])
async def generate_award_certificates(
    award_id: int,
    body: CertificateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """为奖状中指定的获奖者批量生成 PDF 证书

    基于已存在的奖状，为选定的获奖学生生成证书文件。
    返回文件列表及下载令牌。
    """
    import os

    # 1. 校验奖状
    award = await repo.get_award(db, award_id)
    if not award:
        raise_error(*NOT_FOUND, detail={"award_id": award_id})

    # 2. 获取模板信息
    template = award.template
    template_name = template.name if template else award.title

    # 3. 获取指定获奖学生
    recipients = [r for r in award.recipients if r.id in body.recipient_ids]
    if not recipients:
        raise_error(404, "未找到指定获奖学生")

    issue_date_str = str(award.issue_date) if award.issue_date else ""

    # 4. 生成证书
    from app.modules.apple.awards.services.certificate_service import generate_certificate

    files = []
    for recipient in recipients:
        cert_data = {
            "student_name": recipient.student_name,
            "student_class": recipient.student_class,
            "award_year": issue_date_str[:4] if issue_date_str else "",
            "award_title": template_name,
            "issue_date": issue_date_str,
        }
        abs_path = generate_certificate(cert_data)
        filename = os.path.basename(abs_path)
        files.append(BatchGenerateFileInfo(
            student_name=recipient.student_name,
            file_path=filename,
        ))

    # 5. 生成下载令牌
    import hashlib, time, uuid
    download_token = hashlib.md5(
        f"{time.time()}{award_id}{uuid.uuid4()}".encode()
    ).hexdigest()[:16]

    return APIResponse(data=BatchGenerateData(
        files=files,
        download_token=download_token,
    ))


# ==================== 奖状状态操作 ====================

@router.post("/{award_id}/publish", response_model=APIResponse[AwardOut])
async def publish_award(
    award_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """确认奖状（草稿/已核算 -> 已确认）"""
    obj = await svc.publish_award(db, award_id)
    return APIResponse(data=AwardOut.model_validate(obj))


@router.post("/{award_id}/cancel", response_model=APIResponse[AwardOut])
async def cancel_award(
    award_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """取消奖状（任何状态 -> 已取消）"""
    obj = await svc.cancel_award(db, award_id)
    return APIResponse(data=AwardOut.model_validate(obj))


# ==================== 获奖学生 ====================

@router.post("/{award_id}/recipients", response_model=APIResponse[list[AwardRecipientOut]])
async def add_recipients(
    award_id: int,
    body: list[AwardRecipientCreate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """批量添加获奖学生"""
    objs = await svc.add_recipients(db, award_id, [r.model_dump() for r in body])
    return APIResponse(data=[AwardRecipientOut.model_validate(o) for o in objs])


@router.delete("/recipients/{recipient_id}", response_model=APIResponse)
async def remove_recipient(
    recipient_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_DELETE)),
):
    """删除获奖学生"""
    result = await svc.remove_recipient(db, recipient_id)
    return APIResponse(data=result)


# ==================== 证书批量生成 ====================

@router.post("/batch-generate", response_model=APIResponse[BatchGenerateData])
async def batch_generate(
    body: BatchGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_WRITE)),
):
    """批量生成证书

    1. 创建奖状记录并添加获奖学生
    2. 为每位学生生成 PDF 证书文件
    3. 返回文件列表及下载令牌
    """
    # 1. 校验模板
    template = await repo.get_template(db, body.template_id)
    if not template:
        raise_error(*NOT_FOUND, detail={"template_id": body.template_id})

    # 2. 创建奖状（已发布状态）
    parsed_date = date.fromisoformat(body.issue_date)
    award_data = {
        "template_id": body.template_id,
        "title": template.name,
        "issue_date": parsed_date,
        "issuer": None,
        "status": "confirmed",
        "total_recipients": len(body.recipients),
    }
    award = await repo.create_award(db, award_data)

    # 3. 创建获奖学生（含证书编号）
    recipients_data = []
    for r in body.recipients:
        cert_no = (
            f"CERT-{award.id}-"
            f"{body.issue_date.replace('-', '')}-"
            f"{uuid.uuid4().hex[:6].upper()}"
        )
        recipients_data.append({
            "student_name": r.student_name,
            "student_class": r.student_class,
            "certificate_no": cert_no,
        })
    recipients = await repo.add_recipients(db, award.id, recipients_data)
    await db.commit()

    # 4. 生成证书文件
    files = []
    for recipient in recipients:
        cert_data = {
            "student_name": recipient.student_name,
            "student_class": recipient.student_class,
            "award_year": body.award_year,
            "award_title": template.name,
            "issue_date": body.issue_date,
        }
        abs_path = generate_certificate(cert_data)
        # 返回相对路径（仅文件名），供下载端点使用
        filename = os.path.basename(abs_path)
        files.append(BatchGenerateFileInfo(
            student_name=recipient.student_name,
            file_path=filename,
        ))

    # 5. 生成下载令牌
    download_token = hashlib.md5(
        f"{time.time()}{award.id}".encode()
    ).hexdigest()[:16]

    return APIResponse(data=BatchGenerateData(
        files=files,
        download_token=download_token,
    ))


# ==================== 证书下载 ====================

@router.get("/download/{filename}")
async def download_certificate(
    filename: str,
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """下载已生成的证书文件"""
    # 限制路径穿越
    safe_name = Path(filename).name
    file_path = Path(__file__).parent / "templates" / "generated" / safe_name

    if not file_path.exists():
        raise_error(*NOT_FOUND, detail={"filename": filename})

    return FileResponse(
        path=str(file_path.resolve()),
        filename=safe_name,
        media_type="application/pdf",
    )


# ==================== 单个获奖者证书生成 ====================

@router.post("/{award_id}/recipients/{recipient_id}/certificate")
async def generate_recipient_certificate(
    award_id: int,
    recipient_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """为单个获奖者生成并下载 PDF 证书"""
    # 获取奖状
    award = await repo.get_award(db, award_id)
    if not award:
        raise_error(*NOT_FOUND, detail={"award_id": award_id})

    # 获取获奖者
    recipient = await repo.get_recipient(db, recipient_id)
    if not recipient or recipient.award_id != award_id:
        raise_error(*NOT_FOUND, detail={"recipient_id": recipient_id})

    template_name = award.template.name if award.template else award.title
    issue_date_str = str(award.issue_date) if award.issue_date else ""
    cert_data = {
        "student_name": recipient.student_name,
        "student_class": recipient.student_class,
        "award_year": issue_date_str[:4] if issue_date_str else "",
        "award_title": template_name,
        "issue_date": issue_date_str,
    }
    abs_path = generate_certificate(cert_data)

    filename = os.path.basename(abs_path)
    return FileResponse(
        path=abs_path,
        filename=filename,
        media_type="application/octet-stream",
    )


# ==================== 奖学金证书生成 ====================

@router.post("/scholarships/{app_id}/certificate")
async def generate_scholarship_certificate(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """为已通过的奖学金申请生成 PDF 证书

    - 仅 approved 状态可生成
    """
    app = await repo.get_scholarship_application(db, app_id)
    if not app:
        raise_error(*NOT_FOUND, detail={"app_id": app_id})
    if app.status != "approved":
        raise_error(400, "僅已通過的獎學金申請可生成證書")

    issue_date_str = str(app.review_date or app.application_date or "")
    cert_data = {
        "student_name": app.student_name,
        "student_class": app.student_class,
        "award_year": app.academic_year or "",
        "award_title": f"獎學金 - {app.scholarship_type}",
        "issue_date": issue_date_str,
        
    }
    abs_path = generate_certificate(cert_data)

    filename = os.path.basename(abs_path)
    return FileResponse(
        path=abs_path,
        filename=filename,
        media_type="application/pdf",
    )


# ==================== 批量导出证书 ZIP ====================

@router.post("/batch-export")
async def batch_export_certificates(
    body: BatchExportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """批量导出指定奖状的获奖者证书，打包为 ZIP 文件 (PDF)"""
    generated_dir = Path(__file__).parent / "templates" / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)

    buf = io.BytesIO()
    total = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for award_id in body.ids:
            award = await repo.get_award(db, award_id)
            if not award:
                continue

            template_name = award.template.name if award.template else award.title
            issue_date_str = str(award.issue_date) if award.issue_date else ""

            for recipient in award.recipients:
                cert_data = {
                    "student_name": recipient.student_name,
                    "student_class": recipient.student_class,
                    "award_year": issue_date_str[:4] if issue_date_str else "",
                    "award_title": template_name,
                    "issue_date": issue_date_str,
                }
                abs_path = generate_certificate(cert_data)
                folder = template_name.replace("/", "_")
                name_in_zip = (
                    f"{folder}/"
                    f"{recipient.student_name}_{recipient.student_class}"
                    f".pdf"
                )
                zf.write(abs_path, name_in_zip)
                total += 1

    buf.seek(0)

    if total == 0:
        raise_error(404, "沒有找到可導出的證書")

    return Response(
        content=buf.getvalue(),
        headers={"Content-Disposition": "attachment; filename=certificates.zip"},
        media_type="application/zip",
    )


@router.post("/scholarships/batch-export")
async def batch_export_scholarship_certificates(
    body: BatchExportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission(Permissions.AWARDS_READ)),
):
    """批量导出已通过的奖学金证书，打包为 ZIP 文件 (PDF)"""
    generated_dir = Path(__file__).parent / "templates" / "generated"
    generated_dir.mkdir(parents=True, exist_ok=True)

    buf = io.BytesIO()
    total = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for app_id in body.ids:
            app = await repo.get_scholarship_application(db, app_id)
            if not app or app.status != "approved":
                continue

            issue_date_str = str(app.review_date or app.application_date or "")
            cert_data = {
                "student_name": app.student_name,
                "student_class": app.student_class,
                "award_year": app.academic_year or "",
                "award_title": f"獎學金 - {app.scholarship_type}",
                "issue_date": issue_date_str,
            }
            abs_path = generate_certificate(cert_data)
            name_in_zip = (
                f"獎學金/{app.student_name}_{app.scholarship_type}"
                f".pdf"
            )
            zf.write(abs_path, name_in_zip)
            total += 1

    buf.seek(0)

    if total == 0:
        raise_error(404, "沒有找到可導出的證書")

    return Response(
        content=buf.getvalue(),
        headers={"Content-Disposition": "attachment; filename=scholarships.zip"},
        media_type="application/zip",
    )
