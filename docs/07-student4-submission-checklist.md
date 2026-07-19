# 同学 4（A4 学生事务、AI Prompt、OCR Worker）提交清单

## 1. 必交源码

### 前端

- `apps/web/app/(dashboard)/dashboard/apple/students/page.tsx`
  - 学生总览、四张统计卡、学生照片、跨学生考勤 Excel 导入。
  - 考勤异常、成绩表待补领、在学证明待发下钻筛选。
  - 新增学生及照片上传。
- `apps/web/app/(dashboard)/dashboard/apple/students/[id]/page.tsx`
  - 基本资料、照片、考勤、成绩、证明申请四个 Tab。
  - 考勤／成绩／证明的搜索、分类和分页。
  - 成绩按学年、学期、科目导出。
- 配套文件：`apps/web/lib/students-api.ts`、`students/components.tsx`、`students/layout.tsx`、`students/students.css`；这些文件只服务 A4，不改动其他同学的前端 API。
- 测试 Excel：`apps/web/public/apple_attendance_import_test.xlsx`。

### 学生事务后端

提交整个 `apps/api/app/modules/apple/students/`：

- `router.py`：学生、待办、照片、考勤、成绩和证明 API。
- `schemas.py`：Pydantic 输入输出契约。
- `models.py`：`Student`、`Attendance`、`CertificateRequest` 三张正式 ORM 表。
- `repository.py`：当前文件存储适配器。
- `student_service.py`：CRUD、学生档案导入、统计和待办。
- `attendance_service.py`：单生／跨学生考勤 Excel 导入及异常识别。
- `score_service.py`：成绩筛选和 Excel 导出。
- `photo_service.py`：照片上传校验及读取。
- `certificate_service.py`：`docxtpl` 套表及 PDF 生成。
- `service.py`、`__init__.py`：模块导出。
- `tests/test_students.py`：学生模块单元测试。

同时提交：

- `apps/api/app/main.py`：挂载学生路由。
- `apps/api/app/modules/apple/students/file_store.py`：A4 专用文件适配器，不依赖其他业务模块。
- `apps/api/data/apple_students_state.json`：A4 演示数据结构；提交前确认不含真实学生资料。
- `apps/api/alembic/versions/20260717_01_add_students.py`：三张正式表、约束和索引。
- `apps/api/templates/apple/student_certificate.docx`：在学证明模板。
- `apps/api/templates/apple/build_student_certificate_template.py`：模板重建脚本。

## 2. 必交 AI Prompt

目录：`apps/api/app/modules/apple/prompts/`

- `award_extract_zh_hk.md`：奖项及获奖学生提取。
- `receipt_extract_zh_hk.md`：手写收据 OCR 文字结构化。
- `quotation_analyze_zh_hk.md`：单一报价及非最低价中选分析。
- `student_certificate_zh_hk.md`：中英在学证明正文候选。

每个 Prompt 应包含：角色、调用前提、输入契约、唯一 JSON 输出、字段规则、置信度标准、安全限制、自检和示例。

## 3. 必交 OCR Worker

提交整个 `workers/ocr_worker/`：

- `main.py`：Celery 入口。
- `tasks.py`：`process_ocr_job` 任务及状态流转。
- `job_store.py`：`aiJobs`、文件路径和审计写入。
- `cli.py`：单文件 OCR 冒烟测试。
- `.env.example`：环境变量示例，不含真实密钥。
- `services/ocr_engine.py`：Direct、百度 OCR、PaddleOCR、Tesseract 适配器。
- `handlers/receipt_handler.py`：收据结构化候选。
- `handlers/certificate_handler.py`：证明 OCR 候选。
- `handlers/document_handler.py`：通用文档候选。
- `handlers/prompt_loader.py`：Prompt 加载器。
- `tests/test_ocr_worker.py`：Worker 及模拟百度 HTTP 测试。
- `requirements.txt`、`requirements-paddle.txt`、`Dockerfile`。

部署配套：根目录 `docker-compose.yml` 中的 `redis` 与 `worker` 服务。

## 4. 必交文档

- `docs/05-module-students-ai.md`：学生事务与 Prompt 技术文档。
- `docs/06-ocr-worker.md`：OCR Worker、百度接入、部署和测试说明。
- `docs/07-student4-submission-checklist.md`：本提交清单。
- 根目录 `README.md`：项目启动、测试及目录结构。

## 5. 测试证据

提交前执行并保存终端截图或文字结果：

```bash
cd apps/api
python -m unittest discover -s app/modules/apple/students/tests -p "test_*.py" -v
cd ../..
python -m unittest discover -s workers/ocr_worker/tests -p "test_*.py" -v

cd apps/web
npm run build
```

百度真实接口另做冒烟测试：

```powershell
$env:OCR_ENGINE="baidu"
$env:BAIDU_OCR_MODE="handwriting"
$env:BAIDU_OCR_API_KEY="你的API Key"
$env:BAIDU_OCR_SECRET_KEY="你的Secret Key"
python -m workers.ocr_worker.cli "C:\path\receipt.jpg" --engine baidu
```

验收时应展示：

1. 学生总览与详情页。
2. 批量考勤 Excel 成功导入及错误行提示。
3. 三类统计卡下钻筛选。
4. 学生照片上传和显示。
5. 成绩按学期或科目导出。
6. 在学证明申请及 PDF。
7. OCR 输出 `needs_review`，低信心字段不自动入库。
8. 四个 Prompt 的严格 JSON 和不编造规则。

## 6. 不应提交

- 百度 AK、Secret Key、access token 或任何大模型 API Key。
- 真实学生、家长、财务或收据资料。
- `node_modules/`、`.next/`、`__pycache__/`、`.pyc`。
- `apps/api/data/uploads/` 和 `apps/api/data/generated/` 中的运行期敏感文件。
- 本机绝对路径、临时日志、Redis 数据或 Celery 结果缓存。

提交前应搜索 `BAIDU_OCR_API_KEY`、`BAIDU_OCR_SECRET_KEY`、`access_token`，确认仓库只有变量名和占位值，没有真实凭证。
