from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from app.modules.apple.file_store import now_iso
from app.modules.apple.students.repository import StudentRepository


class StudentPhotoNotFoundError(LookupError):
    pass


class StudentPhotoService:
    MAX_BYTES = 5 * 1024 * 1024
    CONTENT_TYPES = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }

    def __init__(self, repository: StudentRepository | None = None) -> None:
        self.repository = repository or StudentRepository()
        self.directory = self.repository.storage.upload_dir / "student-photos"
        self.directory.mkdir(parents=True, exist_ok=True)

    def save(self, content: bytes, filename: str, content_type: str | None) -> dict[str, Any]:
        suffix = Path(filename).suffix.lower()
        expected_type = self.CONTENT_TYPES.get(suffix)
        if not expected_type:
            raise ValueError("学生照片只支持 JPG、PNG 或 WebP")
        if not content or len(content) > self.MAX_BYTES:
            raise ValueError("学生照片必须小于 5MB")
        if content_type and content_type.split(";")[0].lower() != expected_type:
            raise ValueError("照片文件类型与扩展名不一致")
        if not self._has_valid_signature(content, suffix):
            raise ValueError("照片文件内容无效")

        photo_id = self.repository.storage.new_id("student-photo")
        normalized_suffix = ".jpg" if suffix == ".jpeg" else suffix
        path = self.directory / f"{photo_id}{normalized_suffix}"
        path.write_bytes(content)
        state = self.repository.state()
        state["files"].append({
            "id": photo_id,
            "fileName": Path(filename).name,
            "fileType": expected_type,
            "path": str(path),
            "hash": self.repository.storage.hash_file(path),
            "status": "uploaded",
            "createdAt": now_iso(),
        })
        self.repository.storage.audit(state, "student.photo_uploaded", "file", photo_id, {"fileName": Path(filename).name})
        self.repository.save(state)
        return {
            "photoId": photo_id,
            "photoUrl": f"/api/v1/apple/students/photos/{photo_id}",
            "contentType": expected_type,
        }

    def get(self, photo_id: str) -> tuple[Path, str]:
        if not re.fullmatch(r"student-photo-[a-f0-9]{10}", photo_id):
            raise StudentPhotoNotFoundError(photo_id)
        matches = [path for path in self.directory.glob(f"{photo_id}.*") if path.suffix.lower() in self.CONTENT_TYPES]
        if not matches:
            raise StudentPhotoNotFoundError(photo_id)
        path = matches[0]
        return path, self.CONTENT_TYPES[path.suffix.lower()]

    @staticmethod
    def _has_valid_signature(content: bytes, suffix: str) -> bool:
        if suffix in {".jpg", ".jpeg"}:
            return content.startswith(b"\xff\xd8\xff")
        if suffix == ".png":
            return content.startswith(b"\x89PNG\r\n\x1a\n")
        if suffix == ".webp":
            return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
        return False
