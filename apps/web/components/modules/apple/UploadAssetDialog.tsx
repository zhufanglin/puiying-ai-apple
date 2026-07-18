"use client";

import { useState } from "react";
import { X, Sparkles, AlertTriangle } from "lucide-react";
import UploadDropzone from "@/components/ui/UploadDropzone";
import { recognizeImage } from "@/lib/ocr-engine";
import { parseInvoice, type InvoiceResult } from "@/lib/invoice-parser";

const B = "#23675f";

// ================================================================
// 类型
// ================================================================

interface Props {
  open: boolean; onClose: () => void;
  onConfirm: (data: {
    assetNo: string; name: string; category: string;
    location: string; purchaseDate: string;
    purchaseAmount: number; remark: string;
  }) => void;
}

// ================================================================
// 组件
// ================================================================

export default function UploadAssetDialog({ open, onClose, onConfirm }: Props) {
  const [step, setStep] = useState<"upload"|"review">("upload");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocr, setOcr] = useState<InvoiceResult|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [form, setForm] = useState({
    assetNo: "", name: "", category: "", location: "",
    purchaseDate: "", purchaseAmount: "", remark: "",
  });

  if (!open) return null;

  /**
   * 处理发票上传 → 真实 OCR 识别 → 字段解析 → 自动填充表单
   */
  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // 1. OCR 识别
      const ocrResult = await recognizeImage(file, {
        language: "chi_sim+eng",
        onProgress: (pct) => setProgress(Math.round(pct * 100)),
      });

      // 2. 解析发票字段
      const parsed: InvoiceResult = parseInvoice(ocrResult);

      setOcr(parsed);

      // 3. 自动填充表单
      setForm({
        assetNo: "",
        name: parsed.assetName,
        category: parsed.category,
        location: "",
        purchaseDate: parsed.purchaseDate,
        purchaseAmount: parsed.amount > 0 ? String(parsed.amount) : "",
        remark: parsed.vendor ? `供應商: ${parsed.vendor}` : "",
      });

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
    setStep("upload"); setOcr(null); setError(null);
    setForm({ assetNo: "", name: "", category: "", location: "", purchaseDate: "", purchaseAmount: "", remark: "" });
    onClose();
  };

  const confirm = () => {
    if (!form.name || !form.category || !form.location) {
      alert("請填寫資產名稱、類別和地點");
      return;
    }
    onConfirm({
      ...form,
      purchaseAmount: parseFloat(form.purchaseAmount) || 0,
    });
    close();
  };

  // ── 样式工具 ──
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
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d8dee6]">
        <h3 className="text-[16px] font-bold text-[#1d2939]">上傳發票登記資產</h3>
        <button onClick={close} className="p-1 rounded hover:bg-[#f1f5f8] text-[#667085]">
          <X size={20} />
        </button>
      </div>

      <div className="p-4">
        {/* ═══ 步骤1：上传 ═══ */}
        {step === "upload" && (
          <div className="space-y-3">
            <p className="text-sm text-[#667085]">
              拍照或上傳購買發票，系統將自動識別資產名稱、類別、金額、購買日期等信息
            </p>

            <UploadDropzone
              accept="image/*,.pdf"
              maxSizeMB={10}
              onUpload={handleUpload}
              uploading={uploading}
              label="拖拽發票圖片到此處，或點擊上傳"
            />

            {/* OCR 进行中 */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold" style={{ color: B }}>
                  <Sparkles size={16} className="animate-pulse" />
                  AI OCR 識別中...
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

            {/* 错误提示 */}
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

        {/* ═══ 步骤2：确认 ═══ */}
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
                  已自動填充發票信息，請補充存放地點
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

            {/* 表单字段 */}
            <div className="space-y-3">
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
                    {["IT設備", "家具", "電器", "辦公設備", "其他"].map((o) => (
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
            </div>

            {/* 操作按钮 */}
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
