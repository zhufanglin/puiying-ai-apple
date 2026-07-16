"use client";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { Receipt, Plus } from "lucide-react";

export default function FinancePage() {
  return (
    <div>
      <PageHeader
        title="财务收支"
        subtitle="收支记录管理、票据 OCR 识别、分类统计"
        actions={
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600">
            <Plus size={16} /> 新增记录
          </button>
        }
      />
      <EmptyState
        icon={Receipt}
        title="财务管理模块"
        description="同学3 将在明天完成后端 API 和前端页面，届时此处将显示收支列表、票据上传、OCR识别、分类统计等功能"
      />
    </div>
  );
}
