"use client";

import { useState } from "react";
import { X, Sparkles, AlertTriangle } from "lucide-react";
import UploadDropzone from "@/components/ui/UploadDropzone";
import { recognizeImage } from "@/lib/ocr-engine";
import { parseReceipt, type ReceiptResult } from "@/lib/receipt-parser";
import { api } from "@/lib/api";

const B = "#23675f";

interface OCRResult {
  amount: number | null; currency: string; date: string;
  payer: string; purpose: string; confidence: "low"|"medium"|"high";
  warnings: string[]; raw_text: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExpenseReceiptDialog({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"upload"|"review">("upload");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ocr, setOcr] = useState<OCRResult|null>(null);
  const [edit, setEdit] = useState<OCRResult|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [expProject, setExpProject] = useState("");
  const [expSupplier, setExpSupplier] = useState("");
  const [expInvoice, setExpInvoice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleUpload = async (file: File) => {
    setUploading(true); setError(null); setProgress(0);
    try {
      const ocrResult = await recognizeImage(file, {
        language: "chi_sim+eng",
        onProgress: (pct) => setProgress(Math.round(pct * 100)),
      });
      const parsed: ReceiptResult = parseReceipt(ocrResult);
      const result: OCRResult = {
        amount: parsed.fields.amount, currency: parsed.fields.currency,
        date: parsed.fields.date, payer: parsed.fields.payer,
        purpose: parsed.fields.purpose, confidence: parsed.confidence,
        warnings: parsed.warnings, raw_text: parsed.raw_text,
      };
      setOcr(result); setEdit({ ...result });
      setExpProject(parsed.fields.purpose || "");
      setExpSupplier(parsed.fields.payer || "");
      setExpInvoice("");
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR 識別失敗");
    } finally {
      setUploading(false); setProgress(0);
    }
  };

  const close = () => {
    setStep("upload"); setOcr(null); setEdit(null); setError(null);
    setExpProject(""); setExpSupplier(""); setExpInvoice("");
    onClose();
  };

  const confirm = async () => {
    setSubmitting(true); setError(null);
    try {
      await api.post("/apple/finance/expense", {
        type: "expense",
        date: edit?.date || new Date().toISOString().slice(0, 10),
        project: expProject.trim() || edit?.purpose || "未指定項目",
        amount: edit?.amount ?? 0,
        handler: edit?.payer || "未知",
        supplier: expSupplier.trim() || undefined,
        invoice_no: expInvoice.trim() || undefined,
      });
      onSuccess();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const confLabel = (c: string) => c === "high" ? "高" : c === "medium" ? "中" : "低";
  const confBadgeClass = (c: string) =>
    c === "high" ? "bg-[#ecfdf3] text-[#027a48]" :
    c === "medium" ? "bg-[#fffaeb] text-[#936a00]" : "bg-[#fef3f2] text-[#b42318]";
  const inputClass = "w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]";
  const labelClass = "block text-[13px] font-bold text-[#344054] mb-1";

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(16,24,40,0.45)" }}
      onClick={close}>
      <div className="w-full max-w-[480px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg border border-[#d8dee6]" style={{ boxShadow: "0 10px 30px rgba(16,24,40,0.08)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#d8dee6]">
            <h3 className="text-[16px] font-bold text-[#1d2939]">拍照識別發票</h3>
            <button onClick={close} className="p-1 rounded hover:bg-[#f1f5f8] text-[#667085]"><X size={20} /></button>
          </div>
          <div className="p-4">
            {step === "upload" && (
              <div className="space-y-3">
                <p className="text-sm text-[#667085]">拍照或上傳發票，自動識別金額、供應商、項目等信息</p>
                <UploadDropzone accept="image/*,.pdf" maxSizeMB={10} onUpload={handleUpload} uploading={uploading} label="拖拽發票到此處，或點擊上傳" />
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold" style={{ color: B }}>
                      <Sparkles size={16} className="animate-pulse" />AI OCR 識別中...{progress > 0 && <span className="text-xs font-normal">{progress}%</span>}
                    </div>
                    {progress > 0 && <div className="w-full bg-[#f1f5f8] rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: B }} /></div>}
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-sm text-[#b42318]">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /><div><p className="font-bold">識別失敗</p><p className="text-xs mt-0.5">{error}</p></div>
                  </div>
                )}
              </div>
            )}

            {step === "review" && ocr && edit && (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center p-[9px] rounded-lg border" style={{
                  borderColor: ocr.confidence === "high" ? "#a6e0c0" : ocr.confidence === "medium" ? "#fedf89" : "#fecaca",
                  background: ocr.confidence === "high" ? "#f0fdf4" : ocr.confidence === "medium" ? "#fffaeb" : "#fef2f2" }}>
                  <div><strong className="text-sm">AI 識別信心：{confLabel(ocr.confidence)}</strong><div className="text-xs text-[#667085] mt-0.5">請確認以下欄位</div></div>
                  <span className={`inline-flex items-center rounded-full px-[7px] py-[3px] text-[11px] font-bold ${confBadgeClass(ocr.confidence)}`}>{ocr.confidence === "high" ? "高置信度" : ocr.confidence === "medium" ? "需複核" : "待確認"}</span>
                </div>
                {ocr.warnings.length > 0 && (
                  <div className="p-2 rounded border border-[#fedf89] bg-[#fffaeb] text-xs text-[#936a00] space-y-0.5">
                    {ocr.warnings.map((w, i) => <div key={i} className="flex items-start gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" /><span>{w}</span></div>)}
                  </div>
                )}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>日期</label><input type="date" value={edit.date} onChange={e => setEdit({...edit, date: e.target.value})} className={inputClass} /></div>
                    <div><label className={labelClass}>金額 {edit.amount === null && <span className="text-[#b42318] text-xs">（待填寫）</span>}</label><input type="number" value={edit.amount ?? ""} onChange={e => setEdit({...edit, amount: e.target.value ? parseFloat(e.target.value) : null})} placeholder="0.00" className={inputClass} /></div>
                  </div>
                  <div><label className={labelClass}>項目名稱</label><input type="text" value={expProject} onChange={e => setExpProject(e.target.value)} placeholder="如：辦公用品採購" className={inputClass} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>供應商</label><input type="text" value={expSupplier} onChange={e => setExpSupplier(e.target.value)} placeholder="供應商名稱" className={inputClass} /></div>
                    <div><label className={labelClass}>發票號</label><input type="text" value={expInvoice} onChange={e => setExpInvoice(e.target.value)} placeholder="INV-2026-XXXX" className={inputClass} /></div>
                  </div>
                  <details className="text-xs text-[#667085]"><summary className="cursor-pointer hover:text-[#1d2939] font-bold">查看 OCR 原始文本</summary><pre className="mt-1 p-2 bg-[#f1f5f8] rounded text-xs whitespace-pre-wrap max-h-[120px] overflow-auto">{ocr.raw_text || "（無文本）"}</pre></details>
                </div>
                {error && <div className="p-2 rounded border border-[#fecaca] bg-[#fef2f2] text-xs text-[#b42318]">{error}</div>}
                <div className="flex justify-end gap-2 pt-2 border-t border-[#d8dee6]">
                  <button onClick={() => { setStep("upload"); setError(null); }} className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg border border-[#d8dee6] font-bold">重新上傳</button>
                  <button onClick={close} className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg font-bold">取消</button>
                  <button onClick={confirm} disabled={submitting} style={{ background: B }} className="px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50">{submitting ? "提交中..." : "確認入庫"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
