"use client";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { GraduationCap, Plus } from "lucide-react";

export default function StudentsPage() {
  return (
    <div>
      <PageHeader
        title="学生事务"
        subtitle="学生档案、在校证明、请假管理、AI 学生画像"
        actions={
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600">
            <Plus size={16} /> 新增学生
          </button>
        }
      />
      <EmptyState
        icon={GraduationCap}
        title="学生事务模块"
        description="同学4 将在明天完成后端 API 和前端页面，届时此处将显示学生列表、档案详情、在校证明生成、请假管理等功能"
      />
    </div>
  );
}
