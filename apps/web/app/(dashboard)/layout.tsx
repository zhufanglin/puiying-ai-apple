"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Award,
  Receipt,
  Package,
  GraduationCap,
  ChevronLeft,
  Menu,
  LogOut,
} from "lucide-react";

const menuItems = [
  {
    href: "/dashboard/apple",
    label: "Apple 總覽",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/apple/awards",
    label: "獎狀獎學金",
    icon: Award,
  },
  {
    href: "/dashboard/apple/finance",
    label: "財務收支",
    icon: Receipt,
  },
  {
    href: "/dashboard/apple/assets",
    label: "資產盤點",
    icon: Package,
  },
  {
    href: "/dashboard/apple/students",
    label: "學生事務",
    icon: GraduationCap,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ---- 側邊欄 ---- */}
      <aside
        className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-gray-100">
          {!collapsed && (
            <span className="text-sm font-bold text-primary-700 truncate">
              培英 AI 數智平台
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* 菜單 */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 mx-2 mb-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* 底部 */}
        <div className="border-t border-gray-100 p-2">
          <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">
            <LogOut size={18} />
            {!collapsed && <span>退出</span>}
          </button>
        </div>
      </aside>

      {/* ---- 主內容區 ---- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 頂欄 */}
        <header className="flex items-center h-14 px-6 bg-white border-b border-gray-200">
          <h1 className="text-base font-semibold text-gray-800">
            培英中學 AI 數智化平台 · Apple 子系統
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-400">演示版 v0.1</span>
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
              管
            </div>
          </div>
        </header>

        {/* 頁面內容 */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
