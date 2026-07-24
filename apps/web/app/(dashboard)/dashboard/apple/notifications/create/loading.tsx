"use client";

import { DetailSkeleton } from "@/components/ui/Skeleton";
import PageHeader from "@/components/ui/PageHeader";

export default function CreateNotificationLoading() {
  return (
    <div className="space-y-5">
      <PageHeader title="新建通告" subtitle="選擇模板、填寫信息、發送通告" />
      <DetailSkeleton />
    </div>
  );
}
