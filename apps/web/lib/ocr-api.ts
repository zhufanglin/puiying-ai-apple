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
    fields?: Record<string, unknown>;
    confidence?: string;
    warnings?: unknown[];
    raw_text?: string;
  } | null;
  error_message: string | null;
}

export interface ServerOcrResult {
  ocr: OcrResult;
  fileId: number | null;
  engine: "baidu_ocr" | "paddleocr" | "tesseract_js";
  structured?: ServerStructuredResult;
  fallbackReason?: string;
}

export interface ServerStructuredResult {
  fields: Record<string, unknown>;
  confidence?: string;
  warnings: string[];
  rawText: string;
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

function normalizeStructuredJob(job: OcrJob): ServerStructuredResult | undefined {
  const result = job.result_json;
  if (!result?.fields || typeof result.fields !== "object") return undefined;
  return {
    fields: result.fields,
    confidence: typeof result.confidence === "string" ? result.confidence : undefined,
    warnings: Array.isArray(result.warnings)
      ? result.warnings.filter((value): value is string => typeof value === "string")
      : [],
    rawText: typeof result.raw_text === "string"
      ? result.raw_text
      : job.result_text ?? "",
  };
}

async function recognizeWithBaidu(
  file: File,
  module: AppleModule,
  jobType: OcrJobType,
  onProgress?: (progress: number) => void,
): Promise<{ ocr: OcrResult; fileId: number; structured?: ServerStructuredResult }> {
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
        return {
          ocr: normalizeJob(job),
          fileId,
          structured: normalizeStructuredJob(job),
        };
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
async function recognizeWithPaddle(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<OcrResult> {
  onProgress?.(0.1);
  const form = new FormData();
  form.append("file", file);
  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const res = await fetch(`${BASE}/api/v1/ocr/recognize`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "PaddleOCR 后端不可用");
  }
  onProgress?.(0.9);
  const data = await res.json();
  return {
    text: data.text || "",
    confidence: data.confidence || 0,
    engine: "paddleocr",
    lines: (data.lines || []).map((l: { text: string; confidence: number }) => ({
      text: l.text,
      confidence: l.confidence,
    })),
  } as OcrResult;
}

export async function recognizeWithServerFallback(
  file: File,
  options: {
    module: AppleModule;
    jobType: OcrJobType;
    language?: string;
    onProgress?: (progress: number) => void;
    onStatus?: (status: string) => void;
  },
): Promise<ServerOcrResult> {
  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // 1) 优先使用后端 PaddleOCR（高性能本地引擎，无需 API key）
  options.onStatus?.("PaddleOCR 本地识别中...");
  try {
    options.onProgress?.(0.1);
    const ocr = await recognizeWithPaddle(file, options.onProgress);
    return { ocr, fileId: null, engine: "paddleocr" };
  } catch (_paddleError) {
    // PaddleOCR 不可用（Windows 上可能 Segfault），继续下一级
  }

  // 2) 百度 OCR 同步端点（无需 Redis/Celery，直连百度 API）
  options.onStatus?.("PaddleOCR 失败，改用百度 OCR 线上识别...");
  try {
    options.onProgress?.(0.1);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/v1/ocr/baidu-recognize`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "百度 OCR 不可用");
    }
    options.onProgress?.(0.9);
    const data = await res.json();
    return {
      ocr: {
        text: data.text || "",
        confidence: data.confidence || 0,
        engine: "baidu_ocr",
        lines: (Array.isArray(data.lines) ? data.lines : []).map(
          (l: { text: string; confidence: number }) => ({
            text: l.text,
            confidence: l.confidence,
          })
        ),
      } as OcrResult,
      fileId: null,
      engine: "baidu_ocr",
    };
  } catch (_baiduError) {
    // 百度 OCR 不可用（key 未配或网络不通），继续兜底
  }

  // 3) 最后兜底浏览器 Tesseract.js（离线，精度最低）
  options.onStatus?.("PaddleOCR 和百度 OCR 均失败，改用浏览器 Tesseract 离线识别...");
  options.onProgress?.(0);
  const ocr = await recognizeImage(file, {
    language: options.language,
    onProgress: options.onProgress,
  });
  return {
    ocr,
    fileId: null,
    engine: "tesseract_js",
    fallbackReason: "PaddleOCR 和百度 OCR 均不可用，已回退浏览器引擎",
  };
}
