"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  variant?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "確認",
  cancelText = "取消",
  danger,
  onConfirm,
  onCancel,
  loading,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />

      {/* 彈窗 */}
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm p-6 mx-4">
        <div className="flex items-start gap-3 mb-4">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
            {children && <div className="mt-3">{children}</div>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm text-white rounded-lg ${
              danger ? "bg-red-500 hover:bg-red-600" : "bg-primary-500 hover:bg-primary-600"
            } disabled:opacity-50`}
          >
            {loading ? "處理中..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
