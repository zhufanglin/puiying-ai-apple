from __future__ import annotations

from typing import Any

from workers.ocr_worker.handlers import CertificateHandler, DocumentHandler, ReceiptHandler
from workers.ocr_worker.job_store import OcrJobStore, now_iso
from workers.ocr_worker.main import celery_app
from workers.ocr_worker.services import OcrEngine


HANDLERS = {
    "ocr.extract_receipt": ReceiptHandler,
    "ocr.extract_certificate": CertificateHandler,
    "ocr.extract_document": DocumentHandler,
}


def process_ocr_job_sync(job_id: str, *, store: OcrJobStore | None = None, engine: OcrEngine | None = None) -> dict[str, Any]:
    job_store = store or OcrJobStore()
    state = job_store.read()
    job = job_store.get_job(state, job_id)
    if job["status"] not in {"pending", "failed"}:
        return job
    job.update({"status": "running", "startedAt": now_iso(), "error": None})
    job_store.audit(state, job, "ocr_job.started", {"jobType": job["jobType"]})
    job_store.write(state)
    try:
        state = job_store.read()
        job = job_store.get_job(state, job_id)
        source_path = job_store.source_path(state, job["sourceFileId"])
        ocr_result = (engine or OcrEngine()).extract(source_path)
        handler_type = HANDLERS.get(job["jobType"], DocumentHandler)
        structured = handler_type().process(ocr_result.text, ocr_result.confidence)
        job.update({
            "status": "needs_review",
            "ocr": {"text": ocr_result.text, "confidence": ocr_result.confidence, "engine": ocr_result.engine, "pages": ocr_result.pages, "warnings": ocr_result.warnings},
            "result": structured,
            "finishedAt": now_iso(),
            "humanReviewRequired": True,
        })
        job_store.audit(state, job, "ocr_job.needs_review", {"confidence": structured["confidence"], "engine": ocr_result.engine})
        job_store.write(state)
        return job
    except Exception as exc:
        state = job_store.read()
        job = job_store.get_job(state, job_id)
        job.update({"status": "failed", "error": str(exc), "finishedAt": now_iso()})
        job_store.audit(state, job, "ocr_job.failed", {"error": str(exc)})
        job_store.write(state)
        raise


@celery_app.task(name="ocr.process_job", autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def process_ocr_job(job_id: str) -> dict[str, Any]:
    return process_ocr_job_sync(job_id)

