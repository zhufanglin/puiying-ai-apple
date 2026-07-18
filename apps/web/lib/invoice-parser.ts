/**
 * 发票 OCR 文本解析器 — 用于资产登记
 *
 * 支持中英文发票，多策略逐行提取字段。
 *
 * 输出: { assetName, category, amount, purchaseDate, vendor, confidence, warnings, raw_text }
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
// 类别关键词映射
// ================================================================

const CATEGORY_KEYWORDS: Record<string, string> = {
  "電腦": "IT設備", "計算機": "IT設備", "筆記本": "IT設備", "平板": "IT設備",
  "laptop": "IT設備", "desktop": "IT設備", "ipad": "IT設備", "chromebook": "IT設備",
  "打印機": "IT設備", "掃描儀": "IT設備", "伺服器": "IT設備", "顯示器": "IT設備",
  "monitor": "IT設備", "printer": "IT設備", "server": "IT設備", "鍵盤": "IT設備",
  "滑鼠": "IT設備", "mouse": "IT設備", "keyboard": "IT設備", "computer": "IT設備",
  "桌": "家具", "椅": "家具", "櫃": "家具", "架": "家具",
  "梳化": "家具", "沙發": "家具", "床": "家具",
  "desk": "家具", "chair": "家具", "cabinet": "家具", "shelf": "家具",
  "文件櫃": "家具", "書櫃": "家具", "辦公桌": "家具",
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
// 标签匹配模式
// ================================================================

const LABEL_PATTERNS = {
  assetName: [/品名[：:\s]*(.+)/, /貨品[：:\s]*(.+)/, /商品[：:\s]*(.+)/, /產品[：:\s]*(.+)/, /Product[：:\s]*(.+)/i, /Item[：:\s]*(.+)/i, /Description[：:\s]*(.+)/i],
  vendor: [/供應商[：:\s]*(.+)/, /賣方[：:\s]*(.+)/, /賣家[：:\s]*(.+)/, /公司[：:\s]*(.+)/, /Vendor[：:\s]*(.+)/i, /Supplier[：:\s]*(.+)/i, /From[：:\s]*(.+)/i, /Bill To[：:\s]*(.+)/i, /Sold To[：:\s]*(.+)/i],
};

// ================================================================
// 工具函数
// ================================================================

/** 从一行文本提取 yyyy-mm-dd 格式日期 */
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

/** 从一行文本提取金额 */
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
  // 纯金额行: 单个整数 ≥100
  m = line.match(/^(\d{3,})$/);
  if (m) return { amount: parseInt(m[1]!), source: m[1]! };
  return null;
}

/** 判断一行是否为噪音（页码、空行、纯符号等） */
function isNoise(line: string): boolean {
  if (!line.trim()) return true;
  if (/^(Page|頁碼|QTY|UNIT|Subtotal|Tax|VAT|Discount|Shipping|\(continued\))$/i.test(line)) return true;
  if (/^[\d\s\.\-_/\\|]+$/.test(line) && line.length < 6) return true;
  return false;
}

/** 行以标签开头（品名: xxx / Vendor: xxx） */
function extractLabeledField(line: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = line.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

// ================================================================
// 主解析函数 — 多策略
// ================================================================

export function parseInvoice(ocrResult: OcrResult): InvoiceResult {
  const rawText = ocrResult.text;
  const allLines = ocrResult.lines.map((l) => l.text).filter((l) => !isNoise(l));

  // ── 策略1: 标签匹配 ──
  const joinedText = allLines.join("\n");
  let assetName = "";
  let vendor = "";

  for (const line of allLines) {
    const name = extractLabeledField(line, LABEL_PATTERNS.assetName);
    if (name && !assetName) assetName = name;
    const ven = extractLabeledField(line, LABEL_PATTERNS.vendor);
    if (ven && !vendor) vendor = ven;
  }

  // ── 策略2: 逐行扫描提取日期/金额 ──
  let purchaseDate = "";
  let amount = 0;
  let amountSource = "";

  for (const line of allLines) {
    // 日期
    if (!purchaseDate) {
      const d = extractDateFromLine(line);
      if (d) purchaseDate = d;
    }
    // 金额（取带 HKD/HK$ 的，没有则取最大数字）
    const amt = extractAmountFromLine(line);
    if (amt) {
      // 优先使用带货币标记的
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

  // ── 策略3: 智能推断 — 发票号作为参考 ──
  // 找类似 "INV-xxx" / "TEST-xxx" 的发票号 → 存入备注
  let invoiceNo = "";
  for (const line of allLines) {
    const m = line.match(/^(?:INVOICE|INV|TEST|REF|NO|#)[-:\s]*([A-Z0-9][-A-Z0-9]+)$/i);
    if (m) { invoiceNo = m[1] || m[0]; break; }
  }

  // ── 策略4: 找疑似公司名/资产名的行 ──
  if (!assetName || !vendor) {
    for (const line of allLines) {
      const t = line.trim();
      // 跳过已识别的日期/金额/发票号
      if (!t || extractDateFromLine(t) || extractAmountFromLine(t) || isNoise(t)) continue;
      if (t === invoiceNo || t === "INVOICE") continue;
      // 长字符串 → 可能是公司名或品名
      if (t.length >= 4) {
        if (!vendor && /(?:公司|LIMITED|LTD|INC|CO\.|CORP|enterprise|company|limited|ltd|inc|corp)/i.test(t)) {
          vendor = t;
        } else if (!assetName && t.length >= 4 && t.length <= 200) {
          assetName = t;
        }
      }
    }
  }

  // ── 组装结果 ──
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

  // 备注：把发票号归入 vendor 用于前端展示
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
