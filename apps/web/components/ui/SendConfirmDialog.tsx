"use client";

import { AlertTriangle, Users, FileText } from "lucide-react";

interface SendConfirmDialogProps {
  open: boolean;
  titleZh: string;
  titleEn?: string | null;
  targetClasses: string[];
  estimatedRecipients: number;
  contentPreview: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SendConfirmDialog({
  open,
  titleZh,
  titleEn,
  targetClasses,
  estimatedRecipients,
  contentPreview,
  loading,
  onConfirm,
  onCancel,
}: SendConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">確認發送</h3>
            <p className="text-sm text-gray-500">請確認以下信息後發送通告</p>
          </div>
        </div>

        {/* 内容 */}
        <div className="space-y-3 px-6 py-4">
          {/* 标题 */}
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="mb-1 text-xs font-semibold text-gray-400">通告標題</div>
            <div className="text-sm font-semibold text-gray-900">{titleZh}</div>
            {titleEn && (
              <div className="mt-0.5 text-xs text-gray-500">{titleEn}</div>
            )}
          </div>

          {/* 目标班级 */}
          <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
            <FileText size={16} className="mt-0.5 text-gray-400" />
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold text-gray-400">目標班級</div>
              <div className="flex flex-wrap gap-1">
                {targetClasses.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 预计人数 */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            <Users size={16} className="text-gray-400" />
            <div>
              <div className="text-xs font-semibold text-gray-400">預計發送人數</div>
              <div className="text-sm font-semibold text-primary-600">
                約 {estimatedRecipients} 位家長
              </div>
            </div>
          </div>

          {/* 内容预览 */}
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="mb-1 text-xs font-semibold text-gray-400">內容預覽</div>
            <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-gray-600">
              {contentPreview.length > 200
                ? contentPreview.slice(0, 200) + "..."
                : contentPreview}
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? "發送中..." : "確認發送"}
          </button>
        </div>
      </div>
    </div>
  );
}
