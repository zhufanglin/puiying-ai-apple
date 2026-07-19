/**
 * 發票 OCR 文本的保守解析器。
 *
 * 這是 DeepSeek 結構化不可用時的安全回退：只回填有明確標籤及證據的欄位，
 * 寧可留空讓使用者核對，也不把發票號、電話或買方資料誤當資產資料。
 */

import type { OcrResult } from "./ocr-engine";

export type AssetCategory = "IT設備" | "傢俱" | "電器" | "辦公設備" | "其他";

export interface InvoiceResult {
  assetName: string;
  category: AssetCategory | "";
  amount: number;
  currency: "HKD" | "CNY" | "";
  purchaseDate: string;
  vendor: string;
  invoiceNo: string;
  multipleItems: boolean;
  confidence: "low" | "medium" | "high";
  warnings: string[];
  raw_text: string;
}

const CATEGORY_KEYWORDS: Array<[RegExp, AssetCategory]> = [
  [/(?:電腦|计算机|計算機|筆記本|笔记本|平板|laptop|desktop|ipad|chromebook|computer|monitor|server|掃描儀|扫描仪|伺服器|服务器|顯示器|显示器|鍵盤|键盘|滑鼠|鼠标|mouse|keyboard)/i, "IT設備"],
  [/(?:桌|椅|櫃|柜|架|梳化|沙發|沙发|牀|床|desk|chair|cabinet|shelf|文件櫃|文件柜|書櫃|书柜|辦公桌|办公桌)/i, "傢俱"],
  [/(?:空調|空调|冷氣|冷气|投影|音響|音响|電視|电视|風扇|风扇|暖爐|暖炉|雪櫃|雪柜|冰箱|微波爐|微波炉|熱水|热水|aircon|projector|speaker|\btv\b)/i, "電器"],
  [/(?:打印機|打印机|printer|電話|电话|傳真|传真|影印|複印|复印|phone|fax|copier)/i, "辦公設備"],
];

const ASSET_LABEL = /^(?:品名|貨品|货品|商品|產品|产品|product|item|description)\s*[：:]\s*(.+)$/i;
const VENDOR_LABEL = /^(?:供應商|供应商|賣方|卖方|賣家|卖家|vendor|supplier|seller)\s*[：:]\s*(.+)$/i;
const BUYER_LABEL = /^(?:bill\s*to|sold\s*to|ship\s*to|buyer|customer|客戶|客户|買方|买方|收貨人|收货人)\b/i;
const INVOICE_NO_LABEL = /^(?:invoice\s*(?:no\.?|number|#)|發票(?:號|号码|號碼)|发票(?:号|号码)|單據編號|单据编号)\s*[：:#.]?\s*([A-Z0-9][A-Z0-9/_-]{1,63})\s*$/i;
const INVOICE_DATE_LABEL = /(?:invoice\s*date|發票日期|发票日期|單據日期|单据日期)/i;
const EXCLUDED_DATE_LABEL = /(?:due\s*date|delivery\s*date|payment\s*date|到期日|交貨日期|交货日期|付款日期)/i;
const INVOICE_TOTAL_LABEL = /(?:grand\s*total|invoice\s*total|total\s*amount|\btotal\b|總額|总额|合計|合计)/i;
const BALANCE_DUE_LABEL = /(?:amount\s*due|balance\s*due|應付|应付)/i;
const EXCLUDED_AMOUNT_LABEL = /(?:sub[\s-]*total|tax|vat|discount|shipping|freight|deposit|unit\s*price|total\s*items?|quantity|qty|小計|小计|稅|税|折扣|運費|运费|訂金|订金|單價|单价|數量|数量)/i;
const EXPLICIT_HKD = /(?:HKD|HK\$|港幣|港币|港元)/i;
const EXPLICIT_CNY = /(?:CNY|RMB|¥|￥|人民币|人民幣|\b元\b)/i;
const FOREIGN_CURRENCY = /(?:USD|US\$|EUR|GBP|JPY|AUD|CAD|MOP|美元|歐元|欧元|英鎊|英镑|日圓|日元)/i;
const PAYMENT_OR_CREDIT_CONTEXT = /(?:\bpaid\b|payment|deposit|credit|refund|已付|付款|訂金|订金|退款|貸項|贷项)/i;
const CREDIT_DOCUMENT_CONTEXT = /(?:\bcredit\s*(?:note|memo|advice|invoice)\b|^\s*credit(?:\s*(?:no\.?|#)\s*\S+)?\s*$|貸項通知|贷项通知|紅字發票|红字发票|退款單|退款单)/i;

function cleanLines(ocrResult: OcrResult): string[] {
  const source = ocrResult.lines.length > 0
    ? ocrResult.lines.map((line) => line.text)
    : ocrResult.text.split(/\r?\n/);
  return source
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractLabeledValues(lines: string[], pattern: RegExp): string[] {
  return unique(extractLabeledOccurrences(lines, pattern));
}

function extractLabeledOccurrences(lines: string[], pattern: RegExp): string[] {
  const values: string[] = [];
  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]?.trim()) values.push(match[1].trim());
  }
  return values;
}

function inferCategory(name: string): AssetCategory | "" {
  if (!name) return "";
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(name)) return category;
  }
  return "";
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year
    && value.getUTCMonth() === month - 1
    && value.getUTCDate() === day;
}

function toISODate(year: number, month: number, day: number): string | null {
  if (!isValidDate(year, month, day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateFromLine(line: string): { value: string | null; ambiguous: boolean } {
  let match = line.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (match) {
    return { value: toISODate(Number(match[1]), Number(match[2]), Number(match[3])), ambiguous: false };
  }

  match = line.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (match) {
    return { value: toISODate(Number(match[1]), Number(match[2]), Number(match[3])), ambiguous: false };
  }

  match = line.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (!match) return { value: null, ambiguous: false };

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  if (first <= 12 && second <= 12) return { value: null, ambiguous: true };
  if (first > 12 && second <= 12) {
    return { value: toISODate(year, second, first), ambiguous: false };
  }
  if (second > 12 && first <= 12) {
    return { value: toISODate(year, first, second), ambiguous: false };
  }
  return { value: null, ambiguous: false };
}

function extractPurchaseDate(lines: string[]): { value: string; ambiguous: boolean; conflicting: boolean } {
  const values: string[] = [];
  let ambiguous = false;

  for (const line of lines) {
    if (!INVOICE_DATE_LABEL.test(line) || EXCLUDED_DATE_LABEL.test(line)) continue;
    const parsed = parseDateFromLine(line);
    ambiguous ||= parsed.ambiguous;
    if (parsed.value) values.push(parsed.value);
  }

  const distinct = unique(values);
  return {
    value: distinct.length === 1 && !ambiguous ? distinct[0]! : "",
    ambiguous,
    conflicting: distinct.length > 1,
  };
}

function parseCurrencyAmount(line: string, currencyPattern: RegExp): number | null {
  if (
    /[-−–—]\s*(?:\d)/i.test(line)
    || /[（(]\s*\d[\d,.]*\s*[)）]/i.test(line)
    || /\d[\d,.]*\s*[-−–—](?:\s|$)/.test(line)
    || /(?:\b(?:CR|CREDIT)\s*\d|\d[\d,.]*\s*(?:CR|CREDIT)\b|\bcredit\s*note\b)/i.test(line)
  ) {
    return null;
  }
  const numberPattern = "((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)";
  const before = new RegExp(`${currencyPattern.source}\\s*[：:]?\\s*${numberPattern}(?![\\d,.])`, "i");
  const after = new RegExp(`(?:^|[^\\d,.])${numberPattern}(?![\\d,.])\\s*${currencyPattern.source}`, "i");
  // 人民币额外：¥100 / 100元
  const yuanBefore = /[¥￥]\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d,.])/i;
  const yuanAfter = /((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*元/i;
  const match = line.match(before) ?? line.match(after) ?? line.match(yuanBefore) ?? line.match(yuanAfter);
  if (!match?.[1]) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseHKDAmount(line: string): number | null {
  return parseCurrencyAmount(line, EXPLICIT_HKD);
}

function extractTotalAmount(lines: string[]): {
  amount: number;
  currency: "HKD" | "CNY" | "";
  conflicting: boolean;
  totalWithoutHKD: boolean;
  creditDocument: boolean;
} {
  const creditDocument = lines.some((line) => CREDIT_DOCUMENT_CONTEXT.test(line));
  if (creditDocument) {
    return {
      amount: 0,
      currency: "",
      conflicting: false,
      totalWithoutHKD: false,
      creditDocument: true,
    };
  }

  const values: Array<{ amount: number; currency: "HKD" | "CNY" }> = [];
  let totalWithoutHKD = false;
  const invoiceTotalLines = lines.filter((line) =>
    INVOICE_TOTAL_LABEL.test(line) && !EXCLUDED_AMOUNT_LABEL.test(line),
  );
  const candidateLines = invoiceTotalLines.length > 0
    ? invoiceTotalLines
    : (lines.some((line) => PAYMENT_OR_CREDIT_CONTEXT.test(line))
      ? []
      : lines.filter((line) => BALANCE_DUE_LABEL.test(line) && !EXCLUDED_AMOUNT_LABEL.test(line)));

  for (const line of candidateLines) {
    if (FOREIGN_CURRENCY.test(line)) {
      continue; // 真正的外币跳过
    }
    const hkd = parseHKDAmount(line);
    const cny = parseCurrencyAmount(line, EXPLICIT_CNY);
    if (hkd !== null) {
      values.push({ amount: hkd, currency: "HKD" });
    } else if (cny !== null) {
      values.push({ amount: cny, currency: "CNY" });
    } else {
      totalWithoutHKD = true;
    }
  }

  const distinct = Array.from(new Set(values.map(v => `${v.currency}:${v.amount}`)));
  const first = values[0];
  return {
    amount: distinct.length === 1 && first ? first.amount : 0,
    currency: distinct.length === 1 && first ? first.currency : "",
    conflicting: distinct.length > 1,
    totalWithoutHKD,
    creditDocument: false,
  };
}

function extractInvoiceNo(lines: string[]): string {
  const values = extractLabeledValues(lines, INVOICE_NO_LABEL);
  return values.length === 1 ? values[0]! : "";
}

function extractVendor(lines: string[]): string {
  const values = extractLabeledValues(lines, VENDOR_LABEL)
    .filter((value) => !BUYER_LABEL.test(value));
  return values.length === 1 ? values[0]! : "";
}

function hasConfirmedSingleQuantity(lines: string[], assetLineIndex: number): boolean {
  const quantities: Array<{ lineIndex: number; value: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const labeledPattern = /(?:^|\b)(?:qty|quantity|數量|数量|total\s*items?|貨品總數|货品总数|項目總數|项目总数)\s*[：:]?\s*(\d+)\b/gi;
    let labeled = labeledPattern.exec(line);
    while (labeled) {
      quantities.push({ lineIndex: index, value: Number(labeled[1]) });
      labeled = labeledPattern.exec(line);
    }

    if (/^(?:qty|quantity|數量|数量|total\s*items?|貨品總數|货品总数|項目總數|项目总数)\s*[：:]?$/i.test(line)) {
      const nextValue = lines[index + 1]?.match(/^(\d+)\b/);
      if (nextValue) quantities.push({ lineIndex: index, value: Number(nextValue[1]) });
    }

    const multiplied = line.match(
      /(?:\b(\d+)(?:\s+[xX]\s+|\s*×\s*)\S|\S(?:.*\S)?(?:\s+[xX]\s+|\s*×\s*)(\d+)\b)/,
    );
    const multipliedValue = multiplied?.[1] ?? multiplied?.[2];
    if (multipliedValue) quantities.push({ lineIndex: index, value: Number(multipliedValue) });
  }

  return quantities.length === 1
    && quantities[0]!.value === 1
    && quantities[0]!.lineIndex >= assetLineIndex
    && quantities[0]!.lineIndex <= assetLineIndex + 1;
}

export function parseInvoice(ocrResult: OcrResult): InvoiceResult {
  const lines = cleanLines(ocrResult);
  const assetOccurrences = lines.flatMap((line, lineIndex) => {
    const match = line.match(ASSET_LABEL);
    return match?.[1]?.trim() ? [{ lineIndex, value: match[1].trim() }] : [];
  });
  const rawAssetNames = assetOccurrences.map(({ value }) =>
    value
      .replace(/\s+(?:qty|quantity|數量|数量)\s*[：:]?\s*\d+\s*$/i, "")
      .replace(/(?:\s+[xX]\s+|\s*×\s*)\d+\s*$/, "")
      .trim(),
  );
  // 必須剛好找到一個有標籤的貨品名稱，且有明确数量 1 的证据。
  const multipleItems = rawAssetNames.length !== 1
    || !hasConfirmedSingleQuantity(lines, assetOccurrences[0]?.lineIndex ?? -1);
  const amountResult = extractTotalAmount(lines);
  const dateResult = extractPurchaseDate(lines);
  const vendor = extractVendor(lines);
  const invoiceNo = extractInvoiceNo(lines);

  const assetName = multipleItems || rawAssetNames.length !== 1 ? "" : rawAssetNames[0]!;
  const category = multipleItems ? "" : inferCategory(assetName);
  const amount = multipleItems ? 0 : amountResult.amount;
  const currency = multipleItems ? "" : amountResult.currency;
  const purchaseDate = dateResult.value;

  const warnings: string[] = [];
  if (multipleItems) warnings.push("發票包含多項貨品，或無法確認只有一項資產；未自動合併，請對照原圖逐項登記");
  if (!assetName) warnings.push("未能可靠識別單一資產名稱，請對照原圖填寫");
  if (assetName && !category) warnings.push("未能可靠判斷資產類別，請手動選擇");
  if (amountResult.creditDocument) warnings.push("檢測到貸項通知／退款單，未自動填寫正數購買金額");
  else if (amountResult.conflicting) warnings.push("發票出現多個不同的金額，未自動填寫金額");
  else if (!amountResult.amount) {
    warnings.push(amountResult.totalWithoutHKD
      ? "總額未標明 HKD/CNY/¥ 等貨幣標記，未自動假定貨幣及金額"
      : "未找到明確標示幣種的發票總額，請手動填寫");
  }
  if (dateResult.ambiguous) warnings.push("發票日期的日/月次序有歧義，未自動填寫");
  else if (dateResult.conflicting) warnings.push("發票出現多個不同的發票日期，未自動填寫");
  else if (!purchaseDate) warnings.push("未找到明確的發票日期，請手動填寫");
  if (!vendor) warnings.push("未能可靠識別賣方／供應商；Bill To、Sold To 等買方資料不會自動採用");
  if (!invoiceNo) warnings.push("未能可靠識別發票號碼");
  if (ocrResult.confidence < 50) warnings.push("OCR 識別信心較低，請仔細核對原圖");

  const coreComplete = Boolean(assetName && amount > 0 && (currency === "HKD" || currency === "CNY") && purchaseDate);
  let confidence: InvoiceResult["confidence"] = "low";
  if (!multipleItems && coreComplete && category && vendor && ocrResult.confidence >= 80) {
    confidence = "high";
  } else if (!multipleItems && coreComplete && ocrResult.confidence >= 50) {
    confidence = "medium";
  }

  return {
    assetName,
    category,
    amount,
    currency,
    purchaseDate,
    vendor,
    invoiceNo,
    multipleItems,
    confidence,
    warnings,
    raw_text: ocrResult.text,
  };
}
