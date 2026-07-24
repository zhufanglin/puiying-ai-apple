"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON_MAP: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: "border-green-300 bg-green-50 text-green-800",
  error: "border-red-300 bg-red-50 text-red-800",
  warning: "border-yellow-300 bg-yellow-50 text-yellow-800",
  info: "border-blue-300 bg-blue-50 text-blue-800",
};

const ICON_COLOR_MAP: Record<ToastType, string> = {
  success: "text-green-500",
  error: "text-red-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      // 自动消失
      setTimeout(() => {
        removeToast(id);
      }, 3000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}

      {/* Toast 渲染层 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICON_MAP[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg transition-all duration-200 ${COLOR_MAP[t.type]}`}
              role="alert"
            >
              <Icon size={18} className={ICON_COLOR_MAP[t.type]} />
              <span className="text-sm font-medium">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="ml-2 rounded p-0.5 hover:bg-black/5"
                aria-label="關閉"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Omit<ToastContextValue, "toasts" | "removeToast"> {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return { toast: ctx.toast };
}
