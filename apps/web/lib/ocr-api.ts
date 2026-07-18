"use client";

import { api } from "@/lib/api";
import { recognizeImage, type OcrResult } from "@/lib/ocr-engine";

type AppleModule = "awards" | "finance" | "assets" | "students";
type OcrJobType = "receipt" | "invoice" | "certificate" | "document";

interface UploadedFile {
  id: number;
}

interface OcrJob {
  id: number;
  status: "pending" | "processing" | "completed" | "failed";
  result_text: string | null;
  result_json: {
    ocr?: {
      raw_text?: string;
      confidence?: number;
      lines?: OcrResult["lines"];
      engine?: string;
    };
  } | null;
  error_message: string | null;
}

export interface ServerOcrResult {
  ocr: OcrResult;
  fileId: number | null;
  engine: "baidu_ocr" | "tesseract_js";
  fallbackReason?: string;
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

class ServerOcrError extends Error {
  constructor(message: string, readonly fileId: number | null) {
    super(message);
    this.name = "ServerOcrError";
  }
}

function normalizeJob(job: OcrJob): OcrResult {
  const raw = job.result_json?.ocr;
  const text = raw?.raw_text ?? job.result_text ?? "";
  const lines = Array.isArray(raw?.lines) && raw.lines.length > 0
    ? raw.lines
    : text.split(/\r?\n/).filter(Boolean).map((line) => ({
        text: line,
        confidence: Number(raw?.confidence ?? 0),
        bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
      }));
  return {
    text,
    confidence: Number(raw?.confidence ?? 0),
    lines,
  };
}

async function recognizeWithBaidu(
  file: File,
  module: AppleModule,
  jobType: OcrJobType,
  onProgress?: (progress: number) => void,
): Promise<{ ocr: OcrResult; fileId: number }> {
  onProgress?.(0.05);
  const form = new FormData();
  form.append("file", file);
  form.append("module", module);
  form.append("entity_type", jobType);
  const uploaded = await api.form<UploadedFile>("/files/upload", form);
  const fileId = uploaded.data.id;

  try {
    onProgress?.(0.15);
    const created = await api.post<OcrJob>("/ocr/jobs", {
      file_id: fileId,
      module,
      job_type: jobType,
    });
    let job = created.data;

    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (job.status === "completed") {
        onProgress?.(1);
        return { ocr: normalizeJob(job), fileId };
      }
      if (job.status === "failed") {
        throw new Error(job.error_message || "百度 OCR 任务失败");
      }
      onProgress?.(Math.min(0.9, 0.2 + attempt * 0.012));
      await sleep(1000);
      job = (await api.get<OcrJob>(`/ocr/jobs/${job.id}`)).data;
    }
    throw new Error("百度 OCR 等待超时");
  } catch (error) {
    const message = error instanceof Error ? error.message : "百度 OCR 任务失败";
    throw new ServerOcrError(message, fileId);
  }
}

/**
 * 优先使用后端百度 OCR；API、Redis、Worker 或百度服务不可用时，
 * 自动回退到浏览器 Tesseract.js，保证演示仍可继续。
 */
export async function recognizeWithServerFallback(
  file: File,
  options: {
    module: AppleModule;
    jobType: OcrJobType;
    language?: string;
    onProgress?: (progress: number) => void;
  },
): Promise<ServerOcrResult> {
  let fileId: number | null = null;
  try {
    const result = await recognizeWithBaidu(
      file,
      options.module,
      options.jobType,
      options.onProgress,
    );
    fileId = result.fileId;
    return { ...result, engine: "baidu_ocr" };
  } catch (error) {
    if (error instanceof ServerOcrError) fileId = error.fileId;
    const fallbackReason = error instanceof Error ? error.message : "百度 OCR 不可用";
    options.onProgress?.(0);
    const ocr = await recognizeImage(file, {
      language: options.language,
      onProgress: options.onProgress,
    });
    return { ocr, fileId, engine: "tesseract_js", fallbackReason };
  }
}
