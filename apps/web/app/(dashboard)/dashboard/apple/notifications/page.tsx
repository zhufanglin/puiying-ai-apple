"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle,
  Eye,
  FileText,
  RefreshCw,
  Send,
  Smartphone,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatsCard from "@/components/ui/StatsCard";
import DataTable, { type Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { usePermission } from "@/hooks/usePermission";
import { NOTIFICATIONS_PERMISSIONS } from "@/lib/types/notification";
import * as notificationService from "@/lib/services/notification";
import type { NotificationRecord, NotificationStats } from "@/lib/types/notification";

// ========== 工具函数 ==========

function parseClasses(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  return value.slice(0, 16).replace("T", " ");
}

// ========== 页面组件 ==========

export default function NotificationsListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canSend = hasPermission(NOTIFICATIONS_PERMISSIONS.SEND);

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // ===== 数据加载 =====

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [notifRes, statsRes] = await Promise.all([
        notificationService.getNotifications({ page, page_size: pageSize }),
        notificationService.getStats(),
      ]);
      setNotifications(notifRes.items ?? []);
      setTotal(notifRes.total ?? 0);
      setStats(statsRes);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "加載數據失敗");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===== 筛选 =====

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (filters.status && item.status !== filters.status) return false;
      if (
        filters.keyword &&
        !item.title_zh.toLowerCase().includes(filters.keyword.toLowerCase())
      )
        return false;
      return true;
    });
  }, [notifications, filters]);

  // ===== 发送操作 =====

  const handleSend = async (id: number) => {
    setSendingId(id);
    try {
      const result = await notificationService.sendNotification(id);
      toast("success", `發送完成：成功 ${result.success}，失敗 ${result.failed}`);
      await loadData();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "發送失敗");
    } finally {
      setSendingId(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // ===== 统计指标 =====

  const readRate = stats.total > 0 ? `${Math.round((stats.read / stats.total) * 100)}%` : "0%";

  // ===== 表格列 =====

  const columns: Column<NotificationRecord>[] = [
    {
      key: "title_zh",
      header: "通告標題",
      render: (row) => (
        <button
          onClick={() => router.push(`/dashboard/apple/notifications/${row.id}`)}
          className="text-left text-sm font-semibold text-primary-600 hover:underline"
        >
          {row.title_zh}
        </button>
      ),
    },
    {
      key: "target_classes",
      header: "目標班級",
      width: "160px",
      render: (row) => {
        const classes = parseClasses(row.target_classes);
        return (
          <span className="text-sm text-gray-600">
            {classes.length > 0 ? classes.join("、") : "-"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "狀態",
      width: "100px",
      render: (row) => <TaskStatusBadge status={row.status} />,
    },
    {
      key: "sent_at",
      header: "發送時間",
      width: "150px",
      render: (row) => (
        <span className="text-sm text-gray-500">{formatDate(row.sent_at)}</span>
      ),
    },
    {
      key: "created_at",
      header: "創建時間",
      width: "150px",
      render: (row) => (
        <span className="text-sm text-gray-500">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      width: "130px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          {(row.status === "draft" || row.status === "failed" || row.status === "partial") &&
            canSend && (
              <button
                onClick={() => handleSend(row.id)}
                disabled={sendingId === row.id}
                className="inline-flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              >
                <Send size={12} />
                {sendingId === row.id ? "發送中" : "發送"}
              </button>
            )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="通告管理"
        subtitle="家校通告、班級推送、WhatsApp 狀態追蹤"
        actions={
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={15} />
              重新整理
            </button>
            <button
              onClick={() => router.push("/dashboard/apple/notifications/create")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
            >
              <Bell size={15} />
              新建通告
            </button>
          </div>
        }
      />

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          label="通告模板"
          value={notifications.length}
          icon={FileText}
          color="text-primary-600"
        />
        <StatsCard label="發送總數" value={stats.total} icon={Smartphone} color="text-[#155eef]" />
        <StatsCard label="已送達" value={stats.delivered} icon={Send} color="text-[#23675f]" />
        <StatsCard label="已讀" value={stats.read} icon={Eye} color="text-[#027a48]" />
        <StatsCard label="已讀率" value={readRate} icon={CheckCircle} color="text-[#7c3aed]" />
      </div>

      {/* 筛选 + 表格 */}
      <div className="space-y-3">
        <FilterBar
          fields={[
            {
              key: "status",
              label: "狀態",
              type: "select",
              options: [
                { label: "全部", value: "" },
                { label: "草稿", value: "draft" },
                { label: "已發送", value: "sent" },
                { label: "部分成功", value: "partial" },
                { label: "發送失敗", value: "failed" },
              ],
            },
            {
              key: "keyword",
              label: "標題",
              type: "text",
              placeholder: "搜尋通告標題",
            },
          ]}
          values={filters}
          onChange={(key, value) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
            setPage(1);
          }}
          onReset={() => {
            setFilters({});
            setPage(1);
          }}
          onSearch={() => {}}
        />

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <DataTable
            columns={columns}
            data={filteredNotifications}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            loading={loading}
            emptyText="暫無通告記錄"
          />
        </div>
      </div>
    </div>
  );
}
