from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


class OcrJobStore:
    def __init__(self, data_dir: str | Path | None = None) -> None:
        default = Path(__file__).resolve().parents[2] / "apps" / "api" / "data"
        configured = data_dir or os.getenv("APPLE_STUDENTS_DATA_DIR") or os.getenv("APPLE_DATA_DIR", default)
        self.data_dir = Path(configured).resolve()
        self.state_path = self.data_dir / "apple_students_state.json"

    def read(self) -> dict[str, Any]:
        state = json.loads(self.state_path.read_text(encoding="utf-8"))
        state.setdefault("aiJobs", [])
        state.setdefault("auditLogs", [])
        return state

    def write(self, state: dict[str, Any]) -> None:
        temporary = self.state_path.with_suffix(".ocr.tmp")
        temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.state_path)

    def get_job(self, state: dict[str, Any], job_id: str) -> dict[str, Any]:
        job = next((row for row in state["aiJobs"] if row["id"] == job_id), None)
        if not job:
            raise LookupError(f"OCR 任务不存在：{job_id}")
        return job

    def source_path(self, state: dict[str, Any], source_file_id: str) -> Path:
        rows = list(state.get("files", [])) + list(state.get("sources", []))
        source = next((row for row in rows if row["id"] == source_file_id), None)
        if not source:
            raise FileNotFoundError(f"来源文件记录不存在：{source_file_id}")
        path = Path(source["path"])
        if not path.is_absolute():
            path = self.data_dir / path
        return path.resolve()

    def audit(self, state: dict[str, Any], job: dict[str, Any], action: str, detail: dict[str, Any] | None = None) -> None:
        state["auditLogs"].insert(0, {"id": f"audit-ocr-{job['id']}-{len(state['auditLogs'])}", "timestamp": now_iso(), "actor": "ocr_worker", "action": action, "resourceType": "ai_job", "resourceId": job["id"], "detail": detail or {}})
