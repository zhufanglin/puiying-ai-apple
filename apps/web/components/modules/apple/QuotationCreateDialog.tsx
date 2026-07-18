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

export default function QuotationCreateDialog({ open, onClose, onSuccess }: Props) {
  const [projectName, setProjectName] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async () => {
    setError("");
    if (!projectName.trim()) { setError("請輸入項目名稱"); return; }
    if (!vendor.trim()) { setError("請輸入報價單位"); return; }
    if (!amount || parseFloat(amount) <= 0) { setError("請輸入有效金額"); return; }

    setSubmitting(true);
    try {
      await api.post("/apple/finance/quotations", {
        project_name: projectName.trim(),
        vendor: vendor.trim(),
        amount: parseFloat(amount),
        is_lowest: false,
        is_selected: false,
        remark: remark.trim() || undefined,
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
    setProjectName(""); setVendor(""); setAmount(""); setRemark(""); setError("");
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
            <h3 className="text-[16px] font-bold text-[#1d2939]">新增報價單</h3>
            <button onClick={close} className="p-1 rounded hover:bg-[#f1f5f8] text-[#667085]"><X size={20} /></button>
          </div>
          <div className="p-4 space-y-3">
            <div><label className={labelClass}>項目名稱 <span className="text-[#b42318]">*</span></label><input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="如：校慶紀念品採購" className={inputClass} /></div>
            <div><label className={labelClass}>報價單位 <span className="text-[#b42318]">*</span></label><input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="如：精美禮品公司" className={inputClass} /></div>
            <div><label className={labelClass}>報價金額 (HKD) <span className="text-[#b42318]">*</span></label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" className={inputClass} /></div>
            <div><label className={labelClass}>備註</label><input type="text" value={remark} onChange={e => setRemark(e.target.value)} placeholder="如：品質優，交貨快" className={inputClass} /></div>
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
