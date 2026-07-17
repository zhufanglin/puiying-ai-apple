"use client";

import { useState, useEffect } from "react";
import { Copy, Check, X, Loader2 } from "lucide-react";

import { awardApi } from "@/lib/services/awards";

interface ReadingScriptPopupProps {
  open: boolean;
  awardId: number;
  studentName: string;
  studentClass: string;
  onClose: () => void;
}

export default function ReadingScriptPopup({
  open,
  awardId,
  studentName,
  studentClass,
  onClose,
}: ReadingScriptPopupProps) {
  const [copied, setCopied] = useState(false);
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !awardId) return;
    setLoading(true);
    awardApi
      .generateScript(awardId, "class")
      .then((res) => {
        const items = res.data.items || [];
        const target = items.find(
          (item) =>
            item.student_name === studentName &&
            item.student_class === studentClass
        );
        setScript(target?.script_text || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, awardId, studentName, studentClass]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降級處理：fallback
      const textarea = document.createElement("textarea");
      textarea.value = script;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: "520px" }}>
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>
            頒獎讀稿
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* 讀稿內容 */}
        <div
          className="rounded-xl p-6 mb-5"
          style={{
            backgroundColor: "#f0f7f5",
            border: "1px solid #d8e6e0",
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={20} className="animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-400">生成中...</span>
            </div>
          ) : script ? (
            <p
              className="text-lg leading-relaxed whitespace-pre-line"
              style={{ color: "var(--text)", lineHeight: "2" }}
            >
              {script}
            </p>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">暫無讀稿內容</p>
          )}
        </div>

        {/* 按鈕 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCopy}
            disabled={!script || loading}
            className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check size={16} /> 已複製
              </>
            ) : (
              <>
                <Copy size={16} /> 複製內容
              </>
            )}
          </button>
          <button onClick={onClose} className="btn btn-ghost">
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
