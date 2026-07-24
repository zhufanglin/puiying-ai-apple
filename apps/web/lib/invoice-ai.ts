"use client";

import { api } from "@/lib/api";
import type { InvoiceResult } from "@/lib/invoice-parser";
import type { OcrResult } from "@/lib/ocr-engine";
import {
  DEFAULT_RECEIPT_AI_CONFIG,
  loadReceiptAIConfig,
  saveReceiptAIConfig,
  type ReceiptAIConfig,
} from "@/lib/receipt-ai";

/**
 * 發票與收據共用同一份分頁會話設定，讓使用者毋須重複輸入 Key。
 * Key 只會存入 sessionStorage，並只透過請求標頭傳送到後端。
 */
export type InvoiceAIConfig = ReceiptAIConfig;

export const DEFAULT_INVOICE_AI_CONFIG: InvoiceAIConfig = {
  ...DEFAULT_RECEIPT_AI_CONFIG,
};

export const loadInvoiceAIConfig = loadReceiptAIConfig;
export const saveInvoiceAIConfig = saveReceiptAIConfig;

interface InvoiceAIStructureResponse {
  fields: {
    asset_name: string | null;
    category: "IT設備" | "傢俱" | "電器" | "辦公設備" | "其他" | null;
    amount: number | null;
    currency: "HKD" | null;
    purchase_date: string | null;
    vendor: string | null;
    invoice_no: string | null;
    multiple_items: boolean;
  };
  confidence: "low" | "medium" | "high";
  warnings: string[];
  raw_text: string;
  provider: "deepseek";
  model: string;
}

export async function structureInvoiceWithAI(
  ocr: OcrResult,
  config: InvoiceAIConfig,
  options: {
    engine: "baidu_ocr" | "paddleocr" | "tesseract_js";
    fileId: number | null;
  },
): Promise<InvoiceResult> {
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new Error("請先輸入 DeepSeek API Key");

  const response = await api.postWithHeaders<InvoiceAIStructureResponse>(
    "/ocr/invoice/structure",
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
  const multipleItems = result.fields.multiple_items === true;
  const hasConfirmedHKD = result.fields.currency === "HKD";
  const inconsistentAmount = result.fields.amount !== null && !hasConfirmedHKD;
  const warnings = [...result.warnings];
  if (multipleItems && !warnings.some((warning) => warning.includes("單一資產"))) {
    warnings.unshift("發票包含多項貨品，或無法確認只有一項資產；請對照原圖逐項登記");
  }
  if (inconsistentAmount) {
    warnings.unshift("AI 未能確認貨幣為 HKD，未自動填寫金額");
  }

  return {
    // 多項發票不可安全地自動折疊為一筆資產，前端再做一次防線。
    assetName: multipleItems ? "" : (result.fields.asset_name ?? ""),
    category: multipleItems ? "" : (result.fields.category ?? ""),
    amount: multipleItems || !hasConfirmedHKD ? 0 : (result.fields.amount ?? 0),
    currency: multipleItems || !hasConfirmedHKD ? "" : "HKD",
    purchaseDate: result.fields.purchase_date ?? "",
    vendor: result.fields.vendor ?? "",
    invoiceNo: result.fields.invoice_no ?? "",
    multipleItems,
    confidence: multipleItems ? "low" : result.confidence,
    warnings,
    raw_text: result.raw_text,
  };
}
