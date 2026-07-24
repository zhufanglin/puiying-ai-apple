"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function NotificationDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title="通告詳情" subtitle="加載失敗" backHref="/dashboard/apple/notifications" />
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
        <AlertCircle size={48} className="mb-4 text-red-400" />
        <h3 className="mb-2 text-lg font-semibold text-gray-900">加載失敗</h3>
        <p className="mb-6 max-w-md text-sm text-gray-500">
          {error.message || "無法載入通告詳情，請稍後重試"}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
        >
          <RefreshCw size={15} />
          重新加載
        </button>
      </div>
    </div>
  );
}
