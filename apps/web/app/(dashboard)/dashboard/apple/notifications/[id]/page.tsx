"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  Phone,
  RefreshCw,
  Send,
  User,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatsCard from "@/components/ui/StatsCard";
import DataTable, { type Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge";
import { useToast } from "@/components/ui/ToastProvider";
import { usePermission } from "@/hooks/usePermission";
import { NOTIFICATIONS_PERMISSIONS, MESSAGE_STATUS_LABELS } from "@/lib/types/notification";
import * as notificationService from "@/lib/services/notification";
import type {
  NotificationRecord,
  NotificationLog,
  MessageStatus,
} from "@/lib/types/notification";

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

function formatFullDate(value?: string | null): string {
  if (!value) return "-";
  return value.slice(0, 19).replace("T", " ");
}

// ========== 页面组件 ==========

export default function NotificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canSend = hasPermission(NOTIFICATIONS_PERMISSIONS.SEND);

  const [notification, setNotification] = useState<NotificationRecord | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("");

  // ===== 数据加载 =====

  const loadData = useCallback(async () => {
    if (!id || isNaN(id)) return;
    setLoading(true);
    try {
      const [notif, logList] = await Promise.all([
        notificationService.getNotification(id),
        notificationService.getLogs(id),
      ]);
      setNotification(notif);
      setLogs(logList);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "加載詳情失敗");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===== 日志筛选 =====

  const filteredLogs = useMemo(() => {
    if (!logFilter) return logs;
    return logs.filter((l) => l.message_status === logFilter);
  }, [logs, logFilter]);

  // ===== 日志统计 =====

  const logStats = useMemo(() => {
    const counts: Record<string, number> = { sent: 0, delivered: 0, read: 0, failed: 0 };
    logs.forEach((l) => {
      if (counts[l.message_status] !== undefined) {
        counts[l.message_status]++;
      }
    });
    return counts;
  }, [logs]);

  // ===== 操作 =====

  const handleSend = async () => {
    if (!notification) return;
    setSending(true);
    try {
      const result = await notificationService.sendNotification(notification.id);
      toast("success", `發送完成：成功 ${result.success}，失敗 ${result.failed}`);
      await loadData();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "發送失敗");
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async () => {
    // 重新发送：复用 send 接口
    await handleSend();
  };

  const handleExportPdf = async () => {
    if (!notification) return;
    setPdfLoading(true);
    try {
      await notificationService.downloadPdf(notification.id);
    } catch {
      // 后端 PDF 端点可能未就绪
      toast("warning", "PDF 導出暫不可用，請聯絡後端開發人員");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEdit = () => {
    if (!notification) return;
    router.push(`/dashboard/apple/notifications/create?edit=${notification.id}`);
  };

  // ===== 表格列 =====

  const logColumns: Column<NotificationLog>[] = [
    {
      key: "student_name",
      header: "學生",
      width: "120px",
      render: (row) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400" />
          <span className="text-sm text-gray-900">{row.student_name || "-"}</span>
        </div>
      ),
    },
    {
      key: "parent_phone",
      header: "家長 WhatsApp",
      width: "160px",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-gray-400" />
          <span className="text-sm font-mono text-gray-600">{row.parent_phone}</span>
        </div>
      ),
    },
    {
      key: "message_status",
      header: "狀態",
      width: "100px",
      render: (row) => <TaskStatusBadge status={row.message_status} />,
    },
    {
      key: "status_updated_at",
      header: "更新時間",
      width: "160px",
      render: (row) => (
        <span className="text-sm text-gray-500">
          {formatDate(row.status_updated_at || row.created_at)}
        </span>
      ),
    },
    {
      key: "error_msg",
      header: "備註",
      render: (row) => (
        <span className="text-sm text-gray-500">{row.error_msg || "-"}</span>
      ),
    },
  ];

  const targetClasses = parseClasses(notification?.target_classes);

  if (loading && !notification) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="通告詳情"
          subtitle="加載中..."
          backHref="/dashboard/apple/notifications"
        />
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          加載中...
        </div>
      </div>
    );
  }

  if (!loading && !notification) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="通告詳情"
          subtitle="通告不存在"
          backHref="/dashboard/apple/notifications"
        />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <FileText size={48} className="mb-4 text-gray-300" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">通告不存在</h3>
          <p className="mb-4 text-sm text-gray-500">該通告可能已被刪除或 ID 不正確</p>
          <button
            onClick={() => router.push("/dashboard/apple/notifications")}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={notification!.title_zh}
        subtitle={
          notification!.title_en
            ? `${notification!.title_en} · ${formatDate(notification!.created_at)}`
            : `創建於 ${formatDate(notification!.created_at)}`
        }
        backHref="/dashboard/apple/notifications"
        actions={
          <div className="flex gap-2">
            {notification!.status === "draft" && (
              <button
                onClick={handleEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Edit3 size={15} />
                編輯
              </button>
            )}
            {(notification!.status === "draft" ||
              notification!.status === "failed" ||
              notification!.status === "partial") &&
              canSend && (
                <button
                  onClick={handleRetry}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  <RefreshCw size={15} />
                  {sending ? "發送中..." : "重新發送"}
                </button>
              )}
            {notification!.status === "draft" && canSend && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              >
                <Send size={15} />
                {sending ? "發送中..." : "立即發送"}
              </button>
            )}
            <button
              onClick={handleExportPdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={15} />
              {pdfLoading ? "下載中..." : "導出 PDF"}
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={15} />
              刷新
            </button>
          </div>
        }
      />

      {/* 基本信息 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 通告信息卡片 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-900">通告信息</h3>
          <div className="space-y-3">
            <InfoRow label="狀態">
              <TaskStatusBadge status={notification!.status} />
            </InfoRow>
            <InfoRow label="中文標題">{notification!.title_zh}</InfoRow>
            {notification!.title_en && (
              <InfoRow label="英文標題">{notification!.title_en}</InfoRow>
            )}
            <InfoRow label="目標班級">
              <div className="flex flex-wrap gap-1">
                {targetClasses.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                  >
                    {c}
                  </span>
                ))}
                {targetClasses.length === 0 && "-"}
              </div>
            </InfoRow>
            <InfoRow label="發送時間">{formatFullDate(notification!.sent_at)}</InfoRow>
            <InfoRow label="創建時間">{formatFullDate(notification!.created_at)}</InfoRow>
          </div>
        </div>

        {/* 内容卡片 */}
        <div className="space-y-4">
          {/* 中文内容 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">中文內容</h3>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">中文</span>
            </div>
            <div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-700">
              {notification!.content_zh || "（無內容）"}
            </div>
          </div>
          {/* 英文内容 */}
          {notification!.content_en && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">English Content</h3>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">EN</span>
              </div>
              <div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {notification!.content_en}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 日志统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatsCard
          label="已發送"
          value={logStats.sent}
          icon={Send}
          color="text-blue-600"
        />
        <StatsCard
          label="已送達"
          value={logStats.delivered}
          icon={Clock}
          color="text-amber-600"
        />
        <StatsCard
          label="已讀"
          value={logStats.read}
          icon={Eye}
          color="text-green-600"
        />
        <StatsCard
          label="失敗"
          value={logStats.failed}
          icon={Send}
          color="text-red-600"
        />
      </div>

      {/* 发送日志列表 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">發送日誌</h3>
            <p className="mt-1 text-sm text-gray-500">
              共 {logs.length} 條記錄
            </p>
          </div>
          <Clock size={20} className="text-gray-400" />
        </div>

        {logs.length > 0 && (
          <div className="mb-4">
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="w-40 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-400 focus:outline-none"
            >
              <option value="">全部狀態</option>
              <option value="sent">已發送</option>
              <option value="delivered">已送達</option>
              <option value="read">已讀</option>
              <option value="failed">失敗</option>
            </select>
          </div>
        )}

        <DataTable
          columns={logColumns}
          data={filteredLogs}
          total={filteredLogs.length}
          pageSize={15}
          loading={loading}
          emptyText="暫無發送日誌"
        />
      </div>
    </div>
  );
}

/** 详情信息行 */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex">
      <span className="w-24 shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{children}</span>
    </div>
  );
}
