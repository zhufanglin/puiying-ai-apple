"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FilterBar from "@/components/ui/FilterBar";
import { Plus, FileText, BarChart3, Trash2, XCircle, Check, X, Download } from "lucide-react";
import { awardApi } from "@/lib/services/awards";
import { AwardListItem, AwardQuery, ScholarshipApplication, ScholarshipQuery } from "@/lib/types/awards";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-gray-50 text-gray-600" },
  calculated: { label: "已核算", className: "bg-yellow-50 text-yellow-700" },
  confirmed: { label: "已確認", className: "bg-green-50 text-green-700" },
  cancelled: { label: "已取消", className: "bg-red-50 text-red-600" },
};

const SCHOLARSHIP_STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "待審核", className: "bg-yellow-50 text-yellow-700" },
  approved: { label: "已通過", className: "bg-green-50 text-green-700" },
  rejected: { label: "已駁回", className: "bg-red-50 text-red-600" },
};

type TabKey = "awards" | "scholarships";

export default function AwardsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(initialTab === "scholarships" ? "scholarships" : "awards");

  // ---- 獎狀 state ----
  const [awards, setAwards] = useState<AwardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [awardsFilters, setAwardsFilters] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: number; title: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // 獎狀複選
  const [awardSelectedIds, setAwardSelectedIds] = useState<Set<number>>(new Set());
  const [awardSelectAll, setAwardSelectAll] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ---- 獎學金 state ----
  const [scholarships, setScholarships] = useState<ScholarshipApplication[]>([]);
  const [schLoading, setSchLoading] = useState(false);
  const [schFilters, setSchFilters] = useState<Record<string, string>>({});
  const [schTotal, setSchTotal] = useState(0);
  const [schPage, setSchPage] = useState(1);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  // 獎學金複選
  const [schSelectedIds, setSchSelectedIds] = useState<Set<number>>(new Set());
  const [schSelectAll, setSchSelectAll] = useState(false);
  const [schExporting, setSchExporting] = useState(false);

  // ==================== 獎狀 ====================

  const fetchAwards = useCallback(async () => {
    setLoading(true);
    try {
      const result = await awardApi.getAwards({ ...awardsFilters, page, page_size: 20 } as AwardQuery);
      if (result?.data?.items) {
        setAwards(result.data.items);
        setTotal(result.data.total);
      } else {
        setAwards([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("加載獎狀失敗", err);
      setAwards([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [awardsFilters, page]);

  useEffect(() => {
    if (tab === "awards") fetchAwards();
  }, [fetchAwards, tab]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await awardApi.deleteAward(deleteTarget.id);
      setDeleteTarget(null);
      fetchAwards();
    } catch (e: any) {
      alert("刪除失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      await awardApi.cancelAward(cancelTarget.id);
      setCancelTarget(null);
      fetchAwards();
    } catch (e: any) {
      alert("取消失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAwardSelect = (id: number) => {
    const next = new Set(awardSelectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAwardSelectedIds(next);
    setAwardSelectAll(next.size === awards.length && awards.length > 0);
  };

  const toggleAwardSelectAll = () => {
    if (awardSelectAll) {
      setAwardSelectedIds(new Set());
      setAwardSelectAll(false);
    } else {
      setAwardSelectedIds(new Set(awards.map((a) => a.id)));
      setAwardSelectAll(true);
    }
  };

  const handleBatchExportAwards = async () => {
    if (awardSelectedIds.size === 0) {
      alert("請先勾選需要導出的獎狀");
      return;
    }
    setExporting(true);
    try {
      await awardApi.batchExportAwards(Array.from(awardSelectedIds));
      setAwardSelectedIds(new Set());
      setAwardSelectAll(false);
    } catch (e: any) {
      alert("導出失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setExporting(false);
    }
  };

  const awardColumns: Column<AwardListItem>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={awardSelectAll}
          onChange={toggleAwardSelectAll}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      ),
      width: "40px",
      align: "center",
      render: (row) => (
        <input
          type="checkbox"
          checked={awardSelectedIds.has(row.id)}
          onChange={() => toggleAwardSelect(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      ),
    },
    {
      key: "title",
      header: "獎狀名稱",
      render: (row) => (
        <Link
          href={`/dashboard/apple/awards/${row.id}`}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: "template_name",
      header: "模板類別",
      width: "110px",
      render: (row) => row.template_name || "-",
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
        const s = STATUS_MAP[row.status] || {
          label: row.status,
          className: "bg-gray-50 text-gray-600",
        };
        return (
          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${s.className}`}>
            {s.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "操作",
      width: "100px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          {row.status !== "cancelled" && row.status !== "confirmed" && (
            <button
              onClick={(e) => { e.preventDefault(); setCancelTarget({ id: row.id, title: row.title }); }}
              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              title="取消"
            >
              <XCircle size={15} />
            </button>
          )}
          <button
            onClick={(e) => { e.preventDefault(); setDeleteTarget({ id: row.id, title: row.title }); }}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
            title="刪除"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  // ==================== 獎學金 ====================

  const fetchScholarships = useCallback(async () => {
    setSchLoading(true);
    try {
      const result = await awardApi.getScholarships({ ...schFilters, page: schPage, page_size: 20 } as ScholarshipQuery);
      if (result?.data?.items) {
        setScholarships(result.data.items);
        setSchTotal(result.data.total);
      } else {
        setScholarships([]);
        setSchTotal(0);
      }
    } catch (err) {
      console.error("加載獎學金失敗", err);
      setScholarships([]);
      setSchTotal(0);
    } finally {
      setSchLoading(false);
    }
  }, [schFilters, schPage]);

  useEffect(() => {
    if (tab === "scholarships") fetchScholarships();
  }, [fetchScholarships, tab]);

  const handleReview = async (id: number, status: "approved" | "rejected") => {
    setReviewingId(id);
    try {
      await awardApi.reviewScholarship(id, { status });
      fetchScholarships();
    } catch (e: any) {
      alert("審核失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setReviewingId(null);
    }
  };

  const toggleSchSelect = (id: number) => {
    const next = new Set(schSelectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSchSelectedIds(next);
    setSchSelectAll(next.size === scholarships.length && scholarships.length > 0);
  };

  const toggleSchSelectAll = () => {
    if (schSelectAll) {
      setSchSelectedIds(new Set());
      setSchSelectAll(false);
    } else {
      setSchSelectedIds(new Set(scholarships.map((s) => s.id)));
      setSchSelectAll(true);
    }
  };

  const handleBatchExportScholarships = async () => {
    if (schSelectedIds.size === 0) {
      alert("請先勾選需要導出的獎學金申請");
      return;
    }
    setSchExporting(true);
    try {
      await awardApi.batchExportScholarships(Array.from(schSelectedIds));
      setSchSelectedIds(new Set());
      setSchSelectAll(false);
    } catch (e: any) {
      alert("導出失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setSchExporting(false);
    }
  };

  const schColumns: Column<ScholarshipApplication>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={schSelectAll}
          onChange={toggleSchSelectAll}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      ),
      width: "40px",
      align: "center",
      render: (row) => (
        <input
          type="checkbox"
          checked={schSelectedIds.has(row.id)}
          onChange={() => toggleSchSelect(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      ),
    },
    {
      key: "student_name",
      header: "學生姓名",
      render: (row) => (
        <Link
          href={`/dashboard/apple/awards/scholarships/${row.id}`}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          {row.student_name}
        </Link>
      ),
    },
    {
      key: "student_class",
      header: "班級",
      width: "80px",
      render: (row) => row.student_class,
    },
    {
      key: "scholarship_type",
      header: "獎學金類型",
      width: "110px",
      render: (row) => row.scholarship_type,
    },
    {
      key: "academic_year",
      header: "學年",
      width: "90px",
      render: (row) => row.academic_year,
    },
    {
      key: "amount",
      header: "金額(HKD)",
      width: "110px",
      align: "right",
      render: (row) => `HK$${row.amount.toLocaleString()}`,
    },
    {
      key: "status",
      header: "狀態",
      width: "80px",
      render: (row) => {
        const s = SCHOLARSHIP_STATUS_MAP[row.status] || {
          label: row.status,
          className: "bg-gray-50 text-gray-600",
        };
        return (
          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${s.className}`}>
            {s.label}
          </span>
        );
      },
    },
    {
      key: "application_date",
      header: "申請日期",
      width: "100px",
      render: (row) => row.application_date || "-",
    },
    {
      key: "actions",
      header: "操作",
      width: "100px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          {row.status === "pending" && (
            <>
              <button
                onClick={() => handleReview(row.id, "approved")}
                disabled={reviewingId === row.id}
                className="p-1 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 disabled:opacity-50"
                title="通過"
              >
                <Check size={15} />
              </button>
              <button
                onClick={() => handleReview(row.id, "rejected")}
                disabled={reviewingId === row.id}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50"
                title="駁回"
              >
                <X size={15} />
              </button>
            </>
          )}
          {row.status === "approved" && (
            <button
              onClick={async () => {
                try {
                  await awardApi.downloadScholarshipCertificate(row.id);
                } catch (e) {
                  console.error("下載失敗", e);
                }
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600"
              title="下載證書"
            >
              <Download size={15} />
            </button>
          )}
          {row.status === "rejected" && (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      ),
    },
  ];

  // ==================== Render ====================

  return (
    <div>
      <PageHeader
        title="獎狀獎學金"
        subtitle="製作獎狀、管理獲獎名單、審批獎學金申請"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/apple/awards/create"
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition"
            >
              <Plus size={16} /> 新增獎狀
            </Link>
            <Link
              href="/dashboard/apple/awards/scholarships/apply"
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition"
            >
              <FileText size={16} /> 提交申請
            </Link>
            <Link
              href="/dashboard/apple/awards/statistics"
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <BarChart3 size={16} /> 統計分析
            </Link>
          </div>
        }
      />

      {/* Tab 切換 */}
      <div className="flex items-center gap-0 mb-5 border-b border-gray-200">
        <button
          onClick={() => setTab("awards")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "awards"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          獎狀列表
        </button>
        <button
          onClick={() => setTab("scholarships")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "scholarships"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          獎學金申請
        </button>
      </div>

      {/* 獎狀列表 */}
      {tab === "awards" && (
        <>
          <FilterBar
            fields={[
              { key: "title", label: "名稱", type: "text", placeholder: "搜尋獎狀名稱..." },
              { key: "status", label: "狀態", type: "select",
                options: [
                  { label: "草稿", value: "draft" },
                  { label: "已核算", value: "calculated" },
                  { label: "已確認", value: "confirmed" },
                  { label: "已取消", value: "cancelled" },
                ],
              },
            ]}
            values={awardsFilters}
            onChange={(k, v) => setAwardsFilters((prev) => ({ ...prev, [k]: v }))}
            onReset={() => { setAwardsFilters({}); setPage(1); }}
            onSearch={() => setPage(1)}
          />

          <div className="relative">
            <DataTable
              columns={awardColumns}
              data={awards}
              total={total}
              page={page}
              pageSize={20}
              onPageChange={setPage}
              loading={loading}
              emptyText="暫無獎狀數據，點擊「新增獎狀」開始製作"
            />

            {/* 批量導出浮動條 */}
            {awardSelectedIds.size > 0 && (
              <div className="sticky bottom-4 mt-4 flex items-center justify-between bg-primary-600 text-white px-5 py-3 rounded-xl shadow-lg">
                <span className="text-sm font-medium">
                  已選 {awardSelectedIds.size} 份獎狀
                </span>
                <button
                  onClick={handleBatchExportAwards}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-white text-primary-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download size={15} />
                  {exporting ? "導出中..." : "批量導出證書"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 獎學金申請列表 */}
      {tab === "scholarships" && (
        <>
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
            values={schFilters}
            onChange={(k, v) => setSchFilters((prev) => ({ ...prev, [k]: v }))}
            onReset={() => { setSchFilters({}); setSchPage(1); }}
            onSearch={() => setSchPage(1)}
          />

          <div className="relative">
            <DataTable
              columns={schColumns}
              data={scholarships}
              total={schTotal}
              page={schPage}
              pageSize={20}
              onPageChange={setSchPage}
              loading={schLoading}
              emptyText="暫無獎學金申請數據"
            />

            {/* 批量導出浮動條 */}
            {schSelectedIds.size > 0 && (
              <div className="sticky bottom-4 mt-4 flex items-center justify-between bg-primary-600 text-white px-5 py-3 rounded-xl shadow-lg">
                <span className="text-sm font-medium">
                  已選 {schSelectedIds.size} 筆申請
                </span>
                <button
                  onClick={handleBatchExportScholarships}
                  disabled={schExporting}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-white text-primary-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download size={15} />
                  {schExporting ? "導出中..." : "批量導出 PDF"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 刪除確認 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="確認刪除"
        message={`確定要刪除獎狀「${deleteTarget?.title}」嗎？此操作不可撤銷，獲獎學生資料也將一併刪除。`}
        variant="danger"
        confirmText="確認刪除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={actionLoading}
        danger
      />

      {/* 取消確認 */}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="確認取消"
        message={`確定要取消獎狀「${cancelTarget?.title}」嗎？取消後將不可恢復。`}
        variant="danger"
        confirmText="確認取消"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
        loading={actionLoading}
      />
    </div>
  );
}
