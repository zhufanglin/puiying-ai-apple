"""A4 学生事务开发期文件存储。

此适配器只保存学生事务演示数据，不依赖或修改其他同学的业务模块。
正式环境可在不改变 Router 契约的情况下替换为 ``repository.py`` 的数据库实现。
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


STATE_KEYS = (
    "students",
    "attendanceRecords",
    "certificateRequests",
    "scoreRecords",
    "files",
    "artifacts",
    "auditLogs",
    "aiJobs",
)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


class StudentFileStore:
    """线程安全的 A4 JSON 存储及受控文件目录。"""

    def __init__(self, data_dir: str | Path | None = None) -> None:
        api_root = Path(__file__).resolve().parents[4]
        configured = data_dir or os.getenv("APPLE_STUDENTS_DATA_DIR") or os.getenv("APPLE_DATA_DIR")
        self.data_dir = Path(configured).resolve() if configured else api_root / "data"
        self.state_path = self.data_dir / "apple_students_state.json"
        self.upload_dir = self.data_dir / "uploads" / "students"
        self.generated_dir = self.data_dir / "generated" / "students"
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.generated_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        if not self.state_path.exists():
            self.state_path.parent.mkdir(parents=True, exist_ok=True)
            self.write({key: [] for key in STATE_KEYS})

    def read(self) -> dict[str, Any]:
        with self._lock:
            with self.state_path.open("r", encoding="utf-8") as handle:
                state = json.load(handle)
            for key in STATE_KEYS:
                state.setdefault(key, [])
            return deepcopy(state)

    def write(self, state: dict[str, Any]) -> None:
        with self._lock:
            self.state_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.state_path.with_suffix(".json.tmp")
            with temporary.open("w", encoding="utf-8") as handle:
                json.dump(state, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            os.replace(temporary, self.state_path)

    @staticmethod
    def new_id(prefix: str) -> str:
        return f"{prefix}-{uuid.uuid4().hex[:10]}"

    @staticmethod
    def hash_file(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def artifact_path(self, namespace: str, filename: str) -> Path:
        directory = self.generated_dir / Path(namespace).name
        directory.mkdir(parents=True, exist_ok=True)
        return directory / Path(filename).name

    def audit(
        self,
        state: dict[str, Any],
        event_type: str,
        entity_type: str,
        entity_id: str,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        event = {
            "id": self.new_id("audit"),
            "eventType": event_type,
            "entityType": entity_type,
            "entityId": entity_id,
            "actor": "Apple-A4",
            "details": details or {},
            "createdAt": now_iso(),
        }
        state["auditLogs"].append(event)
        return event


store = StudentFileStore()
