"use client";

import { TableSkeleton } from "@/components/ui/Skeleton";
import PageHeader from "@/components/ui/PageHeader";

export default function TemplatesLoading() {
  return (
    <div className="space-y-5">
      <PageHeader title="通告模板" subtitle="管理通告模板" />
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <TableSkeleton rows={6} cols={4} />
      </div>
    </div>
  );
}
