from __future__ import annotations

import json
import unittest
from io import BytesIO
from pathlib import Path

from openpyxl import Workbook
from pydantic import ValidationError

from app.modules.apple.scores.ai_service import generate_comment_with_ai, load_score_comment_prompt
from app.modules.apple.scores.models import Score, ScoreComment
from app.modules.apple.scores.schemas import GenerateCommentsRequest, ScoreCommentResponse
from app.modules.apple.students.score_service import calc_class_stats, calc_student_stats, parse_score_workbook


def workbook_bytes(headers: list[object], rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


class ScoreWorkbookTest(unittest.TestCase):
    def test_wide_workbook_parses_subject_full_marks(self) -> None:
        content = workbook_bytes(
            ["學號", "姓名", "數學(100)", "英文（50）"],
            [["s001", "陳同學", 88, 42]],
        )
        rows, errors = parse_score_workbook(content)
        self.assertEqual(errors, [])
        self.assertEqual([(row.student_no, row.subject, str(row.full_mark)) for row in rows], [
            ("S001", "數學", "100"),
            ("S001", "英文", "50"),
        ])

    def test_long_workbook_keeps_valid_rows_and_reports_invalid_rows(self) -> None:
        content = workbook_bytes(
            ["學號", "科目", "成績", "滿分"],
            [["S001", "數學", 91, 100], ["S002", "英文", 60, 50], ["", "中文", 80, 100]],
        )
        rows, errors = parse_score_workbook(content)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].subject, "數學")
        self.assertEqual(len(errors), 2)
        self.assertIn("0 至 50", errors[0]["message"])
        self.assertEqual(errors[1]["message"], "缺少學號")

    def test_duplicate_student_subject_is_rejected(self) -> None:
        content = workbook_bytes(
            ["學號", "科目", "成績"],
            [["S001", "數學", 80], ["s001", "數學", 90]],
        )
        rows, errors = parse_score_workbook(content)
        self.assertEqual(len(rows), 1)
        self.assertEqual(errors[0]["message"], "檔案內學號及科目重複")


class ScoreStatisticsTest(unittest.TestCase):
    records = [
        {"student_id": "s1", "subject": "數學", "score": 90, "full_mark": 100},
        {"student_id": "s1", "subject": "英文", "score": 40, "full_mark": 50},
        {"student_id": "s2", "subject": "數學", "score": 70, "full_mark": 100},
        {"student_id": "s2", "subject": "英文", "score": 30, "full_mark": 50},
        {"student_id": "s3", "subject": "數學", "score": 40, "full_mark": 100},
        {"student_id": "s3", "subject": "英文", "score": 20, "full_mark": 50},
    ]

    def test_class_statistics_calculates_distribution_and_pass_rate(self) -> None:
        result = calc_class_stats(self.records)
        self.assertEqual(result["student_count"], 3)
        self.assertEqual(result["highest"], 85.0)
        self.assertEqual(result["lowest"], 40.0)
        self.assertEqual(result["pass_rate"], 66.67)
        self.assertEqual(result["bands"], {"A": 1, "B": 0, "C": 1, "D": 1})

    def test_student_statistics_returns_rank_and_strengths(self) -> None:
        result = calc_student_stats(self.records, "s2")
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["rank"], 2)
        self.assertEqual(result["class_size"], 3)
        self.assertEqual(result["strongest_subject"], "數學")
        self.assertEqual(result["weakest_subject"], "英文")


class ScoreAITest(unittest.IsolatedAsyncioTestCase):
    async def test_ai_retries_invalid_json_and_does_not_put_key_in_payload(self) -> None:
        calls: list[tuple[dict, dict]] = []
        valid_comment = "學習表現穩定。" * 12

        async def transport(url: str, headers: dict, payload: dict, timeout: float) -> dict:
            del url, timeout
            calls.append((headers, payload))
            if len(calls) == 1:
                return {"choices": [{"message": {"content": "not-json"}}]}
            content = json.dumps({
                "comment_text": valid_comment,
                "highlight_subject": "數學",
                "improve_subject": "英文",
                "suggestion": "每週整理錯題。",
            }, ensure_ascii=False)
            return {"choices": [{"message": {"content": content}}]}

        secret = "unit-test-secret-key"
        result = await generate_comment_with_ai(
            {"student_name": "陳同學", "subjects": []},
            secret,
            "deepseek-chat",
            transport=transport,
        )
        self.assertEqual(len(calls), 2)
        self.assertEqual(result["highlight_subject"], "數學")
        self.assertNotIn(secret, json.dumps(calls[0][1], ensure_ascii=False))
        self.assertEqual(calls[0][0]["Authorization"], f"Bearer {secret}")

    def test_prompt_contains_required_guardrails(self) -> None:
        prompt = load_score_comment_prompt()
        self.assertIn("80–120", prompt)
        self.assertIn("繁體中文", prompt)
        self.assertIn("不可杜撰", prompt)


class ScoreContractTest(unittest.TestCase):
    def test_orm_tables_and_unique_constraints(self) -> None:
        self.assertEqual(Score.__tablename__, "apple_scores")
        self.assertEqual(ScoreComment.__tablename__, "apple_score_comments")
        score_constraint_names = {constraint.name for constraint in Score.__table__.constraints}
        comment_constraint_names = {constraint.name for constraint in ScoreComment.__table__.constraints}
        self.assertIn("uq_apple_scores_student_exam_subject", score_constraint_names)
        self.assertIn("uq_apple_score_comments_student_exam", comment_constraint_names)

    def test_generation_schema_rejects_non_deepseek_models(self) -> None:
        with self.assertRaises(ValidationError):
            GenerateCommentsRequest(
                school_year="2025/26",
                term="上學期",
                exam_type="期末考",
                model="other-model",
            )

    def test_comment_response_validates_status_machine(self) -> None:
        with self.assertRaises(ValidationError):
            ScoreCommentResponse(
                id=1,
                student_id="s1",
                school_year="2025/26",
                term="上學期",
                exam_type="期末考",
                comment_text="測試",
                status="draft",
                delivery_status="not_sent",
            )

    def test_score_routes_are_registered_in_main_app(self) -> None:
        main_source = (Path(__file__).resolve().parents[4] / "main.py").read_text(encoding="utf-8")
        self.assertIn("from app.modules.apple.scores.router import router as scores_router", main_source)
        self.assertIn("app.include_router(scores_router", main_source)


if __name__ == "__main__":
    unittest.main()
