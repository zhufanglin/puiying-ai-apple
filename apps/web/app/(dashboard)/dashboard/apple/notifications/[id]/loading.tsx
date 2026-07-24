"use client";

import { DetailSkeleton } from "@/components/ui/Skeleton";
import PageHeader from "@/components/ui/PageHeader";

export default function NotificationDetailLoading() {
  return (
    <div className="space-y-5">
      <PageHeader title="通告詳情" subtitle="加載中..." backHref="/dashboard/apple/notifications" />
      <DetailSkeleton />
    </div>
  );
}
