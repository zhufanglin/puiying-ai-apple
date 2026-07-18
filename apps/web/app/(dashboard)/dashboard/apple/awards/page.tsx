"use client";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { Award, Plus } from "lucide-react";

export default function AwardsPage() {
  return (
    <div>
      <PageHeader
        title="獎狀獎學金"
        subtitle="管理獎狀模板、生成證書、審批流程"
        actions={
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600">
            <Plus size={16} /> 新建獎狀
          </button>
        }
      />
      <EmptyState
        icon={Award}
        title="獎狀管理模塊"
        description="同學2 將在明天完成後端 API 和前端頁面，屆時此處將顯示獎狀列表、篩選、生成、審批等功能"
      />
    </div>
  );
}
