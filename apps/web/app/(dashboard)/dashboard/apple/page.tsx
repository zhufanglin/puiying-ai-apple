"use client";

import { useEffect, useState } from "react";
import {
  Award, Receipt, Package, GraduationCap,
  TrendingUp, ClipboardList, AlertTriangle, CheckCircle,
} from "lucide-react";

interface StatsData {
  awards: { total: number; templates: number };
  finance: { income: number; expense: number };
  assets: { total: number; active: number };
  students: { total: number };
}

const MOCK_STATS: StatsData = {
  awards: { total: 3, templates: 3 },
  finance: { income: 2, expense: 1 },
  assets: { total: 3, active: 2 },
  students: { total: 5 },
};

const QUICK_LINKS = [
  { label: "奖状管理", href: "/dashboard/apple/awards", icon: Award },
  { label: "财务管理", href: "/dashboard/apple/finance", icon: Receipt },
  { label: "资产盘点", href: "/dashboard/apple/assets", icon: Package },
  { label: "学生事务", href: "/dashboard/apple/students", icon: GraduationCap },
];

const RECENT_ACTIVITIES = [
  { action: "审核通过", target: "三好学生奖状 #A023", time: "2 分钟前", status: "success" as const },
  { action: "提交审批", target: "优秀班干部奖状 #A024", time: "15 分钟前", status: "pending" as const },
  { action: "上传票据", target: "春季运动会物资发票", time: "1 小时前", status: "info" as const },
  { action: "资产报废", target: "投影仪 PM-2019-032", time: "2 小时前", status: "warning" as const },
];

const STATUS_ICONS = {
  success: CheckCircle,
  pending: ClipboardList,
  warning: AlertTriangle,
  info: TrendingUp,
} as const;

const STATUS_COLORS = {
  success: "text-green-500",
  pending: "text-yellow-500",
  warning: "text-orange-500",
  info: "text-blue-500",
} as const;

export default function AppleOverviewPage() {
  const [stats] = useState<StatsData>(MOCK_STATS);

  const cards = [
    { label: "奖状模板", value: stats.awards.templates, icon: Award, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "收支记录", value: stats.finance.income + stats.finance.expense, icon: Receipt, color: "text-green-600", bg: "bg-green-50" },
    { label: "资产总数", value: stats.assets.total, icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "在学学生", value: stats.students.total, icon: GraduationCap, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Apple 子系统总览</h1>
        <p className="text-sm text-gray-500 mt-1">培英中学 AI 数智化平台 · 校务管理</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((s) => (
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
            {QUICK_LINKS.map((item) => (
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
          <h2 className="text-base font-semibold text-gray-800 mb-4">最近动态</h2>
          <div className="space-y-3">
            {RECENT_ACTIVITIES.map((log, i) => {
              const Icon = STATUS_ICONS[log.status];
              return (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <Icon size={16} className={STATUS_COLORS[log.status]} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800">{log.action}</span>
                    <span className="text-sm text-gray-400 ml-2">{log.target}</span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{log.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
