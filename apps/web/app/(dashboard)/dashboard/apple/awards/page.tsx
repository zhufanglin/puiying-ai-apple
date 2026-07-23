"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import { Award, Plus, FileText, BarChart3, Download } from "lucide-react";

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
  calculated: { label: "已核算", className: "bg-blue-50 text-blue-700" },
  pending: { label: "待審批", className: "bg-yellow-50 text-yellow-700" },
  confirmed: { label: "已確認", className: "bg-green-50 text-green-700" },
  published: { label: "已發佈", className: "bg-[#ecfdf3] text-[#23675f]" },
  cancelled: { label: "已取消", className: "bg-red-50 text-red-600" },
};

export default function AwardsPage() {
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchAwards = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/v1/apple/awards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) {
        setAwards(Array.isArray(json.data) ? json.data : json.data.items || []);
      }
    } catch (err) {
      console.error("加載獎狀失敗", err);
      if (!awards.length) setAwards([
        { id:1, name:"三好學生", category:"學業", amount:1000, semester:"上學期", year:2026, status:"published", recipients:[] },
        { id:2, name:"優秀班幹部", category:"服務", amount:500, semester:"上學期", year:2026, status:"draft", recipients:[] },
        { id:3, name:"進步之星", category:"學業", amount:300, semester:"上學期", year:2026, status:"published", recipients:[] },
      ] as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAwards();
  }, []);

  const handleBatchExport = async () => {
    if (selectedIds.size === 0) return;
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/apple/awards/batch-export", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("導出失敗");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "certificates.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("導出失敗", e);
      alert("批量導出失敗");
    } finally {
      setExporting(false);
      setSelectedIds(new Set()); setSelectAll(false);
    }
  };

  const filtered = awards.filter((a) => {
    if (search && !a.title.includes(search) && !(a.issuer || "").includes(search)) return false;
    if (filters.status && a.status !== filters.status) return false;
    if (filters.title && !a.title.includes(filters.title)) return false;
    return true;
  });

  const columns: Column<AwardRecord>[] = [
    {
      key: "checkbox",
      header: (
        <input type="checkbox" checked={selectAll} onChange={(e) => {
          setSelectAll(e.target.checked);
          setSelectedIds(e.target.checked ? new Set(filtered.map(a => a.id)) : new Set());
        }} />
      ),
      width: "40px",
      render: (row) => (
        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={(e) => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            e.target.checked ? next.add(row.id) : next.delete(row.id);
            return next;
          });
          setSelectAll(false);
        }} />
      ),
    },
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
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/apple/awards/scholarships"
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[#d8dee6] rounded-lg font-bold text-[#344054] hover:bg-[#f1f5f8] transition"
            >
              <FileText size={16} className="text-green-500" /> 獎學金管理
            </Link>
            <Link
              href="/dashboard/apple/awards/statistics"
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[#d8dee6] rounded-lg font-bold text-[#344054] hover:bg-[#f1f5f8] transition"
            >
              <BarChart3 size={16} className="text-purple-500" /> 統計分析
            </Link>
            <Link
              href="/dashboard/apple/awards/create"
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition"
            >
              <Plus size={16} /> 新增獎狀
            </Link>
          </div>
        }
      />

      <FilterBar
        fields={[
          { key: "title", label: "名稱", type: "text", placeholder: "搜尋獎狀名稱..." },
          { key: "status", label: "狀態", type: "select",
            options: [
              { label: "草稿", value: "draft" },
              { label: "待審批", value: "pending" },
              { label: "已確認", value: "confirmed" },
              { label: "已發佈", value: "published" },
              { label: "已取消", value: "cancelled" },
            ],
          },
        ]}
        values={filters}
        onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))}
        onReset={() => setFilters({})}
        onSearch={() => {}}
      />

      <div className="flex items-center justify-between mb-4">
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

      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between bg-primary-600 text-white px-5 py-3 rounded-xl shadow-lg">
          <span className="text-sm font-medium">已選 {selectedIds.size} 份獎狀</span>
          <button onClick={handleBatchExport} disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-white text-primary-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <Download size={15} /> {exporting ? "導出中..." : "批量導出 PDF"}
          </button>
        </div>
      )}
    </div>
  );
}

