"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  variant?: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  variant,
  children,
  confirmText = "確認",
  cancelText = "取消",
  danger,
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  if (!open) return null;

  const isDanger = danger || variant === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />

      {/* 彈窗 */}
      <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm p-6 mx-4">
        <div className="flex items-start gap-3 mb-4">
          {isDanger && (
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>

        {children && <div className="mb-4">{children}</div>}

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
              isDanger ? "bg-red-500 hover:bg-red-600" : "bg-primary-500 hover:bg-primary-600"
            } disabled:opacity-50`}
          >
            {loading ? "處理中..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
