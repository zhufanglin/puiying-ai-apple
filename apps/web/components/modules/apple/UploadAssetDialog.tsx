"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, AlertTriangle, CheckCircle } from "lucide-react";
import UploadDropzone from "@/components/ui/UploadDropzone";
import { recognizeWithServerFallback } from "@/lib/ocr-api";
import {
  DEFAULT_INVOICE_AI_CONFIG,
  loadInvoiceAIConfig,
  saveInvoiceAIConfig,
  structureInvoiceWithAI,
  type InvoiceAIConfig,
} from "@/lib/invoice-ai";
import { parseInvoice, type InvoiceResult } from "@/lib/invoice-parser";

const B = "#23675f";

function buildInvoiceRemark(result: InvoiceResult): string {
  const parts: string[] = [];
  if (result.vendor) parts.push(`供應商：${result.vendor}`);
  if (result.invoiceNo) parts.push(`發票號：${result.invoiceNo}`);
  return parts.join("；");
}

// ================================================================
// 類型
// ================================================================

interface Props {
  open: boolean; onClose: () => void;
  onConfirm: (data: {
    assetNo: string; name: string; category: string;
    location: string; purchaseDate: string;
    purchaseAmount: number; remark: string;
    fileId?: number;
  }) => Promise<void>;
}

// ================================================================
// 組件
// ================================================================

export default function UploadAssetDialog({ open, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<"upload"|"review">("upload");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocr, setOcr] = useState<InvoiceResult|null>(null);
  const [fileId, setFileId] = useState<number|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [fileId, setFileId] = useState<number|null>(null);
  const [statusText, setStatusText] = useState("OCR 識別中...");
  const [analysisSource, setAnalysisSource] = useState("");
  const [aiConfig, setAiConfig] = useState<InvoiceAIConfig>({
    ...DEFAULT_INVOICE_AI_CONFIG,
  });
  const [form, setForm] = useState({
    assetNo: "", name: "", category: "", location: "",
    purchaseDate: "", purchaseAmount: "", remark: "",
  });
  const uploadRequestRef = useRef(0);

  useEffect(() => {
    if (open) {
      setAiConfig(loadInvoiceAIConfig());
    } else {
      // 百度 OCR／DeepSeek 未必支持浏览器取消；用请求编号忽略已关闭弹窗的旧结果。
      uploadRequestRef.current += 1;
    }
  }, [open]);

  if (!open) return null;

  const updateAIConfig = (patch: Partial<InvoiceAIConfig>) => {
    setAiConfig((current) => {
      const next = { ...current, ...patch };
      saveInvoiceAIConfig(next);
      return next;
    });
  };

  /**
   * 處理發票上傳 → 百度 OCR → DeepSeek Prompt（可選）→ 保守回退 → 表單
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
    setStatusText("百度 OCR 識別中...");
    const requestId = ++uploadRequestRef.current;

    try {
      // 1. 優先後端百度 OCR；不可用時回退瀏覽器 Tesseract.js
      const recognized = await recognizeWithServerFallback(file, {
        module: "assets",
        jobType: "invoice",
        language: "chi_tra+chi_sim+eng",
        onProgress: (pct) => {
          if (requestId === uploadRequestRef.current) {
            setProgress(Math.round(pct * 100));
          }
        },
      });
      if (requestId !== uploadRequestRef.current) return;

      // 2. 優先用專用 Prompt 做語義結構化；失敗時採用保守本地規則。
      let parsed: InvoiceResult;
      if (aiConfig.mode === "deepseek") {
        setStatusText("DeepSeek Prompt 正在整理發票欄位...");
        setProgress((value) => Math.max(value, 95));
        try {
          parsed = await structureInvoiceWithAI(recognized.ocr, aiConfig, {
            engine: recognized.engine,
            fileId: recognized.fileId,
          });
          if (requestId !== uploadRequestRef.current) return;
          setAnalysisSource(`DeepSeek Prompt（${aiConfig.model}）`);
        } catch (aiError) {
          if (requestId !== uploadRequestRef.current) return;
          const fallback = parseInvoice(recognized.ocr);
          const reason = aiError instanceof Error ? aiError.message : "AI 結構化失敗";
          parsed = {
            ...fallback,
            warnings: [
              `AI 欄位結構化未完成，已改用保守規則：${reason}`,
              ...fallback.warnings,
            ],
          };
          setAnalysisSource("瀏覽器保守規則");
        }
      } else {
        parsed = parseInvoice(recognized.ocr);
        setAnalysisSource("瀏覽器保守規則");
      }
      if (requestId !== uploadRequestRef.current) return;

      if (recognized.fallbackReason) {
        parsed.warnings.unshift(`百度 OCR 不可用，已改用瀏覽器識別：${recognized.fallbackReason}`);
      }

      setOcr(parsed);

      // 3. 自動填充表單
      setForm({
        assetNo: "",
        name: parsed.assetName,
        category: parsed.category,
        location: "",
        purchaseDate: parsed.purchaseDate,
        purchaseAmount: parsed.amount > 0 ? String(parsed.amount) : "",
        // 供應商與發票號分開記錄，絕不互相代填。
        remark: buildInvoiceRemark(parsed),
      });

      setStep("review");
    } catch (err) {
      if (requestId !== uploadRequestRef.current) return;
      const msg = err instanceof Error ? err.message : "OCR 識別失敗";
      setError(msg);
    } finally {
      if (requestId === uploadRequestRef.current) {
        setUploading(false);
        setProgress(0);
      }
    }
  };

  const close = () => {
    uploadRequestRef.current += 1;
    setStep("upload"); setOcr(null); setFileId(null); setError(null);
    setUploading(false); setSaving(false); setProgress(0);
    setAnalysisSource(""); setStatusText("OCR 識別中...");
    setForm({ assetNo: "", name: "", category: "", location: "", purchaseDate: "", purchaseAmount: "", remark: "" });
    onClose();
  };

  const confirm = async () => {
    if (!form.name || !form.category || !form.location) {
      alert("請填寫資產名稱、類別和地點");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        ...form,
        purchaseAmount: parseFloat(form.purchaseAmount) || 0,
        fileId: fileId ?? undefined,
      });
      setSuccess(true);
      setTimeout(() => close(), 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "資產未能寫入後端";
      setError(message);
    } finally {
      setSaving(false);
    }
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
        <h3 className="text-[16px] font-bold text-[#1d2939]">上傳發票登記資產</h3>
        <button
          onClick={close}
          disabled={saving}
          className="p-1 rounded hover:bg-[#f1f5f8] text-[#667085] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4">
        {/* ═══ 步驟1：上傳 ═══ */}
        {step === "upload" && (
          <div className="space-y-3">
            <p className="text-sm text-[#667085]">
              拍照或上傳購買發票，系統將自動識別資產名稱、類別、金額、購買日期等信息
            </p>

            <div className="space-y-2 rounded-lg border border-[#d8dee6] bg-[#f8fafc] p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#344054]">結構化方式</label>
                  <select
                    value={aiConfig.mode}
                    onChange={(event) => updateAIConfig({ mode: event.target.value as InvoiceAIConfig["mode"] })}
                    className="w-full rounded-lg border border-[#d8dee6] bg-white px-2 py-2 text-sm focus:border-[#23675f] focus:outline-none"
                  >
                    <option value="deepseek">DeepSeek Prompt</option>
                    <option value="local">僅本地規則</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#344054]">模型</label>
                  <input
                    list="deepseek-invoice-models"
                    value={aiConfig.model}
                    disabled={aiConfig.mode !== "deepseek"}
                    onChange={(event) => updateAIConfig({ model: event.target.value })}
                    className="w-full rounded-lg border border-[#d8dee6] bg-white px-2 py-2 text-sm focus:border-[#23675f] focus:outline-none disabled:bg-[#eef2f6]"
                  />
                  <datalist id="deepseek-invoice-models">
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
                    Key 僅保存在本瀏覽器分頁會話；OCR 文字（不含發票原圖）會傳送至 DeepSeek，Key 不會寫入資料庫或任務佇列。
                  </p>
                </div>
              )}
            </div>

            <UploadDropzone
              accept="image/*,.pdf"
              maxSizeMB={10}
              onUpload={handleUpload}
              uploading={uploading}
              label="拖拽發票圖片到此處，或點擊上傳"
            />

            {/* OCR 進行中 */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold" style={{ color: B }}>
                  <Sparkles size={16} className="animate-pulse" />
                  {statusText}
                  {progress > 0 && <span className="text-xs font-normal">{progress}%</span>}
                </div>
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
                  <button onClick={() => setError(null)} className="mt-1 text-xs underline hover:no-underline">
                    重試
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ 步驟2：確認 ═══ */}
        {step === "review" && ocr && (
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
                  請核對自動填充資料，存放地點必須由使用者選擇
                  {analysisSource && <span className="ml-1">· {analysisSource}</span>}
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full px-[7px] py-[3px] text-[11px] font-bold whitespace-nowrap ${confBadgeClass(ocr.confidence)}`}>
                {ocr.confidence === "high" ? "高置信度" :
                 ocr.confidence === "medium" ? "需複核" : "待確認"}
              </span>
            </div>

            {/* 警告 */}
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

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b42318]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">資產入庫失敗</p>
                  <p className="mt-0.5 text-xs">{error}</p>
                  <p className="mt-1 text-xs">資料尚未保存，請檢查後端連線或權限後重試。</p>
                </div>
              </div>
            )}

            {/* 表單字段 */}
            <fieldset disabled={saving} className="space-y-3 disabled:opacity-70">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-bold text-[#344054] mb-1">
                    資產名稱 <span className="text-[#b42318]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[#344054] mb-1">
                    類別 <span className="text-[#b42318]">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                  >
                    <option value="">請選擇</option>
                    {["IT設備", "傢俱", "電器", "辦公設備", "其他"].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-bold text-[#344054] mb-1">
                    購買金額（HKD）
                  </label>
                  <input
                    type="number"
                    value={form.purchaseAmount}
                    onChange={(e) => setForm((p) => ({ ...p, purchaseAmount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[#344054] mb-1">
                    購買日期
                  </label>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
                    className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">
                  存放地點 <span className="text-[#b42318]">*</span>
                </label>
                <select
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                >
                  <option value="">請選擇地點</option>
                  {["3樓教員室", "地下校務處", "4樓課室", "2樓實驗室", "1樓大堂", "操場倉庫"].map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">
                  備註
                </label>
                <input
                  type="text"
                  value={form.remark}
                  onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))}
                  placeholder="供應商信息、保修期等"
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"
                />
              </div>

              {/* OCR 原始文本 */}
              <details className="text-xs text-[#667085]">
                <summary className="cursor-pointer hover:text-[#1d2939] font-bold">
                  查看 OCR 原始識別文本
                </summary>
                <pre className="mt-1 p-2 bg-[#f1f5f8] rounded text-xs whitespace-pre-wrap max-h-[120px] overflow-auto">
                  {ocr.raw_text || "（無文本）"}
                </pre>
              </details>
            </fieldset>

            {/* 操作按鈕 */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#d8dee6]">
              <button
                onClick={() => { setStep("upload"); setError(null); }}
                disabled={saving}
                className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg border border-[#d8dee6] font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                重新上傳
              </button>
              <button
                onClick={close}
                disabled={saving}
                className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirm}
                disabled={saving}
                style={{ background: B, borderColor: B }}
                className="px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? "入庫中..." : "確認入庫"}
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
      onClick={() => { if (!saving) close(); }}
    >
      {/* 成功提示 — 在弹窗上方，不受內部 step 影響 */}
      {success && (
        <div style={{
          position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 60, display: "flex", alignItems: "center", gap: 10,
          padding: "14px 22px", borderRadius: 10,
          background: "#f0fdf4", border: "1px solid #a6e0c0",
          boxShadow: "0 10px 30px rgba(16,24,40,0.15)",
        }}>
          <CheckCircle size={22} color="#027a48" />
          <div>
            <p style={{color:"#027a48", fontWeight:800, fontSize:15, margin:0}}>登記入庫成功</p>
            <p style={{color:"#667085", fontSize:12, margin:"2px 0 0"}}>資產已保存至系統</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-[480px]" onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
