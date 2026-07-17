"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Award, Plus, Eye, Edit, Trash2, Send, XCircle, Download, BookOpen, Clock, DollarSign, Users, Calculator } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { awardApi } from "@/lib/services/awards";
import type { AwardListItem, AwardsDashboardStats } from "@/lib/types/awards";

/** 狀態徽標 */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "草稿", cls: "bg-gray-100 text-gray-600" },
    calculated: { label: "已核算", cls: "bg-blue-100 text-blue-700" },
    confirmed: { label: "已確認", cls: "bg-green-100 text-green-700" },
    cancelled: { label: "已取消", cls: "bg-red-100 text-red-600" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function AwardsListPage() {
  const router = useRouter();
  const [data, setData] = useState<AwardListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [stats, setStats] = useState<AwardsDashboardStats | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await awardApi.getAwards({ ...filters, page, page_size: 20 });
      setData(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      console.error("獲取獎狀列表失敗", e);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchStats = useCallback(async () => {
    awardApi.getStatistics()
      .then((res) => setStats(res.data))
      .catch(() => {});
  }, []);

  // 获取统计数据
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await awardApi.deleteAward(deleteTarget);
      setDeleteTarget(null);
      fetchData();
      fetchStats();
    } catch (e) {
      console.error("刪除失敗", e);
    } finally {
      setDeleting(false);
    }
  };

  const handlePublish = async () => {
    if (!publishTarget) return;
    try {
      await awardApi.publishAward(publishTarget);
      setPublishTarget(null);
      fetchData();
      fetchStats();
    } catch (e) {
      console.error("確認失敗", e);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await awardApi.cancelAward(cancelTarget);
      setCancelTarget(null);
      fetchData();
      fetchStats();
    } catch (e) {
      console.error("取消失敗", e);
    }
  };

  const handleBatchDelete = async () => {
    setBatchDeleting(true);
    try {
      await awardApi.batchDeleteAwards(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectAll(false);
      setBatchDeleteDialogOpen(false);
      fetchData();
      fetchStats();
    } catch (e) {
      console.error("批量刪除失敗", e);
      alert("批量刪除失敗，請重試");
    } finally {
      setBatchDeleting(false);
    }
  };

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
    setExporting(true);
    try {
      await awardApi.batchExportAwards(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectAll(false);
    } catch (e) {
      console.error("批量導出失敗", e);
      alert("批量導出失敗，請重試");
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<AwardListItem>[] = [
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
    { key: "title", header: "獎狀標題", width: "16%",
      render: (row) => (
        <button
          onClick={() => router.push(`/dashboard/apple/awards/${row.id}`)}
          className="text-primary-600 hover:text-primary-700 font-medium text-left truncate block max-w-full"
          title={row.title}
        >
          {row.title}
        </button>
      ),
    },
    { key: "template_name", header: "範本", width: "10%" },
    { key: "template_category", header: "類別", width: "8%",
      render: (row) => {
        const cat = row.template_category || "";
        const colors: Record<string, string> = {
          "學業": "bg-blue-50 text-blue-700",
          "品德": "bg-green-50 text-green-700",
          "活動": "bg-purple-50 text-purple-700",
          "體育": "bg-orange-50 text-orange-700",
        };
        return (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[cat] || "bg-gray-100 text-gray-600"}`}>
            {cat || "-"}
          </span>
        );
      },
    },
    { key: "issue_date", header: "頒發日期", width: "10%" },
    { key: "issuer", header: "頒發部門", width: "10%" },
    { key: "amount", header: "獎金金額", width: "10%", align: "center",
      render: (row) => (
        <span className="font-medium text-gray-700">
          {row.amount ? `HK$ ${Number(row.amount).toLocaleString()}` : "-"}
        </span>
      ),
    },
    { key: "status", header: "狀態", width: "10%",
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: "total_recipients", header: "獲獎人數", width: "8%", align: "center" },
    { key: "actions", header: "操作", width: "14%", align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => router.push(`/dashboard/apple/awards/${row.id}`)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-600"
            title="查看詳情"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => router.push(`/dashboard/apple/awards/${row.id}/edit`)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
            title="編輯"
          >
            <Edit size={15} />
          </button>
          {(row.status === "draft" || row.status === "calculated") && (
            <button
              onClick={() => setPublishTarget(row.id)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600"
              title="確認"
            >
              <Send size={15} />
            </button>
          )}
          {row.status !== "cancelled" && (
            <button
              onClick={() => setCancelTarget(row.id)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-orange-600"
              title="取消"
            >
              <XCircle size={15} />
            </button>
          )}
          <button
            onClick={() => setDeleteTarget(row.id)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
            title="刪除"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="獎狀管理"
        subtitle="創建、發佈和管理學校各類獎狀證書"
        actions={
          <button
            onClick={() => router.push("/dashboard/apple/awards/create")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600"
          >
            <Plus size={16} /> 新增獎狀
          </button>
        }
      />

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <BookOpen size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">已確認</p>
              <p className="text-xl font-bold text-gray-900">{stats.awards.confirmed_count}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">草稿</p>
              <p className="text-xl font-bold text-gray-900">{stats.awards.draft_count}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Calculator size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">待確認</p>
              <p className="text-xl font-bold text-gray-900">{stats.awards.calculated_count}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Users size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">已發獎學金</p>
              <p className="text-xl font-bold text-gray-900">{stats.scholarships.approved_count}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <DollarSign size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">歷史總額</p>
              <p className="text-xl font-bold text-gray-900">HK$ {Number(stats.scholarships.approved_amount).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      <FilterBar
        fields={[
          { key: "title", label: "標題", type: "text", placeholder: "搜尋標題..." },
          { key: "status", label: "狀態", type: "select",
            options: [
              { label: "草稿", value: "draft" },
              { label: "已核算", value: "calculated" },
              { label: "已確認", value: "confirmed" },
              { label: "已取消", value: "cancelled" },
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
          icon={Award}
          title="暫無獎狀"
          description="點擊右上角「新增獎狀」創建第一份獎狀"
          action={
            <button
              onClick={() => router.push("/dashboard/apple/awards/create")}
              className="px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600"
            >
              新增獎狀
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

          {/* 批量导出浮动条 */}
          {selectedIds.size > 0 && (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between bg-primary-600 text-white px-5 py-3 rounded-xl shadow-lg">
              <span className="text-sm font-medium">
                已選 {selectedIds.size} 項
              </span>
              <div className="relative flex items-center gap-2">
                <button
                  onClick={() => setBatchDeleteDialogOpen(true)}
                  disabled={batchDeleting}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  {batchDeleting ? "刪除中..." : "批量刪除"}
                </button>
                <button
                  onClick={handleBatchExport}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-white text-primary-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download size={15} />
                  {exporting ? "導出中..." : "批量導出 PDF"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="確認刪除"
        message="刪除後不可恢復，確定要刪除此獎狀嗎？"
        variant="danger"
        confirmText="刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      <ConfirmDialog
        open={publishTarget !== null}
        title="確認獎狀"
        message="確認後獎狀將標記為已確認。確定要繼續嗎？"
        variant="info"
        confirmText="確認"
        onConfirm={handlePublish}
        onCancel={() => setPublishTarget(null)}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        title="取消獎狀"
        message="取消後獎狀將標記為已取消。確定要繼續嗎？"
        variant="warning"
        confirmText="取消獎狀"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={batchDeleteDialogOpen}
        title="批量刪除"
        message={`確定要刪除已選的 ${selectedIds.size} 項獎狀嗎？此操作不可恢復。`}
        variant="danger"
        confirmText="全部刪除"
        onConfirm={handleBatchDelete}
        onCancel={() => setBatchDeleteDialogOpen(false)}
        loading={batchDeleting}
      />
    </div>
  );
}
