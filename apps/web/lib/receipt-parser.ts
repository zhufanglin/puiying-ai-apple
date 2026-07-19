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
  amount: [
    // HKD 模式
    /HK\$\s*([\d,]+\.?\d*)/i, /HKD?\s*\$?\s*([\d,]+\.?\d*)/i, /港幣\s*\$?\s*([\d,]+\.?\d*)/,
    /金額[：:\s]*\$?\s*([\d,]+\.?\d*)/, /總額[：:\s]*\$?\s*([\d,]+\.?\d*)/, /合計[：:\s]*\$?\s*([\d,]+\.?\d*)/, /Total[：:\s]*\$?\s*([\d,]+\.?\d*)/i,
    // RMB 模式
    /人民币\s*[：:]*\s*[¥￥]?\s*([\d,]+\.?\d{1,2})\s*元?/,
    /CN[Y¥]\s*[：:]*\s*[¥￥]?\s*([\d,]+\.?\d{1,2})/i,
    /RM[B]\s*[：:]*\s*[¥￥]?\s*([\d,]+\.?\d{1,2})/i,
    /[¥￥]\s*([\d,]+\.?\d{1,2})/,
    /金额[：:\s]*[¥￥]?\s*([\d,]+\.?\d{1,2})\s*元?/,
    /小写[：:\s]*[¥￥]?\s*([\d,]+\.?\d{1,2})/,
    /大写[：:\s]*([零壹贰叁肆伍陆柒捌玖拾佰仟万亿兩元圆角分整正]+)/,
  ],
  date: [/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, /(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/, /(\d{1,2})\/(\d{1,2})\/(\d{4})/, /日期[：:\s]*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/, /Date[：:\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i],
  payer: [/付款人[：:\s]*(.+)/, /經手人[：:\s]*(.+)/, /繳款人[：:\s]*(.+)/, /繳費人[：:\s]*(.+)/, /交款人[：:\s]*(.+)/, /交款单位[：:\s]*(.+)/, /交款單位[：:\s]*(.+)/, /Payer[：:\s]*(.+)/i, /From[：:\s]*(.+)/i, /客户[：:\s]*(.+)/],
  purpose: [/用途[：:\s]*(.+)/, /項目[：:\s]*(.+)/, /事項[：:\s]*(.+)/, /收款事由[：:\s]*(.+)/, /事由[：:\s]*(.+)/, /摘要[：:\s]*(.+)/, /Purpose[：:\s]*(.+)/i, /For[：:\s]*(.+)/i, /備註[：:\s]*(.+)/, /Remarks?[：:\s]*(.+)/i],
};

// ================================================================
// 逐行掃描工具
// ================================================================

function isoDate(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractDateFromLine(line: string): string | null {
  let m = line.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = line.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  // 英文月份
  const monMap: Record<string, string> = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" };
  m = line.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
  if (m) return isoDate(Number(m[3]), Number(monMap[m[2]!.toLowerCase()]), Number(m[1]));
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
  // RMB 模式
  m = line.match(/人民币\s*[：:]*\s*[¥￥]?\s*([\d,]+\.?\d{1,2})\s*元?/);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  m = line.match(/[¥￥]\s*([\d,]+\.?\d{1,2})/);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  m = line.match(/([\d,]+\.?\d{1,2})\s*元/);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  m = line.match(/RM[B]\s*[¥￥]?\s*([\d,]+\.?\d{1,2})/i);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  m = line.match(/CN[Y¥]\s*[¥￥]?\s*([\d,]+\.?\d{1,2})/i);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  // 有美元貨幣符號的金額
  m = line.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  // 有明確金額標籤的數值（¥￥可能被OCR誤讀為□）
  m = line.match(/(?:金額|金额|總額|总额|合計|合计|小写)[：:\s]*[¥￥□]?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (m) return parseFloat(m[1]!.replace(/,/g, ""));
  // 純數字可能是收據編號、電話或學號，絕不直接推斷為金額。
  return null;
}

function isNoise(line: string): boolean {
  const value = line.trim();
  if (!value) return true;
  if (/^(收據|收据|Receipt|Invoice|Page|頁碼|页码|QTY|Subtotal|Tax)$/i.test(value)) return true;
  if (/^(?:N[°ºo]?|No\.?|Receipt\s*No\.?)\s*[：:]?$/i.test(value)) return true;
  if (/^(?:日期|Date|今收到|收到|付款人|經手人|经手人|繳款人|缴款人|繳費人|缴费人|交款人|交款单位|用途|項目|项目|事項|事项|收款事由|事由|摘要|備註|备注|金额|金額|小写|大写|收款人|收款方式)\s*[：:]?$/i.test(value)) return true;
  return false;
}

const PAYER_LABEL = /^(?:付款人|經手人|经手人|繳款人|缴款人|繳費人|缴费人|交款人|交款单位|交款單位|今收到|收到)\s*[：:]?$/i;
const PURPOSE_LABEL = /^(?:用途|項目|项目|事項|事项|收款事由|事由|摘要|備註|备注)\s*[：:]?$/i;

function nextNonEmptyLine(lines: string[], index: number): string {
  for (let i = index + 1; i < lines.length; i += 1) {
    const value = lines[i]!.trim();
    if (value) return value;
  }
  return "";
}

function looksLikePersonName(value: string): boolean {
  if (!value || isNoise(value) || extractDateFromLine(value) || extractAmountFromLine(value) !== null) {
    return false;
  }
  return /^[\p{Script=Han}·•]{2,12}$/u.test(value);
}

function extractLabeled(line: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = line.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

// ================================================================
// 中文大寫金額轉換
// ================================================================

const CHINESE_NUM_MAP: Record<string, number> = {
  零: 0, 壹: 1, 贰: 2, 叁: 3, 肆: 4, 伍: 5, 陆: 6, 柒: 7, 捌: 8, 玖: 9,
  貳: 2, 陸: 6,
};
const CHINESE_UNIT_MAP: Record<string, number> = {
  拾: 10, 佰: 100, 仟: 1000, 万: 10000, 萬: 10000, 亿: 100000000,
  十: 10, 百: 100, 千: 1000,
};

function chineseAmountToNumber(chinese: string): number | null {
  const cleaned = chinese.replace(/[整正两圓元圆角分]+/g, "").trim();
  if (!cleaned) return null;

  // 简单模式：壹佰壹拾伍 → 115
  let result = 0;
  let current = 0;
  let hasMillion = false; // 亿以上段

  for (const char of cleaned) {
    const num = CHINESE_NUM_MAP[char];
    const unit = CHINESE_UNIT_MAP[char];
    if (num !== undefined) {
      current = num;
    } else if (unit !== undefined) {
      if (unit >= 10000) {
        result = (result + current) * unit;
        current = 0;
        if (unit >= 100000000) hasMillion = true;
      } else {
        current = current * unit;
        result += current;
        current = 0;
      }
    }
  }
  result += current;
  return result > 0 ? result : null;
}

// ================================================================
// 幣種檢測
// ================================================================

function detectCurrency(text: string): string {
  const rmbHints = /人民币|CNY|RMB|[¥￥]|\b元\b/;
  const hkdHints = /港幣|HKD|HK\$|港元/;
  const rmb = rmbHints.test(text);
  const hkd = hkdHints.test(text);
  if (rmb && !hkd) return "CNY";
  if (hkd && !rmb) return "HKD";
  // 都没或都有，默认 CNY（培英在大陆但用港币...保持 HKD 作为默认）
  return "HKD";
}

// ================================================================
// 主解析函數
// ================================================================

export function parseReceipt(ocrResult: OcrResult): ReceiptResult {
  const rawText = ocrResult.text;
  const sourceLines = (ocrResult.lines.length > 0
    ? ocrResult.lines.map((line) => line.text)
    : rawText.split(/\r?\n/)
  ).map((line) => line.trim()).filter(Boolean);
  const allLines = sourceLines.filter((line) => !isNoise(line));

  // ── 策略1: 標籤匹配 ──
  let payer = "";
  let purpose = "";
  for (const line of allLines) {
    const p = extractLabeled(line, LABEL_PATTERNS.payer);
    if (p && !payer) payer = p;
    const pu = extractLabeled(line, LABEL_PATTERNS.purpose);
    if (pu && !purpose) purpose = pu;
  }

  // 標籤和值分行：只接受明確標籤的下一個非空行，不猜測其他散落文字。
  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index]!;
    const next = nextNonEmptyLine(sourceLines, index);
    if (!payer && PAYER_LABEL.test(line) && looksLikePersonName(next)) {
      payer = next;
    }
    if (!purpose && PURPOSE_LABEL.test(line) && next && !isNoise(next)
      && !/^\d{3,}$/.test(next)
      && !extractDateFromLine(next) && extractAmountFromLine(next) === null) {
      purpose = next;
    }
  }

  // 「今收到張三」同一行的保守姓名提取。
  if (!payer) {
    for (const line of sourceLines) {
      const match = line.match(/^(?:今?收到)[：:\s]*([\p{Script=Han}·•]{2,12})$/u);
      if (match?.[1] && looksLikePersonName(match[1])) {
        payer = match[1];
        break;
      }
    }
  }

  // ── 策略2: 逐行掃描日期/金額 ──
  let date = "";
  let amount: number | null = null;
  let amountSource = "";
  let chineseAmount: number | null = null;

  for (const line of allLines) {
    if (!date) {
      const d = extractDateFromLine(line);
      if (d) date = d;
    }
    // 先查大写金额（"大写）：壹佰元" 或 "大写：壹佰元"）
    const caMatch = line.match(/大写[）)]?\s*[：:]?\s*([零壹贰叁肆伍陆柒捌玖拾佰仟万亿兩元圆角分整正贰陸]+)/);
    if (caMatch?.[1] && !chineseAmount) {
      chineseAmount = chineseAmountToNumber(caMatch[1]);
    }
    const amt = extractAmountFromLine(line);
    if (amt !== null) {
      const hasCurrency = /HKD|HK\$|港幣|RMB|CNY|人民币|[¥￥]|\$\s*\d|元/i.test(line);
      if (hasCurrency && (!amountSource || !/HKD|HK\$|港幣|RMB|CNY|人民币|[¥￥]|\$\s*\d|元/i.test(amountSource))) {
        amount = amt;
        amountSource = line;
      } else if (!amountSource && amt >= 100) {
        amount = amt;
        amountSource = line;
      }
    }
  }

  // 大写金额优先（更可靠）
  if (chineseAmount !== null && (!amount || chineseAmount === amount || Math.abs(chineseAmount - amount!) < 10)) {
    amount = chineseAmount;
  }

  // ── 策略3: 通用金额回退（无标签的纯数字金额） ──
  if (amount === null) {
    for (const line of allLines) {
      // "收款xxx元" / "合计xxx元" / 行尾的 "xxx元"
      const m = line.match(/[收款支合总计费]\s*[¥￥]?\s*([\d,]+\.?\d{1,2})\s*元?/);
      if (m) {
        amount = parseFloat(m[1]!.replace(/,/g, ""));
        break;
      }
    }
  }
  if (amount === null) {
    // 最宽松回退：找纯数字行或类似金额的行
    for (const line of allLines) {
      const m = line.match(/^[¥￥]?\s*([\d,]+\.?\d{1,2})\s*元?$/);
      if (m) {
        const candidate = parseFloat(m[1]!.replace(/,/g, ""));
        if (candidate >= 1 && candidate < 100000000) {
          amount = candidate;
          break;
        }
      }
    }
  }

  // ── 組裝 ──
  const fullText = rawText || sourceLines.join("\n");
  const currency = detectCurrency(fullText);
  const fields: ReceiptFields = {
    amount,
    currency,
    date,
    payer,
    purpose,
  };

  let confidence: "low" | "medium" | "high";
  if (amount !== null && date && (payer || purpose) && ocrResult.confidence >= 80) confidence = "high";
  else if (amount !== null && (date || payer || purpose)) confidence = "medium";
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
