"use client";

import { useState, useEffect } from "react";
import { Copy, Check, X, Download, Loader2 } from "lucide-react";

import { awardApi } from "@/lib/services/awards";
import type { ScriptItem } from "@/lib/types/awards";

interface AwardsScriptDialogProps {
  open: boolean;
  awardId: number;
  awardTitle: string;
  awardYear: string;
  onClose: () => void;
}

const GROUP_OPTIONS = [
  { value: "class", label: "按班級" },
  { value: "grade", label: "按年級" },
  { value: "student_no", label: "按學號" },
];

export default function AwardsScriptDialog({
  open,
  awardId,
  awardTitle,
  awardYear,
  onClose,
}: AwardsScriptDialogProps) {
  const [groupBy, setGroupBy] = useState("class");
  const [items, setItems] = useState<ScriptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !awardId) return;
    setLoading(true);
    awardApi
      .generateScript(awardId, groupBy)
      .then((res) => setItems(res.data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, awardId, groupBy]);

  const fullScript = items
    .map((item, i) => `${i + 1}. ${item.script_text}`)
    .join("\n\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = fullScript;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportText = () => {
    const header = `頒獎讀稿 — ${awardTitle}（${awardYear}學年度）\n${"=".repeat(40)}\n\n`;
    const blob = new Blob([header + fullScript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `頒獎讀稿_${awardTitle}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: "640px" }}>
        {/* 標題列 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>
            頒獎讀稿製作
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* 分類選擇 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            排序方式
          </label>
          <div className="flex gap-2">
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  groupBy === opt.value
                    ? "bg-primary-50 border-primary-300 text-primary-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 讀稿內容 */}
        <div
          className="rounded-xl p-4 mb-4 max-h-80 overflow-y-auto"
          style={{
            backgroundColor: "#f0f7f5",
            border: "1px solid #d8e6e0",
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-400">生成中...</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暫無讀稿內容</p>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                共 {items.length} 位學生
              </p>
              <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {fullScript}
              </pre>
            </div>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleExportText}
            disabled={items.length === 0}
            className="btn btn-ghost flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={16} /> 匯出文字
          </button>
          <button
            onClick={handleCopy}
            disabled={items.length === 0}
            className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check size={16} /> 已複製
              </>
            ) : (
              <>
                <Copy size={16} /> 複製全部
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
