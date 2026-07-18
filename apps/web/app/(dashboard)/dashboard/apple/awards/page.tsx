"use client";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { Award, Plus } from "lucide-react";

export default function AwardsPage() {
  return (
    <div>
      <PageHeader
        title="奖状奖学金"
        subtitle="管理奖状模板、生成证书、审批流程"
        actions={
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600">
            <Plus size={16} /> 新建奖状
          </button>
        }
      />
      <EmptyState
        icon={Award}
        title="奖状管理模块"
        description="同学2 将在明天完成后端 API 和前端页面，届时此处将显示奖状列表、筛选、生成、审批等功能"
      />
    </div>
  );
}
