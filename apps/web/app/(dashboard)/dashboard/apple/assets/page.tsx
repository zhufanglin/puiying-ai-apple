"use client";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { Package, Plus } from "lucide-react";

export default function AssetsPage() {
  return (
    <div>
      <PageHeader
        title="资产盘点"
        subtitle="资产登记、盘点管理、折旧计算、报废审批"
        actions={
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600">
            <Plus size={16} /> 登记资产
          </button>
        }
      />
      <EmptyState
        icon={Package}
        title="资产管理模块"
        description="同学3 将在明天完成后端 API 和前端页面，届时此处将显示资产列表、盘点记录、折旧计算、报废审批等功能"
      />
    </div>
  );
}
