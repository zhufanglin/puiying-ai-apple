/**
 * OCR 引擎封裝 — Tesseract.js v5 + pdfjs-dist v4
 *
 * 支持輸入:
 * - 圖片: JPEG / PNG / BMP / TIFF / WebP → OCR 識別
 * - PDF:  優先提取嵌入文本（機器生成 PDF 準確度更高）→ 文本不足時回退到 OCR
 *
 * 對應文檔: workers/ocr_worker/ — 瀏覽器端替代實現
 */

import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

// ================================================================
// pdf.js Worker + CMap 配置
// ================================================================

// 使用本地 worker 和 CMap（避免 CDN 網絡問題）
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const CMAP_URL = "/cmaps/";

/** pdf.js getDocument 的通用配置 */
const PDF_OPTIONS = {
  cMapUrl: CMAP_URL,
  cMapPacked: true,
  standardFontDataUrl: CMAP_URL + "standard_fonts/",
};

// ================================================================
// 類型
// ================================================================

export interface OcrOptions {
  /** 識別語言，默認 chi_tra+chi_sim+eng（繁中+簡中+英文） */
  language?: string;
  /** 進度回調 */
  onProgress?: (pct: number) => void;
}

export interface OcrResult {
  text: string;
  confidence: number;
  lines: OcrLine[];
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

// ================================================================
// Worker 單例
// ================================================================

let workerInstance: Tesseract.Worker | null = null;

async function getWorker(language: string): Promise<Tesseract.Worker> {
  if (workerInstance) {
    try {
      await workerInstance.reinitialize(language, Tesseract.OEM.DEFAULT, {
        load_system_dawg: "false",
        load_freq_dawg: "false",
      });
      return workerInstance;
    } catch {
      await workerInstance.terminate();
      workerInstance = null;
    }
  }

  workerInstance = await Tesseract.createWorker(
    language,
    Tesseract.OEM.DEFAULT,
    {},
    {
      load_system_dawg: "false",
      load_freq_dawg: "false",
    }
  );

  await workerInstance!.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
  });

  return workerInstance!;
}

export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}

// ================================================================
// 工具
// ================================================================

function isPDF(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

// ================================================================
// PDF 嵌入文本提取（優先方案 — 發票等機器生成 PDF 最準確）
// ================================================================

interface PDFExtractResult {
  text: string;
  lines: OcrLine[];
  itemCount: number;
}

/**
 * 從 PDF 中提取嵌入文本
 * 適用於機器生成的發票、報表等（文本以字符/單詞形式嵌入）
 */
async function extractPDFText(file: File): Promise<PDFExtractResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, ...PDF_OPTIONS }).promise;

  const allLines: OcrLine[] = [];

  // 逐頁提取文本
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // pdf.js 返回的 items 包含位置信息和字符
    // 按 y 座標分行（同一行的 y 座標相近）
    const rows: Map<number, { text: string; x0: number; y0: number; x1: number; y1: number; count: number }> = new Map();
    const Y_TOLERANCE = 5; // y 座標容差

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (!str || !str.trim()) continue;

      // 用 transform 獲取座標
      const tx: number[] = "transform" in item ? (item as any).transform : [1, 0, 0, 1, 0, 0];
      const x = tx[4];
      const y = tx[5];

      // 找到同一行的 key
      let rowKey: number | null = null;
      for (const key of rows.keys()) {
        if (Math.abs(key - y) < Y_TOLERANCE) {
          rowKey = key;
          break;
        }
      }

      if (rowKey !== null) {
        const row = rows.get(rowKey)!;
        row.text += str;
        row.count++;
        row.x1 = Math.max(row.x1, x + (str.length * 8)); // 估算寬度
      } else {
        rows.set(y, {
          text: str,
          x0: x,
          y0: y,
          x1: x + str.length * 8,
          y1: y + 12,
          count: 1,
        });
      }
    }

    // 按 y 座標排序，組裝行
    const sortedRows = Array.from(rows.entries())
      .sort(([a], [b]) => a - b);

    for (let j = 0; j < sortedRows.length; j++) {
      const [, row] = sortedRows[j];
      const trimmed = row.text.trim();
      if (trimmed) {
        allLines.push({
          text: trimmed,
          confidence: 95, // 嵌入文本置信度高
          bbox: {
            x0: row.x0,
            y0: row.y0,
            x1: row.x1,
            y1: row.y1,
          },
        });
      }
    }

    page.cleanup();
  }

  pdf.destroy();

  const allText = allLines.map((l) => l.text).join("\n");
  return { text: allText, lines: allLines, itemCount: allLines.length };
}

// ================================================================
// PDF → Canvas 渲染（回退方案 — 掃描件/手寫件用）
// ================================================================

async function renderPDFToCanvas(file: File): Promise<HTMLCanvasElement> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, ...PDF_OPTIONS }).promise;

  if (pdf.numPages === 0) {
    throw new Error("PDF 文件沒有頁面");
  }

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });

  // 高分辨率渲染：300 DPI 級別 (A4 ≈ 2480 x 3508)
  const maxDimension = 2500;
  const scale = Math.min(maxDimension / viewport.width, maxDimension / viewport.height, 3.0);

  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  page.cleanup();
  pdf.destroy();

  return canvas;
}

// ================================================================
// 圖片預處理
// ================================================================

async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  const maxDimension = 2500;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // 灰度化提高識別率
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("圖片加載失敗，請確認文件格式為 JPEG / PNG / BMP / WebP"));
    };

    img.src = url;
  });
}

// ================================================================
// 主 OCR 函數（混合方案）
// ================================================================

/**
 * 識別文件中的文本
 *
 * 策略（按優先級）：
 * 1. PDF → 提取嵌入文本（準確、快速、不受水印干擾）
 * 2. PDF 嵌入文本不足 → 渲染 Canvas → Tesseract OCR
 * 3. 圖片 → 預處理 → Tesseract OCR
 *
 * 默認語言: chi_tra+chi_sim+eng（繁中 + 簡中 + 英文）
 * 香港場景使用繁體中文，同時兼容簡體和英文
 */
export async function recognizeImage(
  file: File,
  opts: OcrOptions = {}
): Promise<OcrResult> {
  const language = opts.language || "chi_tra+chi_sim+eng";

  // ── PDF: 優先文本提取 ──
  if (isPDF(file)) {
    try {
      const extracted = await extractPDFText(file);

      // 如果提取到足夠文本（至少 3 行、總共 20 字符以上），直接使用
      const hasEnoughText =
        extracted.itemCount >= 3 &&
        extracted.text.replace(/\s/g, "").length >= 20;

      if (hasEnoughText) {
        return {
          text: extracted.text,
          confidence: 98, // 嵌入文本幾乎 100% 準確
          lines: extracted.lines,
        };
      }

      // 嵌入文本不足（可能是掃描件）→ 回退到 OCR
      console.log("PDF 嵌入文本不足，回退到 OCR 渲染識別...");
    } catch (e) {
      console.warn("PDF 文本提取失敗，回退到 OCR:", e);
    }

    // 回退：渲染 PDF 為 Canvas → OCR
    const canvas = await renderPDFToCanvas(file);
    const worker = await getWorker(language);
    const result = await worker.recognize(canvas);

    const lines: OcrLine[] = (result.data.lines || []).map((line: any) => ({
      text: line.text.trim(),
      confidence: line.confidence,
      bbox: line.bbox,
    }));

    return {
      text: (result.data.text || "").trim(),
      confidence: result.data.confidence,
      lines,
    };
  }

  // ── 圖片: Canvas 預處理 → OCR ──
  const processed = await preprocessImage(file);
  const worker = await getWorker(language);
  const result = await worker.recognize(processed);

  const lines: OcrLine[] = (result.data.lines || []).map((line: any) => ({
    text: line.text.trim(),
    confidence: line.confidence,
    bbox: line.bbox,
  }));

  return {
    text: (result.data.text || "").trim(),
    confidence: result.data.confidence,
    lines,
  };
}

export async function recognizeText(file: File, language = "chi_tra+chi_sim+eng"): Promise<string> {
  const result = await recognizeImage(file, { language });
  return result.text;
}
