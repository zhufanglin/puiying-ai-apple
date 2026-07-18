/**
 * OCR 引擎封装 — Tesseract.js v5 + pdfjs-dist v4
 *
 * 支持输入:
 * - 图片: JPEG / PNG / BMP / TIFF / WebP → OCR 识别
 * - PDF:  优先提取嵌入文本（机器生成 PDF 准确度更高）→ 文本不足时回退到 OCR
 *
 * 对应文档: workers/ocr_worker/ — 浏览器端替代实现
 */

import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

// ================================================================
// pdf.js Worker + CMap 配置
// ================================================================

// 使用本地 worker 和 CMap（避免 CDN 网络问题）
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const CMAP_URL = "/cmaps/";

/** pdf.js getDocument 的通用配置 */
const PDF_OPTIONS = {
  cMapUrl: CMAP_URL,
  cMapPacked: true,
  standardFontDataUrl: CMAP_URL + "standard_fonts/",
};

// ================================================================
// 类型
// ================================================================

export interface OcrOptions {
  /** 识别语言，默认 chi_tra+chi_sim+eng（繁中+简中+英文） */
  language?: string;
  /** 进度回调 */
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
// Worker 单例
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

  await workerInstance.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
  });

  return workerInstance;
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
// PDF 嵌入文本提取（优先方案 — 发票等机器生成 PDF 最准确）
// ================================================================

interface PDFExtractResult {
  text: string;
  lines: OcrLine[];
  itemCount: number;
}

/**
 * 从 PDF 中提取嵌入文本
 * 适用于机器生成的发票、报表等（文本以字符/单词形式嵌入）
 */
async function extractPDFText(file: File): Promise<PDFExtractResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, ...PDF_OPTIONS }).promise;

  const allLines: OcrLine[] = [];

  // 逐页提取文本
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // pdf.js 返回的 items 包含位置信息和字符
    // 按 y 坐标分行（同一行的 y 坐标相近）
    const rows: Map<number, { text: string; x0: number; y0: number; x1: number; y1: number; count: number }> = new Map();
    const Y_TOLERANCE = 5; // y 坐标容差

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (!str || !str.trim()) continue;

      // 用 transform 获取坐标
      const tx = "transform" in item ? item.transform : [1, 0, 0, 1, 0, 0];
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
        row.x1 = Math.max(row.x1, x + (str.length * 8)); // 估算宽度
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

    // 按 y 坐标排序，组装行
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
// PDF → Canvas 渲染（回退方案 — 扫描件/手写件用）
// ================================================================

async function renderPDFToCanvas(file: File): Promise<HTMLCanvasElement> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, ...PDF_OPTIONS }).promise;

  if (pdf.numPages === 0) {
    throw new Error("PDF 文件没有页面");
  }

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });

  // 高分辨率渲染：300 DPI 级别 (A4 ≈ 2480 x 3508)
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
// 图片预处理
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

      // 灰度化提高识别率
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
      reject(new Error("图片加载失败，请确认文件格式为 JPEG / PNG / BMP / WebP"));
    };

    img.src = url;
  });
}

// ================================================================
// 主 OCR 函数（混合方案）
// ================================================================

/**
 * 识别文件中的文本
 *
 * 策略（按优先级）：
 * 1. PDF → 提取嵌入文本（准确、快速、不受水印干扰）
 * 2. PDF 嵌入文本不足 → 渲染 Canvas → Tesseract OCR
 * 3. 图片 → 预处理 → Tesseract OCR
 *
 * 默认语言: chi_tra+chi_sim+eng（繁中 + 简中 + 英文）
 * 香港场景使用繁体中文，同时兼容简体和英文
 */
export async function recognizeImage(
  file: File,
  opts: OcrOptions = {}
): Promise<OcrResult> {
  const language = opts.language || "chi_tra+chi_sim+eng";

  // ── PDF: 优先文本提取 ──
  if (isPDF(file)) {
    try {
      const extracted = await extractPDFText(file);

      // 如果提取到足够文本（至少 3 行、总共 20 字符以上），直接使用
      const hasEnoughText =
        extracted.itemCount >= 3 &&
        extracted.text.replace(/\s/g, "").length >= 20;

      if (hasEnoughText) {
        return {
          text: extracted.text,
          confidence: 98, // 嵌入文本几乎 100% 准确
          lines: extracted.lines,
        };
      }

      // 嵌入文本不足（可能是扫描件）→ 回退到 OCR
      console.log("PDF 嵌入文本不足，回退到 OCR 渲染识别...");
    } catch (e) {
      console.warn("PDF 文本提取失败，回退到 OCR:", e);
    }

    // 回退：渲染 PDF 为 Canvas → OCR
    const canvas = await renderPDFToCanvas(file);
    const worker = await getWorker(language);
    const result = await worker.recognize(canvas);

    const lines: OcrLine[] = (result.data.lines || []).map((line) => ({
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

  // ── 图片: Canvas 预处理 → OCR ──
  const processed = await preprocessImage(file);
  const worker = await getWorker(language);
  const result = await worker.recognize(processed);

  const lines: OcrLine[] = (result.data.lines || []).map((line) => ({
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
