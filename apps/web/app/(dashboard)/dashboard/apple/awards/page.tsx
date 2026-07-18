"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import { Award, Plus, FileText, BarChart3, Layers, Search } from "lucide-react";

interface AwardRecord {
  id: number;
  title: string;
  status: string;
  issuer?: string;
  issue_date: string;
  template_name?: string;
  total_recipients: number;
  amount?: number;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-gray-50 text-gray-600" },
  pending: { label: "待審批", className: "bg-yellow-50 text-yellow-700" },
  confirmed: { label: "已確認", className: "bg-green-50 text-green-700" },
  published: { label: "已發佈", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "已取消", className: "bg-red-50 text-red-600" },
};

export default function AwardsPage() {
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchAwards = async () => {
    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8100";
      const res = await fetch(`${apiBase}/api/v1/apple/awards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) {
        setAwards(Array.isArray(json.data) ? json.data : json.data.items || []);
      }
    } catch (err) {
      console.error("加載獎狀失敗", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAwards();
  }, []);

  const filtered = search
    ? awards.filter((a) => a.title.includes(search) || (a.issuer || "").includes(search))
    : awards;

  const columns: Column<AwardRecord>[] = [
    {
      key: "title",
      header: "獎狀名稱",
      render: (row) => (
        <Link href={`/dashboard/apple/awards/${row.id}`} className="text-sm font-medium text-primary-600 hover:underline">
          {row.title}
        </Link>
      ),
    },
    {
      key: "issuer",
      header: "頒發單位",
      width: "120px",
      render: (row) => row.issuer || "-",
    },
    {
      key: "issue_date",
      header: "頒發日期",
      width: "110px",
      render: (row) => row.issue_date || "-",
    },
    {
      key: "total_recipients",
      header: "獲獎人數",
      width: "90px",
      align: "center",
      render: (row) => row.total_recipients || 0,
    },
    {
      key: "amount",
      header: "獎學金總額",
      width: "120px",
      align: "right",
      render: (row) => (row.amount ? `HK$${row.amount.toLocaleString()}` : "-"),
    },
    {
      key: "status",
      header: "狀態",
      width: "90px",
      render: (row) => {
        const s = STATUS_MAP[row.status] || { label: row.status, className: "bg-gray-50 text-gray-600" };
        return (
          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${s.className}`}>
            {s.label}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="獎狀獎學金"
        subtitle="製作獎狀、管理獲獎名單、審批獎學金申請"
        actions={
          <Link
            href="/dashboard/apple/awards/create"
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition"
          >
            <Plus size={16} /> 新增獎狀
          </Link>
        }
      />

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Link
          href="/dashboard/apple/awards/batch"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm transition group"
        >
          <Layers size={18} className="text-primary-500" />
          <span className="text-sm text-gray-700 group-hover:text-primary-700">批量生成</span>
        </Link>
        <Link
          href="/dashboard/apple/awards/generate"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm transition group"
        >
          <FileText size={18} className="text-green-500" />
          <span className="text-sm text-gray-700 group-hover:text-green-700">導出證書</span>
        </Link>
        <Link
          href="/dashboard/apple/awards/scholarships"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm transition group"
        >
          <Award size={18} className="text-orange-500" />
          <span className="text-sm text-gray-700 group-hover:text-orange-700">獎學金管理</span>
        </Link>
        <Link
          href="/dashboard/apple/awards/statistics"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm transition group"
        >
          <BarChart3 size={18} className="text-purple-500" />
          <span className="text-sm text-gray-700 group-hover:text-purple-700">統計分析</span>
        </Link>
      </div>

      {/* 搜索 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋獎狀名稱..."
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <span className="text-sm text-gray-500">
          {loading ? "加載中..." : `共 ${filtered.length} 份獎狀`}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        total={filtered.length}
        loading={loading}
        emptyText="暫無獎狀數據，點擊「新增獎狀」開始製作"
      />
    </div>
  );
}
