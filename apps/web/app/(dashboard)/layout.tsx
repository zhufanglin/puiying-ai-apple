"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Award,
  Receipt,
  Package,
  GraduationCap,
  Megaphone,
  BarChart3,
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
  {
    href: "/dashboard/apple/notifications",
    label: "通告管理",
    icon: Megaphone,
  },
  {
    href: "/dashboard/apple/scores",
    label: "成绩评语",
    icon: BarChart3,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // 鉴权检查
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ---- 側邊欄 ---- */}
      <aside
        className="flex flex-col transition-all duration-200"
        style={{ background: "#102a2f", width: collapsed ? 64 : 240 }}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          {!collapsed && (
            <span className="text-sm font-bold truncate" style={{ color: "#eef7f5" }}>
              培英 AI 數智平台
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1 rounded hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.6)" }}
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
                className={`flex items-center gap-3 mx-2 mb-1 px-3 py-2 rounded-lg text-sm transition-colors`}
                style={{
                  color: isActive ? "#ffffff" : "#dcecea",
                  background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* 底部 */}
        <div className="p-2" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.6)", background: "transparent" }}>
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
