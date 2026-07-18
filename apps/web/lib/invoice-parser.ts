/**
 * 發票 OCR 文本解析器 — 用於資產登記
 *
 * 支持中英文發票，多策略逐行提取字段。
 *
 * 輸出: { assetName, category, amount, purchaseDate, vendor, confidence, warnings, raw_text }
 */

import type { OcrResult } from "./ocr-engine";

export interface InvoiceResult {
  assetName: string;
  category: string;
  amount: number;
  purchaseDate: string;
  vendor: string;
  confidence: "low" | "medium" | "high";
  warnings: string[];
  raw_text: string;
}

// ================================================================
// 類別關鍵詞映射
// ================================================================

const CATEGORY_KEYWORDS: Record<string, string> = {
  "電腦": "IT設備", "計算機": "IT設備", "筆記本": "IT設備", "平板": "IT設備",
  "laptop": "IT設備", "desktop": "IT設備", "ipad": "IT設備", "chromebook": "IT設備",
  "打印機": "IT設備", "掃描儀": "IT設備", "伺服器": "IT設備", "顯示器": "IT設備",
  "monitor": "IT設備", "printer": "IT設備", "server": "IT設備", "鍵盤": "IT設備",
  "滑鼠": "IT設備", "mouse": "IT設備", "keyboard": "IT設備", "computer": "IT設備",
  "桌": "傢俱", "椅": "傢俱", "櫃": "傢俱", "架": "傢俱",
  "梳化": "傢俱", "沙發": "傢俱", "牀": "傢俱",
  "desk": "傢俱", "chair": "傢俱", "cabinet": "傢俱", "shelf": "傢俱",
  "文件櫃": "傢俱", "書櫃": "傢俱", "辦公桌": "傢俱",
  "空調": "電器", "冷氣": "電器", "投影": "電器", "音響": "電器",
  "電視": "電器", "風扇": "電器", "暖爐": "電器", "雪櫃": "電器",
  "冰箱": "電器", "微波爐": "電器", "熱水": "電器",
  "aircon": "電器", "projector": "電器", "speaker": "電器", "tv": "電器",
  "電話": "辦公設備", "傳真": "辦公設備", "影印": "辦公設備",
  "phone": "辦公設備", "fax": "辦公設備", "copier": "辦公設備",
};

function inferCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword.toLowerCase())) {
      return category;
    }
  }
  return "其他";
}

// ================================================================
// 標籤匹配模式
// ================================================================

const LABEL_PATTERNS = {
  assetName: [/品名[：:\s]*(.+)/, /貨品[：:\s]*(.+)/, /商品[：:\s]*(.+)/, /產品[：:\s]*(.+)/, /Product[：:\s]*(.+)/i, /Item[：:\s]*(.+)/i, /Description[：:\s]*(.+)/i],
  vendor: [/供應商[：:\s]*(.+)/, /賣方[：:\s]*(.+)/, /賣家[：:\s]*(.+)/, /公司[：:\s]*(.+)/, /Vendor[：:\s]*(.+)/i, /Supplier[：:\s]*(.+)/i, /From[：:\s]*(.+)/i, /Bill To[：:\s]*(.+)/i, /Sold To[：:\s]*(.+)/i],
};

// ================================================================
// 工具函數
// ================================================================

/** 從一行文本提取 yyyy-mm-dd 格式日期 */
function extractDateFromLine(line: string): string | null {
  // 2026-07-10 / 2026/07/10
  let m = line.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  // 10/07/2026
  m = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  // 2026年7月10日
  m = line.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  return null;
}

/** 從一行文本提取金額 */
function extractAmountFromLine(line: string): { amount: number; source: string } | null {
  // HKD 7,200.00 / HK$ 7,200.00
  let m = line.match(/HKD?\s*\$?\s*([\d,]+\.?\d*)/i);
  if (m) return { amount: parseFloat(m[1]!.replace(/,/g, "")), source: m[0] };
  // HK$ 7,200.00
  m = line.match(/HK\$\s*([\d,]+\.?\d*)/i);
  if (m) return { amount: parseFloat(m[1]!.replace(/,/g, "")), source: m[0] };
  // $7,200.00
  m = line.match(/\$\s*([\d,]+\.\d{2})/);
  if (m) return { amount: parseFloat(m[1]!.replace(/,/g, "")), source: m[0] };
  // 純金額行: 單個整數 ≥100
  m = line.match(/^(\d{3,})$/);
  if (m) return { amount: parseInt(m[1]!), source: m[1]! };
  return null;
}

/** 判斷一行是否為噪音（頁碼、空行、純符號等） */
function isNoise(line: string): boolean {
  if (!line.trim()) return true;
  if (/^(Page|頁碼|QTY|UNIT|Subtotal|Tax|VAT|Discount|Shipping|\(continued\))$/i.test(line)) return true;
  if (/^[\d\s\.\-_/\\|]+$/.test(line) && line.length < 6) return true;
  return false;
}

/** 行以標籤開頭（品名: xxx / Vendor: xxx） */
function extractLabeledField(line: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = line.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

// ================================================================
// 主解析函數 — 多策略
// ================================================================

export function parseInvoice(ocrResult: OcrResult): InvoiceResult {
  const rawText = ocrResult.text;
  const allLines = ocrResult.lines.map((l) => l.text).filter((l) => !isNoise(l));

  // ── 策略1: 標籤匹配 ──
  const joinedText = allLines.join("\n");
  let assetName = "";
  let vendor = "";

  for (const line of allLines) {
    const name = extractLabeledField(line, LABEL_PATTERNS.assetName);
    if (name && !assetName) assetName = name;
    const ven = extractLabeledField(line, LABEL_PATTERNS.vendor);
    if (ven && !vendor) vendor = ven;
  }

  // ── 策略2: 逐行掃描提取日期/金額 ──
  let purchaseDate = "";
  let amount = 0;
  let amountSource = "";

  for (const line of allLines) {
    // 日期
    if (!purchaseDate) {
      const d = extractDateFromLine(line);
      if (d) purchaseDate = d;
    }
    // 金額（取帶 HKD/HK$ 的，沒有則取最大數字）
    const amt = extractAmountFromLine(line);
    if (amt) {
      // 優先使用帶貨幣標記的
      const hasCurrency = /HKD|HK\$|\$/i.test(amt.source);
      if (hasCurrency && (!amountSource || !/HKD|HK\$|\$/i.test(amountSource))) {
        amount = amt.amount;
        amountSource = amt.source;
      } else if (!amountSource && amt.amount >= 100) {
        amount = amt.amount;
        amountSource = amt.source;
      }
    }
  }

  // ── 策略3: 智能推斷 — 發票號作為參考 ──
  // 找類似 "INV-xxx" / "TEST-xxx" 的發票號 → 存入備註
  let invoiceNo = "";
  for (const line of allLines) {
    const m = line.match(/^(?:INVOICE|INV|TEST|REF|NO|#)[-:\s]*([A-Z0-9][-A-Z0-9]+)$/i);
    if (m) { invoiceNo = m[1] || m[0]; break; }
  }

  // ── 策略4: 找疑似公司名/資產名的行 ──
  if (!assetName || !vendor) {
    for (const line of allLines) {
      const t = line.trim();
      // 跳過已識別的日期/金額/發票號
      if (!t || extractDateFromLine(t) || extractAmountFromLine(t) || isNoise(t)) continue;
      if (t === invoiceNo || t === "INVOICE") continue;
      // 長字符串 → 可能是公司名或品名
      if (t.length >= 4) {
        if (!vendor && /(?:公司|LIMITED|LTD|INC|CO\.|CORP|enterprise|company|limited|ltd|inc|corp)/i.test(t)) {
          vendor = t;
        } else if (!assetName && t.length >= 4 && t.length <= 200) {
          assetName = t;
        }
      }
    }
  }

  // ── 組裝結果 ──
  const category = inferCategory(assetName);
  const filled = [assetName !== "", amount > 0, purchaseDate !== "", vendor !== ""].filter(Boolean).length;
  let confidence: "low" | "medium" | "high";
  if (filled >= 3 && ocrResult.confidence >= 60) confidence = "high";
  else if (filled >= 2) confidence = "medium";
  else confidence = "low";

  const warnings: string[] = [];
  if (!assetName) warnings.push("未能識別資產名稱，請手動填寫");
  if (amount === 0) warnings.push("未能識別金額，請手動填寫");
  if (!purchaseDate) warnings.push("未能識別購買日期");
  if (!vendor) warnings.push("未能識別供應商");
  if (invoiceNo && !assetName) warnings.push(`已識別發票號 ${invoiceNo}，請手動輸入資產名稱`);
  if (ocrResult.confidence < 50) warnings.push("OCR 識別信心較低，建議仔細核對");

  // 備註：把發票號歸入 vendor 用於前端展示
  if (!vendor && invoiceNo) vendor = invoiceNo;

  return {
    assetName,
    category,
    amount,
    purchaseDate,
    vendor,
    confidence,
    warnings,
    raw_text: rawText,
  };
}
