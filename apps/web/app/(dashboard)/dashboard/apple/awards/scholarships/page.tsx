"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, Eye, CheckCircle, XCircle, Download } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import EmptyState from "@/components/ui/EmptyState";
import { awardApi } from "@/lib/services/awards";
import type { ScholarshipApplication } from "@/lib/types/awards";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待審核", cls: "bg-yellow-100 text-yellow-700" },
    approved: { label: "已通過", cls: "bg-green-100 text-green-700" },
    rejected: { label: "已駁回", cls: "bg-red-100 text-red-600" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function ScholarshipsListPage() {
  const router = useRouter();
  const [data, setData] = useState<ScholarshipApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await awardApi.getScholarships({ ...filters, page, page_size: 20 });
      setData(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      console.error("獲取獎學金申請列表失敗", e);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
    setSelectAll(next.size === data.length && data.length > 0);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(data.map((d) => d.id)));
      setSelectAll(true);
    }
  };

  const handleBatchExport = async () => {
    if (selectedIds.size === 0) {
      alert("請先勾選需要導出的獎學金申請");
      return;
    }
    setExporting(true);
    try {
      await awardApi.batchExportScholarships(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectAll(false);
    } catch (e: any) {
      console.error("批量導出失敗", e);
      alert(e.message || "批量導出失敗，請重試");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<ScholarshipApplication>[] = [
    {
      key: "select" as any,
      header: (
        <input
          type="checkbox"
          checked={selectAll}
          onChange={toggleSelectAll}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      ),
      width: "4%",
      align: "center",
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      ),
    },
    { key: "student_name", header: "學生姓名" },
    { key: "student_class", header: "班級" },
    { key: "scholarship_type", header: "獎學金類型", width: "14%" },
    { key: "academic_year", header: "學年", width: "9%" },
    { key: "amount", header: "金額(HKD)", width: "12%",
      render: (row) => `HK$ ${Number(row.amount).toLocaleString()}`,
    },
    { key: "status", header: "狀態", width: "10%",
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: "application_date", header: "申請日期", width: "12%" },
    { key: "actions", header: "操作", width: "15%", align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => router.push(`/dashboard/apple/awards/scholarships/${row.id}`)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-600"
            title="查看詳情"
          >
            <Eye size={15} />
          </button>
          {row.status === "approved" && (
            <button
              onClick={async () => {
                try {
                  await awardApi.downloadScholarshipCertificate(row.id);
                } catch (e) {
                  console.error("下載失敗", e);
                }
              }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600"
              title="下載 PDF 證書"
            >
              <Download size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader backHref="/dashboard/apple/awards"
        title="獎學金申請"
        subtitle="查看和管理學生獎學金申請"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard/apple/awards/scholarships/apply")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600"
            >
              <Plus size={16} /> 提交申請
            </button>
            <button
              onClick={() => router.push("/dashboard/apple/awards/scholarships/review")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[#d8dee6] rounded-lg font-bold hover:bg-[#f1f5f8]"
            >
              <CheckCircle size={16} /> 審核工作台
            </button>
          </div>
        }
      />

      <FilterBar
        fields={[
          { key: "student_name", label: "姓名", type: "text", placeholder: "搜尋學生..." },
          { key: "scholarship_type", label: "類型", type: "select",
            options: [
              { label: "學業優秀", value: "學業優秀" },
              { label: "品德風尚", value: "品德風尚" },
              { label: "科技競賽", value: "科技競賽" },
              { label: "體藝特長", value: "體藝特長" },
              { label: "助學金", value: "助學金" },
            ],
          },
          { key: "status", label: "狀態", type: "select",
            options: [
              { label: "待審核", value: "pending" },
              { label: "已通過", value: "approved" },
              { label: "已駁回", value: "rejected" },
            ],
          },
        ]}
        values={filters}
        onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
        onReset={() => { setFilters({}); setPage(1); }}
        onSearch={() => setPage(1)}
      />

      {!loading && data.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="暫無獎學金申請"
          description="點擊右上角「提交申請」創建第一份獎學金申請"
          action={
            <button
              onClick={() => router.push("/dashboard/apple/awards/scholarships/apply")}
              className="px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600"
            >
              提交申請
            </button>
          }
        />
      ) : (
        <div className="relative">
          <DataTable
            columns={columns}
            data={data}
            total={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            loading={loading}
          />

          {/* 批量導出浮動條 */}
          {selectedIds.size > 0 && (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between bg-primary-600 text-white px-5 py-3 rounded-xl shadow-lg">
              <span className="text-sm font-medium">
                已選 {selectedIds.size} 項
              </span>
              <button
                onClick={handleBatchExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-white text-primary-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={15} />
                {exporting ? "導出中..." : "批量導出 PDF"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
