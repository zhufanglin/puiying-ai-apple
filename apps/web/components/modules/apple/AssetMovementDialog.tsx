"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight } from "lucide-react";

const B = "#23675f";

interface AssetItem { id: number; assetNo: string; name: string; location: string; }

interface Props {
  open: boolean; onClose: () => void;
  assets: AssetItem[]; preselectedAsset: AssetItem|null;
  onConfirm: (data: { assetId:number; fromLocation:string; toLocation:string; movementDate:string; reason:string }) => void;
}

const LOCATIONS = ["3樓教員室","地下校務處","4樓課室","2樓實驗室","1樓大堂","操場倉庫"];

export default function AssetMovementDialog({ open, onClose, assets, preselectedAsset, onConfirm }: Props) {
  const [id, setId] = useState<number|null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (preselectedAsset) { setId(preselectedAsset.id); setFrom(preselectedAsset.location); setTo(""); setDate(new Date().toISOString().split("T")[0]); setReason(""); }
  }, [preselectedAsset]);

  if (!open) return null;

  const close = () => { setId(null); setFrom(""); setTo(""); setDate(new Date().toISOString().split("T")[0]); setReason(""); onClose(); };

  const confirm = () => {
    if (!id) { alert("請選擇資產"); return; }
    if (!to) { alert("請選擇目標地點"); return; }
    if (from===to) { alert("目標地點不能與當前地點相同"); return; }
    onConfirm({ assetId:id, fromLocation:from, toLocation:to, movementDate:date, reason });
    close();
  };

  const sel = assets.find(a=>a.id===id);

  const panel = (
    <div className="bg-white rounded-lg border border-[#d8dee6] w-full" style={{boxShadow:"0 10px 30px rgba(16,24,40,0.08)"}}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d8dee6]">
        <h3 className="text-[16px] font-bold text-[#1d2939]">資產搬移記錄</h3>
        <button onClick={close} className="p-1 rounded hover:bg-[#f1f5f8] text-[#667085]"><X size={20}/></button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-[13px] font-bold text-[#344054] mb-1">選擇資產 <span className="text-[#b42318]">*</span></label>
          <select value={id??""} onChange={e=>{ const i=parseInt(e.target.value); setId(i); const a=assets.find(x=>x.id===i); if(a) setFrom(a.location); }} className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]">
            <option value="">請選擇資產</option>
            {assets.map(a=><option key={a.id} value={a.id}>{a.assetNo} — {a.name}（{a.location}）</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-bold text-[#344054] mb-2">搬移路徑</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <span className="block text-xs text-[#667085] mb-1">從</span>
              <div className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] bg-[#f1f5f8] text-[#1d2939]">{from||"—"}</div>
            </div>
            <ArrowRight size={20} className="text-[#667085] mt-4 shrink-0"/>
            <div className="flex-1">
              <span className="block text-xs text-[#667085] mb-1">到 <span className="text-[#b42318]">*</span></span>
              <select value={to} onChange={e=>setTo(e.target.value)} className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]">
                <option value="">選擇目標地點</option>
                {LOCATIONS.filter(l=>l!==from).map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-[13px] font-bold text-[#344054] mb-1">搬移日期</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"/>
        </div>
        <div>
          <label className="block text-[13px] font-bold text-[#344054] mb-1">搬移原因</label>
          <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="如：教室重新規劃、統一管理、維修等" rows={3} className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f] resize-none"/>
        </div>
        {sel && to && (
          <div className="flex items-center gap-2 p-[10px] rounded-lg border" style={{borderColor:B,background:"#eef7f5",color:B}}>
            <ArrowRight size={14} className="shrink-0"/>
            <span className="text-sm font-bold">{sel.assetNo} {sel.name} 從 {from} → {to}</span>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#d8dee6]">
        <button onClick={close} className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg font-bold">取消</button>
        <button onClick={confirm} style={{background:B, borderColor:B}} className="px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90">確認搬移</button>
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:18,background:"rgba(16,24,40,0.45)"}} onClick={close}>
      <div className="w-full max-w-[400px]" onClick={e=>e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
