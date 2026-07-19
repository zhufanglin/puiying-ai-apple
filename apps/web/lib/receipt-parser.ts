/**
 * 收據 OCR 文本解析器 — 對應 receipt_extract_zh_hk.md
 *
 * 多策略提取: 標籤匹配 → 逐行掃描 → 智能推斷
 *
 * 輸出: { fields: {amount,currency,date,payer,purpose}, confidence, warnings, raw_text }
 */

import type { OcrResult } from "./ocr-engine";

export interface ReceiptFields {
  amount: number | null;
  currency: string;
  date: string;
  payer: string;
  purpose: string;
}

export interface ReceiptResult {
  fields: ReceiptFields;
  confidence: "low" | "medium" | "high";
  warnings: string[];
  raw_text: string;
}

// ================================================================
// 標籤模式
// ================================================================

const LABEL_PATTERNS = {
  amount: [/HK\$\s*([\d,]+\.?\d*)/i, /HKD?\s*\$?\s*([\d,]+\.?\d*)/i, /港幣\s*\$?\s*([\d,]+\.?\d*)/, /金額[：:\s]*\$?\s*([\d,]+\.?\d*)/, /總額[：:\s]*\$?\s*([\d,]+\.?\d*)/, /合計[：:\s]*\$?\s*([\d,]+\.?\d*)/, /Total[：:\s]*\$?\s*([\d,]+\.?\d*)/i],
  date: [/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, /(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/, /(\d{1,2})\/(\d{1,2})\/(\d{4})/, /日期[：:\s]*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, /Date[：:\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i],
  payer: [/付款人[：:\s]*(.+)/, /經手人[：:\s]*(.+)/, /繳款人[：:\s]*(.+)/, /繳費人[：:\s]*(.+)/, /Payer[：:\s]*(.+)/i, /From[：:\s]*(.+)/i, /客户[：:\s]*(.+)/],
  purpose: [/用途[：:\s]*(.+)/, /項目[：:\s]*(.+)/, /事項[：:\s]*(.+)/, /Purpose[：:\s]*(.+)/i, /For[：:\s]*(.+)/i, /備註[：:\s]*(.+)/, /Remarks?[：:\s]*(.+)/i],
};

// ================================================================
// 逐行掃描工具
// ================================================================

function extractDateFromLine(line: string): string | null {
  let m = line.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = line.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  // 英文月份
  const monMap: Record<string, string> = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" };
  m = line.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
  if (m) return `${m[3]}-${monMap[m[2]!.toLowerCase()]}-${m[1]!.padStart(2, "0")}`;
  return null;
}

function extractAmountFromLine(line: string): number | null {
  // 優先匹配帶貨幣的
  let m = line.match(/HKD?\s*\$?\s*([\d,]+\.?\d*)/i);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  m = line.match(/HK\$\s*([\d,]+\.?\d*)/i);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  m = line.match(/港幣\s*\$?\s*([\d,]+\.?\d*)/);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  // $金額
  m = line.match(/\$\s*([\d,]+\.\d{2})/);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  // 純數字 ≥100
  m = line.match(/^(\d{3,})$/);
  if (m) return parseInt(m[1]!);
  return null;
}

function isNoise(line: string): boolean {
  if (!line.trim()) return true;
  if (/^(收據|Receipt|Invoice|Page|頁碼|QTY|Subtotal|Tax|No\.|Date:)$/i.test(line)) return true;
  return false;
}

function extractLabeled(line: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = line.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

// ================================================================
// 主解析函數
// ================================================================

export function parseReceipt(ocrResult: OcrResult): ReceiptResult {
  const rawText = ocrResult.text;
  const allLines = ocrResult.lines.map((l) => l.text).filter((l) => !isNoise(l));

  // ── 策略1: 標籤匹配 ──
  let payer = "";
  let purpose = "";
  for (const line of allLines) {
    const p = extractLabeled(line, LABEL_PATTERNS.payer);
    if (p && !payer) payer = p;
    const pu = extractLabeled(line, LABEL_PATTERNS.purpose);
    if (pu && !purpose) purpose = pu;
  }

  // ── 策略2: 逐行掃描日期/金額 ──
  let date = "";
  let amount: number | null = null;
  let amountSource = "";

  for (const line of allLines) {
    if (!date) {
      const d = extractDateFromLine(line);
      if (d) date = d;
    }
    const amt = extractAmountFromLine(line);
    if (amt !== null) {
      const hasCurrency = /HKD|HK\$|港幣|\$/i.test(line);
      if (hasCurrency && (!amountSource || !/HKD|HK\$|港幣|\$/i.test(amountSource))) {
        amount = amt;
        amountSource = line;
      } else if (!amountSource && amt >= 100) {
        amount = amt;
        amountSource = line;
      }
    }
  }

  // ── 策略3: 智能推斷剩餘字段 ──
  for (const line of allLines) {
    const t = line.trim();
    if (!t || extractDateFromLine(t) || extractAmountFromLine(t) !== null || isNoise(t)) continue;
    // 標籤值已處理，跳過標籤行
    if (LABEL_PATTERNS.payer.some((r) => r.test(t)) || LABEL_PATTERNS.purpose.some((r) => r.test(t))) continue;
    // 中等長度的文本行 → 可能是用途或付款人
    if (t.length >= 3 && t.length <= 200) {
      if (!purpose) purpose = t;
      else if (!payer) payer = t;
    }
  }

  // ── 組裝 ──
  const fields: ReceiptFields = {
    amount,
    currency: "HKD",
    date,
    payer,
    purpose,
  };

  const filled = [amount !== null, date !== "", payer !== "", purpose !== ""].filter(Boolean).length;
  let confidence: "low" | "medium" | "high";
  if (filled >= 3 && ocrResult.confidence >= 60) confidence = "high";
  else if (filled >= 2) confidence = "medium";
  else confidence = "low";

  const warnings: string[] = [];
  if (amount === null) warnings.push("未能識別金額，請手動填寫");
  if (!date) warnings.push("未能識別日期，請手動選擇");
  if (!payer) warnings.push("未能識別付款人");
  if (!purpose) warnings.push("未能識別用途，請手動填寫");
  if (ocrResult.confidence < 50) warnings.push("OCR 識別信心較低，請仔細核對所有欄位");
  if (ocrResult.confidence < 30) warnings.push("圖片可能模糊或字跡不清，建議重新拍照上傳");

  return { fields, confidence, warnings, raw_text: rawText };
}
