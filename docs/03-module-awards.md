# 獎狀獎學金模組 (A1)

## 業務說明

本模組負責培英中學的**獎狀發放**與**獎學金申請審批**業務，涵蓋從模板管理、批量頒發、證書編號生成到獎學金評審的全流程。

### 核心功能

| 功能 | 說明 |
|------|------|
| 獎狀模板管理 | 定義獎狀類型（三好學生、優秀班幹部等）、分類（學業/品德/活動/其他） |
| 獎狀頒發 | 一次頒獎活動可包含多名獲獎學生，自動生成證書編號 |
| 狀態流轉 | draft → published → cancelled |
| 獲獎學生管理 | 批量新增、刪除獲獎學生記錄 |
| 獎學金申請 | 學生提交申請，含金額、類別、學年學期 |
| 獎學金審批 | 管理員審核（approved / rejected），審計追蹤 |
| 綜合統計 | 獎狀數量、獎學金申請統計 |

---

## 技術架構

### 後端

- **框架**: FastAPI (Python 3.12+)
- **資料庫**: SQLite（開發）/ PostgreSQL（生產），透過 SQLAlchemy 2.0 Async ORM
- **架構模式**: Router → Service → Repository 三層分層

| 層級 | 檔案 | 職責 |
|------|------|------|
| 資料模型 | `models.py` | 5 個 ORM 模型，定義表結構與關聯 |
| Pydantic Schema | `schemas.py` | 請求/回應資料驗證，支援 `from_attributes` |
| 倉儲層 | `repository.py` | 封裝所有 SQLAlchemy 查詢操作 |
| 業務邏輯層 | `service.py` | 實作業務校驗、狀態機轉換 |
| API 路由 | `router.py` | 16 個 API 端點，掛載權限裝飾器 |
| 提示詞 | `prompts/` | AI 輔助提示詞（預留） |

### 數據模型（5 個）

| 模型 | 資料表 | 說明 |
|------|--------|------|
| `AwardTemplate` | `apple_award_templates` | 獎狀模板（三好學生等） |
| `Award` | `apple_awards` | 獎狀/頒獎活動主表 |
| `AwardRecipient` | `apple_award_recipients` | 獲獎學生關聯表 |
| `ScholarshipApplication` | `apple_scholarship_applications` | 獎學金申請 |
| `ScholarshipReview` | `apple_scholarship_reviews` | 審核記錄（審計） |

### 前端

- **框架**: React / Next.js
- **頁面數**: 7 個頁面（預計）

### 關聯圖

```
AwardTemplate (1) ──< (M) Award (1) ──< (M) AwardRecipient
                                                    |
ScholarshipApplication (1) ──< (M) ScholarshipReview
       |
       └── User (reviewer, M:1)
```

---

## 數據庫表結構

### apple_award_templates（獎狀模板）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | Integer (PK) | 主鍵 |
| name | String(100) | 模板名稱，如「三好學生」 |
| description | String(500) | 模板描述 |
| category | String(50) | 分類：學業 / 品德 / 活動 / 其他 |
| default_content | Text | 預設獎狀內容模板 |
| badge_style | String(200) | 徽章樣式/圖示 URL |
| is_active | Boolean | 是否啟用 |
| created_at | DateTime | 建立時間 |
| updated_at | DateTime | 更新時間 |

### apple_awards（獎狀主表）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | Integer (PK) | 主鍵 |
| template_id | Integer (FK) | 關聯模板 ID |
| title | String(200) | 獎狀標題 |
| issue_date | Date | 頒發日期 |
| issuer | String(100) | 頒發部門 |
| status | String(20) | 狀態：draft / published / cancelled |
| remark | Text | 備註 |
| total_recipients | Integer | 獲獎人數 |
| created_at | DateTime | 建立時間 |
| updated_at | DateTime | 更新時間 |

### apple_award_recipients（獲獎學生）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | Integer (PK) | 主鍵 |
| award_id | Integer (FK) | 關聯獎狀 ID |
| student_name | String(50) | 學生姓名 |
| student_class | String(50) | 班級 |
| student_grade | String(20) | 年級 |
| certificate_no | String(50) | 證書編號（唯一） |
| reason | Text | 獲獎原因 |
| rank | String(20) | 獲獎等級：一等獎 / 二等獎 / 三等獎 / 優秀獎 |
| created_at | DateTime | 建立時間 |
| updated_at | DateTime | 更新時間 |

### apple_scholarship_applications（獎學金申請）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | Integer (PK) | 主鍵 |
| student_name | String(50) | 學生姓名 |
| student_class | String(50) | 班級 |
| student_grade | String(20) | 年級 |
| scholarship_type | String(50) | 類型：學業優秀 / 品德風尚 / 科技競賽 / 體藝特長 / 助學金 |
| academic_year | String(20) | 學年，如 2025-2026 |
| semester | String(10) | 學期：上 / 下 |
| application_date | Date | 申請日期 |
| status | String(20) | 狀態：pending / approved / rejected |
| amount | Numeric(10,2) | 申請金額（HKD） |
| reason | Text | 申請理由 |
| remark | Text | 備註 |
| reviewer_id | Integer (FK) | 審核人 ID |
| review_comment | Text | 審核意見 |
| review_date | DateTime | 審核日期 |
| created_at | DateTime | 建立時間 |
| updated_at | DateTime | 更新時間 |

### apple_scholarship_reviews（審核記錄）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | Integer (PK) | 主鍵 |
| application_id | Integer (FK) | 關聯申請 ID |
| reviewer_id | Integer (FK) | 審核人 ID |
| review_status | String(20) | 審核結果：approved / rejected |
| review_comment | Text | 審核意見 |
| review_date | DateTime | 審核日期 |
| created_at | DateTime | 建立時間 |
| updated_at | DateTime | 更新時間 |

### ER 圖（文字描述）

```
apple_award_templates
       │ 1
       │
       │ M
apple_awards ───── M ──── apple_award_recipients
  │
  │ (無直接關聯)
  │
apple_scholarship_applications ── M ── apple_scholarship_reviews
       │
       │ M:1
       users (reviewer)
```

---

## API 接口清單

所有端點前綴：`/api/v1/apple/awards`

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/statistics` | 獲取綜合統計 | `AWARDS_READ` |
| GET | `/templates` | 查詢獎狀模板列表（分頁） | `AWARDS_READ` |
| GET | `/templates/{id}` | 獲取單個獎狀模板 | `AWARDS_READ` |
| POST | `/templates` | 創建獎狀模板 | `AWARDS_WRITE` |
| PUT | `/templates/{id}` | 更新獎狀模板 | `AWARDS_WRITE` |
| DELETE | `/templates/{id}` | 刪除獎狀模板 | `AWARDS_DELETE` |
| GET | `` | 查詢獎狀列表（分頁） | `AWARDS_READ` |
| GET | `/{id}` | 獲取單個獎狀詳情（含模板+學生） | `AWARDS_READ` |
| POST | `` | 創建獎狀（可同時添加獲獎學生） | `AWARDS_WRITE` |
| PUT | `/{id}` | 更新獎狀基本信息 | `AWARDS_WRITE` |
| DELETE | `/{id}` | 刪除獎狀（級聯刪除獲獎學生） | `AWARDS_DELETE` |
| POST | `/{id}/publish` | 發布獎狀（draft → published） | `AWARDS_WRITE` |
| POST | `/{id}/cancel` | 取消獎狀（→ cancelled） | `AWARDS_WRITE` |
| POST | `/{id}/recipients` | 批量添加獲獎學生 | `AWARDS_WRITE` |
| DELETE | `/recipients/{id}` | 刪除獲獎學生 | `AWARDS_DELETE` |
| GET | `/scholarships` | 查詢獎學金申請列表（分頁） | `AWARDS_READ` |
| GET | `/scholarships/{id}` | 獲取單個獎學金申請詳情 | `AWARDS_READ` |
| POST | `/scholarships` | 提交獎學金申請 | `AWARDS_WRITE` |
| POST | `/scholarships/{id}/review` | 審核獎學金申請（approve/reject） | `AWARDS_APPROVE` |

**共 19 個端點**（含統計 1 個、模板 6 個、獎狀 7 個、獲獎學生 2 個、獎學金 3 個）。

### 回應格式

所有 API 統一回應格式：

```json
{
    "code": 0,
    "message": "ok",
    "data": { ... }
}
```

分頁回應：

```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "items": [...],
        "total": 100,
        "page": 1,
        "page_size": 20,
        "total_pages": 5
    }
}
```

---

## 前端路由清單

| 路由 | 頁面 | 說明 |
|------|------|------|
| `/apple/awards` | 獎狀列表頁 | 查詢、篩選、查看所有獎狀 |
| `/apple/awards/create` | 創建獎狀頁 | 選擇模板、填寫資訊、添加獲獎學生 |
| `/apple/awards/{id}` | 獎狀詳情頁 | 查看獎狀詳情、獲獎學生列表 |
| `/apple/awards/templates` | 模板管理頁 | 管理獎狀模板 |
| `/apple/awards/scholarships` | 獎學金申請列表 | 查詢所有申請 |
| `/apple/awards/scholarships/create` | 提交申請頁 | 填寫獎學金申請表 |
| `/apple/awards/scholarships/{id}` | 申請詳情/審批頁 | 查看詳情、進行審批操作 |

---

## 證書生成

本模組支援兩種證書生成方式：

### DOCX 生成

- 使用 **python-docx** 與 **docxtpl** 函式庫
- 基於 Word 模板（`.docx`），使用 Jinja2 模板語法填入變數
- 支援批次生成多份證書

### PDF 生成

- 使用 **WeasyPrint**（HTML → PDF）
- 先渲染 HTML 模板，再轉換為 PDF
- 支援自訂 CSS 樣式、頁面大小

### 證書編號規則

```
{前綴}-{年份}-{序號:04d}
```

例如：`MDL-2025-0001`（三好學生）

---

## 開發注意事項

1. **狀態機限制**：獎狀僅允許 `draft → published` 及 `*/published → cancelled`，不可逆向操作。獎學金申請僅 `pending → approved/rejected`，不可重複審核。

2. **權限檢查**：所有端點皆透過 `require_permission()` 裝飾器檢查權限，使用 `Permissions` 類別中的常量避免拼寫錯誤。

3. **級聯刪除**：刪除獎狀時會級聯刪除關聯的獲獎學生記錄（`cascade="all, delete-orphan"`）。

4. **唯一約束**：`AwardRecipient.certificate_no` 設有 `unique=True`，生成時需確保不重複。

5. **獲獎人數同步**：添加/刪除獲獎學生時，Repository 層會自動更新 `Award.total_recipients` 計數。

6. **SQLite 注意事項**：SQLite 不支援 `ALTER TABLE ... ADD CONSTRAINT`，若需修改表結構請使用 Alembic migration。

7. **日期處理**：`issue_date` 無傳入值時預設為當日日期（`date.today()`）。

8. **審計追蹤**：`ScholarshipReview` 表記錄每筆審核操作的審核人、時間、結果，不可修改或刪除。

---

## 測試

- 測試檔案：`apps/api/app/modules/apple/awards/tests/test_awards.py`
- 使用 `pytest` + `fastapi.testclient.TestClient`
- 測試前需確保已執行 `seed_demo_data.py` 初始化種子數據

```bash
# 在 apps/api 目錄下執行
python -m pytest app/modules/apple/awards/tests/test_awards.py -v
```

---

## 種子數據

- 基礎種子：`apps/api/scripts/seed_demo_data.py`（角色、權限、管理員、獎狀模板）
- 示範數據：`apps/api/scripts/seed_awards_demo.py`（3 個獎狀、50 名學生、3 筆獎學金申請）
