"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

const B = "#23675f";

interface AssetItem {
  id: number; assetNo: string; name: string; category: string;
  location: string; status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  asset: AssetItem | null;
  onConfirm: (data: { assetId: number; reason: string }) => void;
}

/**
 * 資產註銷彈窗 — 嚴格按文檔 §3 註銷 Tab 流程：
 * 申請註銷 → 填寫原因 → 提交審批
 *
 * 後端: POST /api/v1/apple/assets/{id}/writeoff
 * 流程: 更新 status=written_off → 創建 Approval → 寫 AuditLog
 */
export default function WriteoffDialog({ open, onClose, asset, onConfirm }: Props) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  const close = () => {
    setReason("");
    onClose();
  };

  const confirm = () => {
    if (!reason.trim()) {
      alert("請填寫註銷原因");
      return;
    }
    if (!asset) return;
    onConfirm({ assetId: asset.id, reason: reason.trim() });
    setReason("");
    close();
  };

  const panel = (
    <div
      className="bg-white rounded-lg border border-[#d8dee6] w-full"
      style={{ boxShadow: "0 10px 30px rgba(16,24,40,0.08)" }}
    >
      {/* 標題欄 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#d8dee6]">
        <h3 className="text-[16px] font-bold text-[#1d2939]">
          申請資產註銷
        </h3>
        <button onClick={close} className="p-1 rounded hover:bg-[#f1f5f8] text-[#667085]">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* 警告提示 — 註銷操作不可逆 */}
        <div className="flex items-start gap-2 p-3 rounded-lg border border-[#fedf89] bg-[#fffaeb] text-sm text-[#936a00]">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>注意</strong>
            <p className="text-xs mt-0.5">
              註銷後資產狀態將變為「已註銷」，需提交審批。此操作不可撤銷。
            </p>
          </div>
        </div>

        {/* 資產信息只讀展示 */}
        {asset && (
          <div className="bg-[#f8fafc] rounded-lg border border-[#d8dee6] p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[#667085]">資產編號</span>
              <span className="font-bold text-[#1d2939]">{asset.assetNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#667085]">資產名稱</span>
              <span className="text-[#1d2939]">{asset.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#667085]">類別</span>
              <span className="text-[#1d2939]">{asset.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#667085]">當前地點</span>
              <span className="text-[#1d2939]">{asset.location}</span>
            </div>
          </div>
        )}

        {/* 註銷原因 */}
        <div>
          <label className="block text-[13px] font-bold text-[#344054] mb-1">
            註銷原因 <span className="text-[#b42318]">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="如：燈泡老化無法維修、設備已報廢、超出使用年限..."
            rows={4}
            maxLength={500}
            className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f] resize-none"
          />
          <span className="text-xs text-[#667085] mt-0.5 block">
            {reason.length}/500
          </span>
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#d8dee6]">
        <button
          onClick={close}
          className="px-4 py-[8px] text-sm text-[#667085] hover:bg-[#f1f5f8] rounded-lg font-bold"
        >
          取消
        </button>
        <button
          onClick={confirm}
          style={{ background: "#b42318", borderColor: "#b42318" }}
          className="px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90"
        >
          確認註銷
        </button>
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
      <div className="w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
