"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, AlertTriangle } from "lucide-react";
import UploadDropzone from "@/components/ui/UploadDropzone";
import { recognizeImage } from "@/lib/ocr-engine";
import {
  recognizeWithServerFallback,
  type ServerStructuredResult,
} from "@/lib/ocr-api";
import {
  DEFAULT_RECEIPT_AI_CONFIG,
  loadReceiptAIConfig,
  saveReceiptAIConfig,
  structureReceiptWithAI,
  type ReceiptAIConfig,
} from "@/lib/receipt-ai";
import { parseReceipt, type ReceiptResult } from "@/lib/receipt-parser";

const B = "#23675f";

// ================================================================
// 類型（嚴格按 receipt_extract_zh_hk.md 字段定義）
// ================================================================

interface OCRResult {
  amount: number | null; currency: string; date: string;
  payer: string; purpose: string; confidence: "low"|"medium"|"high";
  warnings: string[]; raw_text: string;
}

interface Props { open: boolean; onClose: () => void; onConfirm: (data: OCRResult) => void; }

function fromWorkerStructured(
  structured: ServerStructuredResult | undefined,
  rawText: string,
): ReceiptResult | null {
  if (!structured?.fields) return null;
  const fields = structured.fields;
  const amount = typeof fields.amount === "number" && Number.isFinite(fields.amount) && fields.amount >= 0
    ? fields.amount
    : null;
  const confidence = structured.confidence === "high" || structured.confidence === "medium"
    ? structured.confidence
    : "low";
  return {
    fields: {
      amount,
      currency: "HKD",
      date: typeof fields.date === "string" ? fields.date : "",
      payer: typeof fields.payer === "string" ? fields.payer : "",
      purpose: typeof fields.purpose === "string" ? fields.purpose : "",
    },
    confidence,
    warnings: structured.warnings,
    raw_text: structured.rawText || rawText,
  };
}

function mergeConservativeResults(
  worker: ReceiptResult | null,
  local: ReceiptResult,
): ReceiptResult {
  if (!worker) return local;
  const amount = worker.fields.amount ?? local.fields.amount;
  return {
    fields: {
      amount,
      currency: "HKD",
      date: worker.fields.date || local.fields.date,
      payer: worker.fields.payer || local.fields.payer,
      purpose: worker.fields.purpose || local.fields.purpose,
    },
    confidence: amount === null ? "low" : (
      worker.confidence === "high" && local.confidence === "high" ? "high" : "medium"
    ),
    warnings: Array.from(new Set([...worker.warnings, ...local.warnings])),
    raw_text: worker.raw_text || local.raw_text,
  };
}

// ================================================================
// 組件
// ================================================================

export default function UploadReceiptDialog({ open, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<"upload"|"review">("upload");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocr, setOcr] = useState<OCRResult|null>(null);
  const [edit, setEdit] = useState<OCRResult|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [statusText, setStatusText] = useState("OCR 識別中...");
  const [analysisSource, setAnalysisSource] = useState("");
  const [aiConfig, setAiConfig] = useState<ReceiptAIConfig>({
    ...DEFAULT_RECEIPT_AI_CONFIG,
  });

  useEffect(() => {
    if (open) setAiConfig(loadReceiptAIConfig());
  }, [open]);

  if (!open) return null;

  const updateAIConfig = (patch: Partial<ReceiptAIConfig>) => {
    setAiConfig((current) => {
      const next = { ...current, ...patch };
      saveReceiptAIConfig(next);
      return next;
    });
  };

  /**
   * 處理文件上傳 → 真實 OCR 識別 → 字段解析
   */
  const handleUpload = async (file: File) => {
    if (aiConfig.mode === "deepseek" && !aiConfig.apiKey.trim()) {
      setError("請先輸入 DeepSeek API Key，或改用「僅本地規則」");
      return;
    }
    if (aiConfig.mode === "deepseek" && !aiConfig.model.trim().startsWith("deepseek-")) {
      setError("DeepSeek 模型名稱必須以 deepseek- 開頭");
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(0);
    setStatusText("PaddleOCR 識別中...");

    try {
      // 1. OCR 識別
      const recognized = await recognizeWithServerFallback(file, {
        module: "finance",
        jobType: "receipt",
        language: "chi_sim+eng",
        onProgress: (pct) => setProgress(Math.round(pct * 100)),
      });

      // 2. 優先用 AI Prompt 做語義結構化；失敗時採用保守的 Worker / 本地規則。
      let parsed: ReceiptResult;
      if (aiConfig.mode === "deepseek") {
        setStatusText("DeepSeek Prompt 正在整理欄位...");
        setProgress((value) => Math.max(value, 95));
        try {
          parsed = await structureReceiptWithAI(recognized.ocr, aiConfig, {
            engine: recognized.engine,
            fileId: recognized.fileId,
          });
          setAnalysisSource(`DeepSeek Prompt（${aiConfig.model}）`);
        } catch (aiError) {
          const fallback = mergeConservativeResults(
            fromWorkerStructured(recognized.structured, recognized.ocr.text),
            parseReceipt(recognized.ocr),
          );
          const reason = aiError instanceof Error ? aiError.message : "AI 結構化失敗";
          parsed = {
            ...fallback,
            warnings: [
              `AI 欄位結構化未完成，已改用保守規則：${reason}`,
              ...fallback.warnings,
            ],
          };
          setAnalysisSource(recognized.structured ? "PaddleOCR + 保守規則" : "PaddleOCR 本地規則");
        }
      } else {
        parsed = mergeConservativeResults(
          fromWorkerStructured(recognized.structured, recognized.ocr.text),
          parseReceipt(recognized.ocr),
        );
        setAnalysisSource(recognized.structured ? "PaddleOCR + 保守規則" : "PaddleOCR 本地規則");
      }
      const warnings = [...parsed.warnings];
      if (recognized.fallbackReason) {
        warnings.unshift(`後端 OCR 不可用，已改用瀏覽器識別：${recognized.fallbackReason}`);
      }

      // 3. 轉為組件使用的格式
      const result: OCRResult = {
        amount: parsed.fields.amount,
        currency: parsed.fields.currency,
        date: parsed.fields.date,
        payer: parsed.fields.payer,
        purpose: parsed.fields.purpose,
        confidence: parsed.confidence,
        warnings: parsed.warnings,
        raw_text: parsed.raw_text,
      };

      setOcr(result);
      setEdit({ ...result });
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OCR 識別失敗";
      setError(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const close = () => {
    setStep("upload"); setOcr(null); setEdit(null); setError(null);
    setAnalysisSource(""); setStatusText("OCR 識別中...");
    onClose();
  };

  const confirm = () => {
    if (edit) onConfirm(edit);
    close();
  };

  const upd = (f: keyof OCRResult, v: string|number|null) => {
    if (!edit) return;
    setEdit({ ...edit, [f]: v });
  };

  // ── 樣式工具 ──
  const confClass = (c: string) =>
    c === "high" ? "text-[#027a48]" : c === "medium" ? "text-[#936a00]" : "text-[#b42318]";
  const confLabel = (c: string) =>
    c === "high" ? "高" : c === "medium" ? "中" : "低";
  const confBadgeClass = (c: string) =>
    c === "high" ? "bg-[#ecfdf3] text-[#027a48]" :
    c === "medium" ? "bg-[#fffaeb] text-[#936a00]" :
    "bg-[#fef3f2] text-[#b42318]";

  // ================================================================
  // 面板
  // ================================================================
  const panel = (
    <div
      className="bg-white rounded-lg border border-[#d8dee6] w-full max-h-[calc(100vh-96px)] overflow-auto"
      style={{ boxShadow: "0 10px 30px rgba(16,24,40,0.08)" }}
    >
      {/* 標題欄 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d8dee6]">
        <h3 className="text-[16px] font-bold text-[#1d2939]">上傳收據</h3>
        <button onClick={close} className="p-1 rounded hover:bg-[#f1f5f8] text-[#667085]">
          <X size={20} />
        </button>
      </div>

      <div className="p-4">
        {/* ═══ 步驟1：上傳 ═══ */}
        {step === "upload" && (
          <div className="space-y-3">
            <p className="text-sm text-[#667085]">
              拍照或上傳手寫收據，系統將自動識別金額、日期、付款人等信息
            </p>

            <div className="space-y-2 rounded-lg border border-[#d8dee6] bg-[#f8fafc] p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#344054]">結構化方式</label>
                  <select
                    value={aiConfig.mode}
                    onChange={(event) => updateAIConfig({ mode: event.target.value as ReceiptAIConfig["mode"] })}
                    className="w-full rounded-lg border border-[#d8dee6] bg-white px-2 py-2 text-sm focus:border-[#23675f] focus:outline-none"
                  >
                    <option value="deepseek">DeepSeek Prompt</option>
                    <option value="local">僅本地規則</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#344054]">模型</label>
                  <input
                    list="deepseek-receipt-models"
                    value={aiConfig.model}
                    disabled={aiConfig.mode !== "deepseek"}
                    onChange={(event) => updateAIConfig({ model: event.target.value })}
                    className="w-full rounded-lg border border-[#d8dee6] bg-white px-2 py-2 text-sm focus:border-[#23675f] focus:outline-none disabled:bg-[#eef2f6]"
                  />
                  <datalist id="deepseek-receipt-models">
                    <option value="deepseek-v4-flash" />
                    <option value="deepseek-v4-pro" />
                  </datalist>
                </div>
              </div>
              {aiConfig.mode === "deepseek" && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#344054]">DeepSeek API Key</label>
                  <input
                    type="password"
                    value={aiConfig.apiKey}
                    onChange={(event) => updateAIConfig({ apiKey: event.target.value })}
                    placeholder="sk-..."
                    autoComplete="off"
                    className="w-full rounded-lg border border-[#d8dee6] bg-white px-2 py-2 text-sm focus:border-[#23675f] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] leading-4 text-[#667085]">
                    Key 僅保存在本瀏覽器分頁會話；OCR 文字（不含原圖）會傳送至 DeepSeek，Key 不會寫入資料庫或任務佇列。
                  </p>
                </div>
              )}
            </div>

            <UploadDropzone
              accept="image/*,.pdf"
              maxSizeMB={10}
              onUpload={handleUpload}
              uploading={uploading}
              label="拖拽收據圖片到此處，或點擊上傳"
            />

            {/* OCR 進行中 */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold" style={{ color: B }}>
                  <Sparkles size={16} className="animate-pulse" />
                  {statusText}
                  {progress > 0 && <span className="text-xs font-normal">{progress}%</span>}
                </div>
                {/* 進度條 */}
                {progress > 0 && (
                  <div className="w-full bg-[#f1f5f8] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%`, background: B }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 錯誤提示 */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-sm text-[#b42318]">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">識別失敗</p>
                  <p className="text-xs mt-0.5">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-1 text-xs underline hover:no-underline"
                  >
                    重試
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ 步驟2：確認 ═══ */}
        {step === "review" && ocr && edit && (
          <div className="space-y-3">
            {/* 信心提示 */}
            <div
              className="grid grid-cols-[1fr_auto] gap-2 items-center p-[9px] rounded-lg border"
              style={{
                borderColor: ocr.confidence === "high" ? "#a6e0c0" :
                  ocr.confidence === "medium" ? "#fedf89" : "#fecaca",
                background: ocr.confidence === "high" ? "#f0fdf4" :
                  ocr.confidence === "medium" ? "#fffaeb" : "#fef2f2",
              }}
            >
              <div>
                <strong className="text-sm">AI 識別信心：{confLabel(ocr.confidence)}</strong>
                <div className="text-xs text-[#667085] mt-0.5">
                  請確認以下欄位，可手動修正
                  {analysisSource && <span className="ml-1">· {analysisSource}</span>}
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full px-[7px] py-[3px] text-[11px] font-bold whitespace-nowrap ${confBadgeClass(ocr.confidence)}`}>
                {ocr.confidence === "high" ? "高置信度" :
                 ocr.confidence === "medium" ? "需複核" : "待確認"}
              </span>
            </div>

            {/* 警告列表 */}
            {ocr.warnings.length > 0 && (
              <div className="p-2 rounded border border-[#fedf89] bg-[#fffaeb] text-xs text-[#936a00] space-y-0.5">
                {ocr.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 可編輯字段 */}
            <div className="space-y-3">
              {/* 日期 */}
              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">
                  日期 {!edit.date && <span className="text-[#b42318] text-xs font-normal">（待填寫）</span>}
                </label>
                <input
                  type="date"
                  value={edit.date}
                  onChange={(e) => upd("date", e.target.value)}
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                />
              </div>

              {/* 金額 + 付款人 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-bold text-[#344054] mb-1">
                    金額 {edit.amount === null && <span className="text-[#b42318] text-xs font-normal">（待填寫）</span>}
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-[#667085]">{edit.currency}</span>
                    <input
                      type="number"
                      value={edit.amount ?? ""}
                      onChange={(e) => upd("amount", e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0.00"
                      className="flex-1 text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[#344054] mb-1">
                    付款人 {!edit.payer && <span className="text-[#667085] text-xs font-normal">（可選）</span>}
                  </label>
                  <input
                    type="text"
                    value={edit.payer}
                    onChange={(e) => upd("payer", e.target.value)}
                    placeholder="付款人姓名"
                    className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                  />
                </div>
              </div>

              {/* 用途 */}
              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">
                  用途 {!edit.purpose && <span className="text-[#b42318] text-xs font-normal">（待填寫）</span>}
                </label>
                <input
                  type="text"
                  value={edit.purpose}
                  onChange={(e) => upd("purpose", e.target.value)}
                  placeholder="如：中六畢業禮活動經費"
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                />
              </div>

              {/* OCR 原始文本（可摺疊） */}
              <details className="text-xs text-[#667085]">
                <summary className="cursor-pointer hover:text-[#1d2939] font-bold">
                  查看 OCR 原始識別文本
                </summary>
                <pre className="mt-1 p-2 bg-[#f1f5f8] rounded text-xs whitespace-pre-wrap max-h-[120px] overflow-auto">
                  {ocr.raw_text || "（無文本）"}
                </pre>
              </details>
            </div>

            {/* 操作按鈕 */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#d8dee6]">
              <button
                onClick={() => { setStep("upload"); setError(null); }}
                className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg border border-[#d8dee6] font-bold"
              >
                重新上傳
              </button>
              <button
                onClick={close}
                className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg font-bold"
              >
                取消
              </button>
              <button
                onClick={confirm}
                style={{ background: B, borderColor: B }}
                className="px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90"
              >
                確認入庫
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0,
        width: "100vw", height: "100vh", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 18, background: "rgba(16,24,40,0.45)",
      }}
      onClick={close}
    >
      <div className="w-full max-w-[480px]" onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
