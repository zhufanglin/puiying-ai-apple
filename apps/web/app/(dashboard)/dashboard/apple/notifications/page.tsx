"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatsCard from "@/components/ui/StatsCard";
import DataTable, { type Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge";
import { api } from "@/lib/api";

interface NoticeTemplate {
  id: number;
  name: string;
  category: string;
  zh_content_template: string;
  en_content_template?: string | null;
  is_active: boolean;
}

interface NotificationRecord {
  id: number;
  template_id?: number | null;
  title_zh: string;
  title_en?: string | null;
  content_zh: string;
  content_en?: string | null;
  target_classes?: string | null;
  status: string;
  sent_at?: string | null;
  created_at?: string | null;
}

interface NotificationLog {
  id: number;
  notification_id: number;
  parent_phone: string;
  student_name: string;
  message_status: string;
  error_msg?: string | null;
  status_updated_at?: string | null;
  created_at?: string | null;
}

interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

const FALLBACK_CLASSES = ["中四A班", "中五B班", "中六A班"];

const DEFAULT_TEMPLATE = {
  name: "考試通知",
  category: "考试",
  zh_content_template:
    "各位家長：\n\n本校將於 {{date}} {{time}} 在 {{location}} 舉行 {{event}}。請同學準時出席，並帶備所需文具。\n\n如有查詢，請與班主任聯絡。",
  en_content_template:
    "Dear Parents,\n\nThe school will hold {{event}} on {{date}} at {{time}} in {{location}}. Students should attend punctually and bring the required stationery.\n\nFor enquiries, please contact the class teacher.",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  sent: "已發送",
  partial: "部分成功",
  failed: "發送失敗",
  delivered: "已送達",
  read: "已讀",
  pending: "待發送",
};

function unwrapList<T>(payload: any): T[] {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function renderTemplate(source: string, placeholders: Record<string, string>) {
  return Object.entries(placeholders).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    source
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 16).replace("T", " ");
}

function parseClasses(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<NoticeTemplate[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  });
  const [classes, setClasses] = useState(FALLBACK_CLASSES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [templateForm, setTemplateForm] = useState(DEFAULT_TEMPLATE);
  const [draft, setDraft] = useState({
    template_id: "",
    title_zh: "考試通知",
    title_en: "Examination Notice",
    event: "期末考試",
    date: "2026-07-24",
    time: "09:00",
    location: "禮堂",
    note: "",
    target_classes: ["中四A班"],
  });

  const selectedTemplate = templates.find((item) => String(item.id) === draft.template_id);
  const placeholders = {
    event: draft.event,
    date: draft.date,
    time: draft.time,
    location: draft.location,
    note: draft.note,
  };
  const previewZh = selectedTemplate
    ? renderTemplate(selectedTemplate.zh_content_template, placeholders)
    : renderTemplate(templateForm.zh_content_template, placeholders);
  const previewEn = selectedTemplate
    ? renderTemplate(selectedTemplate.en_content_template || "", placeholders)
    : renderTemplate(templateForm.en_content_template, placeholders);

  const filteredNotifications = notifications.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.keyword && !item.title_zh.includes(filters.keyword)) return false;
    return true;
  });

  const selectedNotification = notifications.find((item) => item.id === selectedId) || notifications[0];

  const loadData = async () => {
    setLoading(true);
    try {
      const [templateRes, notificationRes, statsRes, studentsRes] = await Promise.all([
        api.get<NoticeTemplate[]>("/apple/notifications/templates").catch(() => ({ data: [] })),
        api.get<{ items: NotificationRecord[] }>("/apple/notifications").catch(() => ({ data: { items: [] } })),
        api.get<NotificationStats>("/apple/notifications/stats").catch(() => ({ data: stats })),
        api.get<any>("/apple/students").catch(() => ({ data: [] })),
      ]);

      const nextTemplates = unwrapList<NoticeTemplate>(templateRes);
      const nextNotifications = unwrapList<NotificationRecord>(notificationRes);
      const nextStudents = unwrapList<{ className?: string }>(studentsRes);
      const nextClasses = Array.from(
        new Set(nextStudents.map((item) => item.className).filter(Boolean) as string[])
      );

      setTemplates(nextTemplates);
      setNotifications(nextNotifications);
      setStats(statsRes.data || stats);
      if (nextClasses.length) setClasses(nextClasses);
      if (!draft.template_id && nextTemplates[0]) {
        setDraft((current) => ({ ...current, template_id: String(nextTemplates[0].id) }));
      }
      if (!selectedId && nextNotifications[0]) setSelectedId(nextNotifications[0].id);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (notificationId: number | null) => {
    if (!notificationId) {
      setLogs([]);
      return;
    }
    try {
      const res = await api.get<NotificationLog[]>(`/apple/notifications/${notificationId}/logs`);
      setLogs(unwrapList<NotificationLog>(res));
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadLogs(selectedNotification?.id || null);
  }, [selectedNotification?.id]);

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const res = await api.post<NoticeTemplate>("/apple/notifications/templates", templateForm);
      const created = res.data;
      await loadData();
      if (created?.id) {
        setDraft((current) => ({ ...current, template_id: String(created.id) }));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "模板保存失敗");
    } finally {
      setSaving(false);
    }
  };

  const createNotification = async () => {
    if (!draft.template_id) {
      alert("請先選擇或新增通告模板");
      return;
    }
    if (draft.target_classes.length === 0) {
      alert("請至少選擇一個班級");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<NotificationRecord>("/apple/notifications", {
        template_id: Number(draft.template_id),
        title_zh: draft.title_zh,
        title_en: draft.title_en,
        target_classes: draft.target_classes,
        placeholders,
      });
      await loadData();
      if (res.data?.id) setSelectedId(res.data.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "通告保存失敗");
    } finally {
      setSaving(false);
    }
  };

  const sendNotification = async (notificationId: number) => {
    setSendingId(notificationId);
    try {
      await api.post(`/apple/notifications/${notificationId}/send`);
      await loadData();
      setSelectedId(notificationId);
      await loadLogs(notificationId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "發送失敗");
    } finally {
      setSendingId(null);
    }
  };

  const deleteTemplate = async (templateId: number) => {
    if (!confirm("確認停用此模板？")) return;
    try {
      await api.delete(`/apple/notifications/templates/${templateId}`);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "模板停用失敗");
    }
  };

  const toggleClass = (className: string) => {
    setDraft((current) => ({
      ...current,
      target_classes: current.target_classes.includes(className)
        ? current.target_classes.filter((item) => item !== className)
        : [...current.target_classes, className],
    }));
  };

  const notificationColumns: Column<NotificationRecord>[] = [
    {
      key: "title_zh",
      header: "通告",
      render: (row) => (
        <button
          onClick={() => setSelectedId(row.id)}
          className="text-left text-sm font-semibold text-primary-600 hover:underline"
        >
          {row.title_zh}
        </button>
      ),
    },
    {
      key: "target_classes",
      header: "班級",
      width: "160px",
      render: (row) => parseClasses(row.target_classes).join("、") || "-",
    },
    {
      key: "status",
      header: "狀態",
      width: "100px",
      render: (row) => <TaskStatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      header: "建立時間",
      width: "150px",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "actions",
      header: "操作",
      width: "110px",
      render: (row) => (
        <button
          onClick={() => sendNotification(row.id)}
          disabled={sendingId === row.id}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
        >
          <Send size={13} />
          {sendingId === row.id ? "發送中" : "發送"}
        </button>
      ),
    },
  ];

  const logColumns: Column<NotificationLog>[] = [
    { key: "student_name", header: "學生", width: "120px" },
    { key: "parent_phone", header: "家長 WhatsApp", width: "150px" },
    {
      key: "message_status",
      header: "狀態",
      width: "100px",
      render: (row) => <TaskStatusBadge status={row.message_status} />,
    },
    {
      key: "status_updated_at",
      header: "更新時間",
      width: "150px",
      render: (row) => formatDate(row.status_updated_at || row.created_at),
    },
    {
      key: "error_msg",
      header: "備註",
      render: (row) => row.error_msg || "-",
    },
  ];

  const templateCount = templates.length;
  const readRate = stats.total > 0 ? `${Math.round((stats.read / stats.total) * 100)}%` : "0%";

  return (
    <div className="space-y-5">
      <PageHeader
        title="通告管理"
        subtitle="家校通告、班級推送、WhatsApp 狀態追蹤"
        actions={
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={15} />
            重新整理
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <StatsCard label="通告模板" value={templateCount} icon={FileText} color="text-primary-600" />
        <StatsCard label="發送總數" value={stats.total} icon={Smartphone} color="text-[#155eef]" />
        <StatsCard label="已發送" value={stats.sent} icon={Send} color="text-[#23675f]" />
        <StatsCard label="已讀" value={stats.read} icon={Eye} color="text-[#027a48]" />
        <StatsCard label="已讀率" value={readRate} icon={CheckCircle} color="text-[#7c3aed]" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">模板</h3>
                <p className="mt-1 text-sm text-gray-500">共 {templates.length} 個</p>
              </div>
              <FileText size={20} className="text-primary-500" />
            </div>

            <div className="space-y-3">
              <input
                value={templateForm.name}
                onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                placeholder="模板名稱"
              />
              <select
                value={templateForm.category}
                onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
              >
                <option value="考试">考試</option>
                <option value="活动">活動</option>
                <option value="放假">放假</option>
                <option value="其他">其他</option>
              </select>
              <textarea
                value={templateForm.zh_content_template}
                onChange={(event) => setTemplateForm((current) => ({ ...current, zh_content_template: event.target.value }))}
                rows={5}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                placeholder="中文模板"
              />
              <textarea
                value={templateForm.en_content_template}
                onChange={(event) => setTemplateForm((current) => ({ ...current, en_content_template: event.target.value }))}
                rows={4}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                placeholder="英文模板"
              />
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              >
                <Plus size={15} />
                新增模板
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
                  <button
                    onClick={() => setDraft((current) => ({ ...current, template_id: String(template.id) }))}
                    className={`min-w-0 flex-1 text-left text-sm ${
                      draft.template_id === String(template.id) ? "font-semibold text-primary-700" : "text-gray-700"
                    }`}
                  >
                    <span className="block truncate">{template.name}</span>
                    <span className="text-xs text-gray-400">{template.category}</span>
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="停用模板"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {!templates.length && (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
                  暫無模板
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Megaphone size={20} className="text-primary-500" />
              <h3 className="text-base font-semibold text-gray-900">新建通告</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <select
                  value={draft.template_id}
                  onChange={(event) => setDraft((current) => ({ ...current, template_id: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                >
                  <option value="">選擇模板</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={draft.title_zh}
                    onChange={(event) => setDraft((current) => ({ ...current, title_zh: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                    placeholder="中文標題"
                  />
                  <input
                    value={draft.title_en}
                    onChange={(event) => setDraft((current) => ({ ...current, title_en: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                    placeholder="英文標題"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={draft.event}
                    onChange={(event) => setDraft((current) => ({ ...current, event: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                    placeholder="事項"
                  />
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                  />
                  <input
                    value={draft.location}
                    onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                    placeholder="地點"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {classes.map((className) => {
                    const checked = draft.target_classes.includes(className);
                    return (
                      <button
                        key={className}
                        onClick={() => toggleClass(className)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                          checked
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {className}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={createNotification}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  <Bell size={15} />
                  保存草稿
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 text-xs font-semibold text-gray-500">中文預覽</div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-900">{draft.title_zh}</h4>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{previewZh}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 text-xs font-semibold text-gray-500">English Preview</div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-900">{draft.title_en}</h4>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{previewEn || "-"}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <FilterBar
              fields={[
                {
                  key: "status",
                  label: "狀態",
                  type: "select",
                  options: [
                    { label: "草稿", value: "draft" },
                    { label: "已發送", value: "sent" },
                    { label: "部分成功", value: "partial" },
                    { label: "發送失敗", value: "failed" },
                  ],
                },
                { key: "keyword", label: "標題", type: "text", placeholder: "搜尋通告" },
              ]}
              values={filters}
              onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
              onReset={() => setFilters({})}
              onSearch={() => {}}
            />

            <DataTable
              columns={notificationColumns}
              data={filteredNotifications}
              total={filteredNotifications.length}
              loading={loading}
              emptyText="暫無通告記錄"
            />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">發送日誌</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedNotification ? selectedNotification.title_zh : "未選擇通告"}
                </p>
              </div>
              <Clock size={20} className="text-gray-400" />
            </div>
            <DataTable
              columns={logColumns}
              data={logs}
              total={logs.length}
              pageSize={10}
              emptyText="暫無發送日誌"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
