"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

const B = "#23675f";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ExpenseCreateDialog({ open, onClose, onSuccess }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [project, setProject] = useState("");
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [handler, setHandler] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async () => {
    setError("");
    if (!project.trim()) { setError("請輸入項目名稱"); return; }
    if (!amount || parseFloat(amount) <= 0) { setError("請輸入有效金額"); return; }
    if (!handler.trim()) { setError("請輸入經手人"); return; }

    setSubmitting(true);
    try {
      await api.post("/apple/finance/expense", {
        type: "expense",
        date,
        project: project.trim(),
        amount: parseFloat(amount),
        handler: handler.trim(),
        supplier: supplier.trim() || undefined,
        invoice_no: invoiceNo.trim() || undefined,
      });
      onSuccess();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setProject(""); setAmount(""); setSupplier(""); setInvoiceNo(""); setHandler("");
    setError("");
    onClose();
  };

  const inputClass = "w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]";
  const labelClass = "block text-[13px] font-bold text-[#344054] mb-1";

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(16,24,40,0.45)" }}
      onClick={close}>
      <div className="w-full max-w-[440px]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg border border-[#d8dee6]" style={{ boxShadow: "0 10px 30px rgba(16,24,40,0.08)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#d8dee6]">
            <h3 className="text-[16px] font-bold text-[#1d2939]">新增支出</h3>
            <button onClick={close} className="p-1 rounded hover:bg-[#f1f5f8] text-[#667085]"><X size={20} /></button>
          </div>
          <div className="p-4 space-y-3">
            <div><label className={labelClass}>日期</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>項目名稱 <span className="text-[#b42318]">*</span></label><input type="text" value={project} onChange={e => setProject(e.target.value)} placeholder="如：辦公用品採購" className={inputClass} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>金額 (HKD) <span className="text-[#b42318]">*</span></label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" className={inputClass} /></div>
              <div><label className={labelClass}>供應商</label><input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="供應商名稱" className={inputClass} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>發票號</label><input type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="INV-2026-XXXX" className={inputClass} /></div>
              <div><label className={labelClass}>經手人 <span className="text-[#b42318]">*</span></label><input type="text" value={handler} onChange={e => setHandler(e.target.value)} placeholder="經手人姓名" className={inputClass} /></div>
            </div>
            {error && <div className="p-2 rounded border border-[#fecaca] bg-[#fef2f2] text-xs text-[#b42318]">{error}</div>}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#d8dee6]">
              <button onClick={close} className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg font-bold">取消</button>
              <button onClick={submit} disabled={submitting} style={{ background: B }} className="px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50">{submitting ? "提交中..." : "確認"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
