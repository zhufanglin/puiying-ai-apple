"use client";

import { Sparkles, RefreshCw } from "lucide-react";

interface AiReviewPanelProps {
  title?: string;
  content: string;
  loading?: boolean;
  onRegenerate?: () => void;
}

export default function AiReviewPanel({
  title = "AI 分析結果",
  content,
  loading,
  onRegenerate,
}: AiReviewPanelProps) {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-purple-500" />
        <span className="text-sm font-medium text-purple-700">{title}</span>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="ml-auto flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            重新生成
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-purple-400 py-4">
          <RefreshCw size={14} className="animate-spin" />
          AI 分析中...
        </div>
      ) : (
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</p>
      )}
    </div>
  );
}
