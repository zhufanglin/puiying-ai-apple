"use client";

import { TableSkeleton } from "@/components/ui/Skeleton";
import PageHeader from "@/components/ui/PageHeader";

export default function NotificationsLoading() {
  return (
    <div className="space-y-5">
      <PageHeader title="通告管理" subtitle="家校通告、班級推送、WhatsApp 狀態追蹤" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="mb-2 h-4 w-16 rounded bg-gray-200" />
            <div className="h-8 w-12 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <TableSkeleton rows={8} cols={5} />
      </div>
    </div>
  );
}
