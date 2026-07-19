"use client";

import { useEffect, useState } from "react";
import { Award, GraduationCap, FileText, CheckCircle, Clock, XCircle, Users, DollarSign, BookOpen, Calculator } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatsCard from "@/components/ui/StatsCard";
import { awardApi } from "@/lib/services/awards";
import type { AwardsDashboardStats } from "@/lib/types/awards";

export default function StatisticsPage() {
  const [stats, setStats] = useState<AwardsDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    awardApi.getStatistics()
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">載入中...</div>;
  }

  const a = stats?.awards;
  const s = stats?.scholarships;

  return (
    <div>
      <PageHeader
        title="數據統計"
        subtitle="獎狀 & 獎學金數據概覽"
      />

      {/* 獎狀統計 */}
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Award size={18} className="text-primary-500" />
        獎狀統計
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatsCard
          label="獎狀總數"
          value={a?.total_awards || 0}
          icon={FileText}
          color="text-primary-600"
        />
        <StatsCard
          label="已確認"
          value={a?.confirmed_count || 0}
          icon={CheckCircle}
          color="text-green-600"
        />
        <StatsCard
          label="已核算"
          value={a?.calculated_count || 0}
          icon={Calculator}
          color="text-blue-600"
        />
        <StatsCard
          label="草稿"
          value={a?.draft_count || 0}
          icon={Clock}
          color="text-yellow-600"
        />
        <StatsCard
          label="已取消"
          value={a?.cancelled_count || 0}
          icon={XCircle}
          color="text-red-500"
        />
        <StatsCard
          label="獲獎總人次"
          value={a?.total_recipients || 0}
          icon={Users}
          color="text-blue-600"
        />
      </div>

      {/* 獎學金統計 */}
      <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <GraduationCap size={18} className="text-orange-500" />
        獎學金統計
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          label="申請總數"
          value={s?.total_applications || 0}
          icon={FileText}
          color="text-primary-600"
        />
        <StatsCard
          label="待審核"
          value={s?.pending_count || 0}
          icon={Clock}
          color="text-yellow-600"
        />
        <StatsCard
          label="已通過"
          value={s?.approved_count || 0}
          icon={CheckCircle}
          color="text-green-600"
        />
        <StatsCard
          label="已駁回"
          value={s?.rejected_count || 0}
          icon={XCircle}
          color="text-red-500"
        />
        <StatsCard
          label="通過總額 (HKD)"
          value={s ? `HK$ ${Number(s.approved_amount).toLocaleString()}` : 0}
          icon={DollarSign}
          color="text-blue-600"
        />
      </div>
    </div>
  );
}
