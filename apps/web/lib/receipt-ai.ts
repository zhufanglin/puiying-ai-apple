"use client";

import { api } from "@/lib/api";
import type { OcrResult } from "@/lib/ocr-engine";
import type { ReceiptResult } from "@/lib/receipt-parser";

export type ReceiptAIMode = "deepseek" | "local";

export interface ReceiptAIConfig {
  mode: ReceiptAIMode;
  model: string;
  apiKey: string;
}

interface ReceiptAIResponse {
  fields: {
    amount: number | null;
    currency: "HKD" | null;
    date: string | null;
    payer: string | null;
    purpose: string | null;
  };
  confidence: "low" | "medium" | "high";
  warnings: string[];
  raw_text: string;
  provider: "deepseek";
  model: string;
}

const STORAGE_KEY = "apple.receiptAiConfig.v1";

export const DEFAULT_RECEIPT_AI_CONFIG: ReceiptAIConfig = {
  mode: "local",
  model: "deepseek-v4-flash",
  apiKey: "",
};

export function loadReceiptAIConfig(): ReceiptAIConfig {
  if (typeof window === "undefined") return { ...DEFAULT_RECEIPT_AI_CONFIG };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECEIPT_AI_CONFIG };
    const parsed = JSON.parse(raw) as Partial<ReceiptAIConfig>;
    return {
      mode: parsed.mode === "local" ? "local" : "deepseek",
      model: typeof parsed.model === "string" && parsed.model.startsWith("deepseek-")
        ? parsed.model
        : DEFAULT_RECEIPT_AI_CONFIG.model,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
    };
  } catch {
    return { ...DEFAULT_RECEIPT_AI_CONFIG };
  }
}

export function saveReceiptAIConfig(config: ReceiptAIConfig): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function structureReceiptWithAI(
  ocr: OcrResult,
  config: ReceiptAIConfig,
  options: {
    engine: "baidu_ocr" | "tesseract_js";
    fileId: number | null;
  },
): Promise<ReceiptResult> {
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new Error("请先输入 DeepSeek API Key");

  const response = await api.postWithHeaders<ReceiptAIResponse>(
    "/ocr/receipt/structure",
    {
      provider: "deepseek",
      model: config.model.trim(),
      source_file_id: options.fileId,
      ocr_engine: options.engine,
      ocr_text: ocr.text,
      ocr_confidence: ocr.confidence,
      page: 1,
      lines: ocr.lines
        .filter((line) => line.text.trim())
        .slice(0, 500)
        .map((line, index) => ({
          line_no: index + 1,
          text: line.text.trim(),
          confidence: Math.max(0, Math.min(100, Number(line.confidence) || 0)),
          bbox: line.bbox,
        })),
    },
    { "X-AI-API-Key": apiKey },
  );
  const result = response.data;
  return {
    fields: {
      amount: result.fields.amount,
      currency: result.fields.currency ?? "HKD",
      date: result.fields.date ?? "",
      payer: result.fields.payer ?? "",
      purpose: result.fields.purpose ?? "",
    },
    confidence: result.confidence,
    warnings: result.warnings,
    raw_text: result.raw_text,
  };
}
