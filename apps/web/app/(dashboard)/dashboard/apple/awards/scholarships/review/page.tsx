"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, ClipboardList } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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

export default function ReviewScholarshipsPage() {
  const [data, setData] = useState<ScholarshipApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // 審核彈窗
  const [reviewTarget, setReviewTarget] = useState<{ id: number; action: string } | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await awardApi.getScholarships({ ...filters, page, page_size: 20 });
      setData(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      console.error("獲取列表失敗", e);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReview = async () => {
    if (!reviewTarget) return;
    setReviewing(true);
    try {
      await awardApi.reviewScholarship(reviewTarget.id, {
        status: reviewTarget.action as "approved" | "rejected",
        review_comment: reviewComment || undefined,
      });
      setReviewTarget(null);
      setReviewComment("");
      fetchData();
    } catch (e) {
      console.error("審核失敗", e);
    } finally {
      setReviewing(false);
    }
  };

  const columns: Column<ScholarshipApplication>[] = [
    { key: "student_name", header: "學生姓名" },
    { key: "student_class", header: "班級" },
    { key: "scholarship_type", header: "類型", width: "12%" },
    { key: "academic_year", header: "學年", width: "10%" },
    { key: "amount", header: "金額(HKD)", width: "10%",
      render: (row) => `HK$ ${Number(row.amount).toLocaleString()}`,
    },
    { key: "reason", header: "申請理由", width: "20%",
      render: (row) => (
        <span className="text-gray-500 line-clamp-1">{row.reason || "-"}</span>
      ),
    },
    { key: "status", header: "狀態", width: "10%",
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: "actions", header: "審核", width: "16%", align: "center",
      render: (row) =>
        row.status === "pending" ? (
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => setReviewTarget({ id: row.id, action: "approved" })}
              className="flex items-center gap-1 px-2 py-1 text-xs text-green-700 bg-green-50 rounded hover:bg-green-100"
            >
              <CheckCircle size={13} /> 通過
            </button>
            <button
              onClick={() => setReviewTarget({ id: row.id, action: "rejected" })}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100"
            >
              <XCircle size={13} /> 駁回
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400">
            {row.status === "approved" ? "已通過" : "已駁回"}
          </span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="審核工作台"
        subtitle="審批學生獎學金申請"
      />

      <FilterBar
        fields={[
          { key: "student_name", label: "姓名", type: "text", placeholder: "搜尋學生..." },
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
          icon={ClipboardList}
          title="暫無待審核申請"
          description="所有獎學金申請已處理完畢"
        />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          total={total}
          page={page}
          pageSize={20}
          onPageChange={setPage}
          loading={loading}
        />
      )}

      <ConfirmDialog
        open={reviewTarget !== null}
        title={reviewTarget?.action === "approved" ? "確認通過" : "確認駁回"}
        message={
          reviewTarget?.action === "approved"
            ? "確定通過此獎學金申請？"
            : "確定駁回此獎學金申請？"
        }
        variant={reviewTarget?.action === "rejected" ? "danger" : "warning"}
        confirmText={reviewTarget?.action === "approved" ? "通過" : "駁回"}
        onConfirm={handleReview}
        onCancel={() => {
          setReviewTarget(null);
          setReviewComment("");
        }}
        loading={reviewing}
      />
    </div>
  );
}
