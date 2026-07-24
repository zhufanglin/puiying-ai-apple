# 08 成績分析、AI 評語與 WhatsApp 模組

## 1. 模組概覽

本模組完成第二組成績評語 WhatsApp 交付：Excel 批量匯入、班級/個人成績統計、DeepSeek 繁體中文評語、教師審閱狀態機、WhatsApp 發送、逐名學生狀態追蹤，以及 `/dashboard/apple/scores` 前端工作流。後端由同學 4 负责，前端与架构收口由同学 1（Leader）负责。

## 2. 目錄結構

```text
apps/api/app/modules/apple/scores/
├── ai_service.py       # DeepSeek 調用、三次格式重試
├── models.py           # apple_scores / apple_score_comments
├── repository.py       # SQLAlchemy 查詢
├── router.py           # FastAPI 路由
├── schemas.py          # 請求、回應及狀態枚舉
├── service.py          # 匯入、統計、審閱、發送流程
└── tests/test_scores.py
apps/api/app/modules/apple/students/score_service.py  # Excel 解析與純統計算法
apps/api/app/modules/apple/prompts/score_comment_zh_hk.md
apps/web/app/(dashboard)/dashboard/apple/scores/page.tsx
apps/web/lib/services/scores.ts
apps/web/lib/types/scores.ts
```

## 3. 資料表

`apple_scores` 每筆代表一名學生在指定學年、學期、考試類型中的一科成績，唯一鍵為 `student_id + school_year + term + exam_type + subject`。資料庫限制分數不得小於零、滿分必須大於零且分數不得超過滿分。

`apple_score_comments` 每名學生每次考試最多一筆評語。`status` 是審閱流程：`pending → confirmed → sent`；`delivery_status` 是投遞流程：`not_sent / pending / sent / delivered / read / failed`。兩者分開可避免 WhatsApp 失敗時破壞教師已確認的內容。

執行遷移：

```bash
cd apps/api
alembic upgrade head
```

## 4. Excel 匯入格式

端點：`POST /api/v1/apple/scores/import?schoolYear=2025%2F26&term=上學期&examType=期末考`

只接受 `.xlsx`，上限 10MB。支援兩種表格：

```text
# 長表
學號 | 姓名 | 科目 | 成績 | 滿分

# 寬表；括號內可指定滿分，未指定則為 100
學號 | 姓名 | 中國語文(100) | 英文（100） | 數學(100)
```

學號不存在、姓名不符、分數越界或重複的儲存格會出現在 `errors`；其他合法資料仍會匯入。同一考試再次匯入會依唯一鍵更新，不會重複新增。

## 5. 統計規則

班級統計：`GET /api/v1/apple/scores/stats/class`，查詢參數為 `schoolYear`、`term`、`examType`、`className`，可選 `subject`。

個人統計：`GET /api/v1/apple/scores/stats/students/{student_id}`，查詢參數為 `schoolYear`、`term`、`examType`。

不同滿分先換算百分比。個人平均是各科百分比的算術平均；排名按平均百分比降序。分數段為 A（≥85）、B（70–84.99）、C（60–69.99）、D（<60），60 分或以上視為合格。

## 6. AI 評語生成

端點：`POST /api/v1/apple/scores/comments/generate`，DeepSeek Key 放在 `X-AI-API-Key` header，Key 只存在於該次請求及發往 DeepSeek 的 Authorization header，不記錄、不落庫。

```json
{
  "school_year": "2025/26",
  "term": "上學期",
  "exam_type": "期末考",
  "student_ids": ["stu-0000000001"],
  "model": "deepseek-chat"
}
```

輸入包含姓名、各科分數/滿分、科目班級平均、個人平均、排名及出勤摘要。模型必須輸出 80–120 字繁體中文 JSON；格式或字數不合格最多重試三次。單名學生失敗不會回滾其他學生的成功結果，成功評語初始為 `pending`。

## 7. 教師審閱流程

- `GET /comments`：依學年、學期、考試、狀態篩選。
- `PATCH /comments/{id}`：修改評語；已發送內容不可修改。
- `POST /comments/confirm`：傳入 `comment_ids` 批量確認。
- `GET /comments/status`：回傳審閱與投遞兩組計數。

只有 `confirmed` 評語可以首次發送。重新生成會清除舊審閱及投遞狀態，重新進入 `pending`。

## 8. WhatsApp 推送

端點：`POST /api/v1/apple/scores/comments/{exam_type}/send`。服務直接復用 `services/whatsapp_client.py`，並從 `apple_students.parent_phone` 取家長號碼。

```json
{
  "school_year": "2025/26",
  "term": "上學期",
  "exam_type": "期末考",
  "comment_ids": [1, 2],
  "resend": false
}
```

無電話、API 錯誤及成功的 message id 均逐名記錄在 `apple_score_comments`。預設不重發 `sent` 記錄；只有明確設置 `resend=true` 才重發。

## 9. 權限與安全

- 查詢及統計：`apple:students:read`
- 匯入、AI 生成、編輯及確認：`apple:students:write`
- WhatsApp 發送：`apple:notifications:send`

所有變更動作寫入既有 `audit_logs`。Prompt 不包含家長電話；日誌不得寫入 DeepSeek Key 或模型完整回覆。

## 10. 錯誤處理

- 422：檔案類型、Excel 結構、欄位或請求驗證失敗。
- 404：學生、成績或評語不存在。
- 409：嘗試修改已發送評語等非法狀態轉換。
- 502：DeepSeek Key、連線、限流或三次格式驗證失敗。

批量匯入與批量生成均回傳成功數、失敗數及逐項錯誤，便於前端展示和重試。

## 11. 測試

```bash
cd apps/api
python -m unittest app.modules.apple.scores.tests.test_scores -v
```

測試覆蓋長/寬表解析、部分失敗、重複資料、班級統計、個人排名、Prompt 約束、DeepSeek 重試與 Key 隔離、ORM 唯一鍵、狀態 schema 及路由註冊。

## 12. 前端工作流

入口：`/dashboard/apple/scores`

页面包含三个主要视图：

- 成绩导入：选择学年、学期、考试类型、班级和 `.xlsx` 文件，并调用导入接口。
- 成绩统计：展示班级平均、分数段、科目平均和排名。
- 评语审阅：展示 AI 评语、状态计数、单条编辑、批量确认和 WhatsApp 推送。

前端统一通过 `apps/web/lib/services/scores.ts` 调用 `/api/v1/apple/scores/*`，类型定义集中在 `apps/web/lib/types/scores.ts`。页面已加入左侧导航和 Apple 总览快捷入口。

## 13. 聯調清單

1. 執行 Alembic migration。
2. 用長表及寬表各匯入一次，核對成功與錯誤數。
3. 核對班級平均、排名與分數段。
4. 以測試 DeepSeek Key 生成評語，確認均為繁體中文 80–120 字。
5. 編輯並批量確認評語。
6. 先以 `WHATSAPP_MOCK_MODE=true` 發送，再核對狀態統計。
7. 生產發送前配置 `WHATSAPP_PHONE_NUMBER_ID`、`WHATSAPP_ACCESS_TOKEN` 並以少量家長號碼驗證。
