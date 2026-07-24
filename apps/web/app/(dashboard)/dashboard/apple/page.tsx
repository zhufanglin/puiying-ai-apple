"use client";

import { useEffect, useState } from "react";
import {
  Award,
  Receipt,
  Package,
  GraduationCap,
  Megaphone,
  BarChart3,
  TrendingUp,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { api } from "@/lib/api";

export default function AppleOverviewPage() {
  const [stats, setStats] = useState([
    { label: "獎狀模板", value: "—", icon: Award, color: "text-[#23675f]", bg: "bg-[#ecfdf3]" },
    { label: "本月收支", value: "—", icon: Receipt, color: "text-green-600", bg: "bg-green-50" },
    { label: "資產總數", value: "—", icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "在校學生", value: "—", icon: GraduationCap, color: "text-orange-600", bg: "bg-orange-50" },
  ]);
  const [logs] = useState([
    { action: "系統就緒", target: "Apple 子系統已啟動", time: "—", status: "info" },
    { action: "數據已加載", target: "從 API 獲取統計數據", time: "—", status: "success" },
    { action: "模塊正常", target: "A1 獎狀 · A2 財務 · A3 資產 · A4 學生 · 通告", time: "—", status: "success" },
  ]);

  useEffect(() => {
    let cancelled = false;

    // 并行加载 4 个模块的统计
    Promise.allSettled([
      api.get<any>("/apple/awards/statistics").catch(() => ({ data: null })),
      api.get<any>("/apple/finance/summary").catch(() => ({ data: null })),
      api.get<any>("/apple/assets/summary").catch(() => ({ data: null })),
      api.get<any>("/apple/students/summary").catch(() => ({ data: null })),
    ]).then(([awardsR, financeR, assetsR, studentsR]) => {
      if (cancelled) return;

      const awards: any = (awardsR.status === "fulfilled" ? (awardsR.value?.data ?? awardsR.value) : null);
      const finance: any = (financeR.status === "fulfilled" ? (financeR.value?.data ?? financeR.value) : null);
      const assets: any = (assetsR.status === "fulfilled" ? (assetsR.value?.data ?? assetsR.value) : null);
      const students: any = (studentsR.status === "fulfilled" ? (studentsR.value?.data ?? studentsR.value) : null);

      const templateCount = awards?.awards?.template_count ?? awards?.totalTemplates ?? "—";
      const netAmount = finance?.netAmount != null ? `HK$ ${finance.netAmount.toLocaleString()}` : "—";
      const assetCount = assets?.totalAssets ?? "—";
      const studentCount = students?.activeStudents ?? "—";

      setStats([
        { label: "獎狀模板", value: templateCount, icon: Award, color: "text-[#23675f]", bg: "bg-[#ecfdf3]" },
        { label: "盈餘淨值", value: netAmount, icon: Receipt, color: "text-green-600", bg: "bg-green-50" },
        { label: "資產總數", value: assetCount, icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
        { label: "在校學生", value: studentCount, icon: GraduationCap, color: "text-orange-600", bg: "bg-orange-50" },
      ]);
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{s.value}</p>
              </div>
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon size={20} className={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 快捷入口 + 最近动态 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 快捷入口 */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">快捷操作</h2>
          <div className="space-y-2">
            {[
              { label: "獎狀管理", href: "/dashboard/apple/awards", icon: Award },
              { label: "財務收支", href: "/dashboard/apple/finance", icon: Receipt },
              { label: "資產盤點", href: "/dashboard/apple/assets", icon: Package },
              { label: "學生查詢", href: "/dashboard/apple/students", icon: GraduationCap },
              { label: "通告管理", href: "/dashboard/apple/notifications", icon: Megaphone },
              { label: "成绩评语", href: "/dashboard/apple/scores", icon: BarChart3 },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <item.icon size={18} className="text-primary-500" />
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* 最近动态 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">系統狀態</h2>
          <div className="space-y-3">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                {log.status === "success" && <CheckCircle size={16} className="text-green-500" />}
                {log.status === "pending" && <ClipboardList size={16} className="text-yellow-500" />}
                {log.status === "warning" && <AlertTriangle size={16} className="text-orange-500" />}
                {log.status === "info" && <TrendingUp size={16} className="text-[#23675f]" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800">{log.action}</span>
                  <span className="text-sm text-gray-400 ml-2">{log.target}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
