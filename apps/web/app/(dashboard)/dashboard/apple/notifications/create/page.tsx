"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Megaphone, Pause, Play, RefreshCw, Save, Send } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { usePermission } from "@/hooks/usePermission";
import SendConfirmDialog from "@/components/ui/SendConfirmDialog";
import { NOTIFICATIONS_PERMISSIONS } from "@/lib/types/notification";
import * as notificationService from "@/lib/services/notification";
import type { NoticeTemplate, NotificationRecord } from "@/lib/types/notification";

// ========== 工具函数 ==========

/** 从模板内容中提取占位符 {{xxx}} */
function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/[{}]/g, "")))];
}

/** 渲染模板：替换占位符 */
function renderTemplate(source: string, placeholders: Record<string, string>): string {
  return Object.entries(placeholders).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value || `{{${key}}}`),
    source
  );
}

/** 解析 JSON target_classes */
function parseClasses(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// ========== 页面组件 ==========

export default function CreateNotificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canSend = hasPermission(NOTIFICATIONS_PERMISSIONS.SEND);

  // 数据
  const [templates, setTemplates] = useState<NoticeTemplate[]>([]);
  const [classes, setClasses] = useState<string[]>(["中四A班", "中五B班", "中六A班"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 编辑模式
  const [existingNotification, setExistingNotification] = useState<NotificationRecord | null>(null);

  // 表单状态
  const [templateId, setTemplateId] = useState<string>("");
  const [titleZh, setTitleZh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({
    event: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    location: "",
    note: "",
  });
  const [targetClasses, setTargetClasses] = useState<string[]>([]);

  // 手动编辑预览内容（AI 生成后允许修改）
  const [manualContentZh, setManualContentZh] = useState("");
  const [manualContentEn, setManualContentEn] = useState("");

  // 选中的模板
  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === templateId),
    [templates, templateId]
  );

  // 从模板提取占位符列表
  const placeholderKeys = useMemo(() => {
    if (!selectedTemplate) return [];
    return extractPlaceholders(selectedTemplate.zh_content_template);
  }, [selectedTemplate]);

  // 预览内容
  const previewZh = useMemo(() => {
    if (manualContentZh) return manualContentZh;
    if (!selectedTemplate) return "";
    return renderTemplate(selectedTemplate.zh_content_template, placeholders);
  }, [selectedTemplate, placeholders, manualContentZh]);

  const previewEn = useMemo(() => {
    if (manualContentEn) return manualContentEn;
    if (!selectedTemplate?.en_content_template) return "";
    return renderTemplate(selectedTemplate.en_content_template, placeholders);
  }, [selectedTemplate, placeholders, manualContentEn]);

  // ===== 数据加载 =====

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templateList, studentsRes] = await Promise.all([
        notificationService.getTemplates(),
        fetch("/api/v1/apple/students", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        })
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
      ]);

      setTemplates(templateList);

      // 解析班级
      const students = studentsRes?.data ?? [];
      if (Array.isArray(students)) {
        const cls = Array.from(
          new Set(
            students
              .map((s: any) => s.className || s.class_name)
              .filter(Boolean) as string[]
          )
        );
        if (cls.length) setClasses(cls);
      }

      // 自动选择第一个模板
      if (!templateId && templateList.length > 0) {
        setTemplateId(String(templateList[0].id));
      }
    } catch (err) {
      toast("error", "加載數據失敗");
    } finally {
      setLoading(false);
    }
  }, [templateId, toast]);

  // 编辑模式：加载已有通告
  const loadExisting = useCallback(async () => {
    if (!editId) return;
    try {
      const notification = await notificationService.getNotification(Number(editId));
      setExistingNotification(notification);

      // 回填表单
      if (notification.template_id) {
        setTemplateId(String(notification.template_id));
      }
      setTitleZh(notification.title_zh);
      setTitleEn(notification.title_en ?? "");
      setTargetClasses(parseClasses(notification.target_classes));
      setManualContentZh(notification.content_zh);
      setManualContentEn(notification.content_en ?? "");
    } catch {
      toast("error", "加載編輯數據失敗");
    }
  }, [editId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (editId) loadExisting();
  }, [editId, loadExisting]);

  // ===== 操作 =====

  /** 更新占位符值 */
  const updatePlaceholder = (key: string, value: string) => {
    setPlaceholders((prev) => ({ ...prev, [key]: value }));
    // 编辑占位符时清除手动内容，使用模板替换
    setManualContentZh("");
    setManualContentEn("");
  };

  /** 切换班级选择 */
  const toggleClass = (cls: string) => {
    setTargetClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  /** 切换模板 */
  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    setManualContentZh("");
    setManualContentEn("");
  };

  /** AI 生成：调用后端 generateContent */
  const handleGenerate = async () => {
    if (!existingNotification) {
      // 先保存草稿
      const saved = await saveAsDraft();
      if (!saved) return;
      setExistingNotification(saved);
    }

    setSaving(true);
    try {
      const updated = await notificationService.generateContent(
        existingNotification!.id,
        placeholders
      );
      setExistingNotification(updated);
      setManualContentZh(updated.content_zh);
      setManualContentEn(updated.content_en ?? "");
      toast("success", "AI 生成完成");
    } catch (err) {
      // AI 生成失败时使用前端模板替换
      toast("warning", "AI 生成暫不可用，已使用模板替換預覽");
    } finally {
      setSaving(false);
    }
  };

  /** 保存草稿 */
  const saveAsDraft = async (): Promise<NotificationRecord | null> => {
    if (!templateId) {
      toast("error", "請選擇模板");
      return null;
    }
    if (targetClasses.length === 0) {
      toast("error", "請至少選擇一個班級");
      return null;
    }
    if (!titleZh.trim()) {
      toast("error", "請輸入中文標題");
      return null;
    }

    setSaving(true);
    try {
      const payload = {
        template_id: Number(templateId),
        title_zh: titleZh.trim(),
        title_en: titleEn.trim() || undefined,
        target_classes: targetClasses,
        placeholders,
      };

      const notification = await notificationService.createNotification(payload);
      toast("success", "草稿已保存");
      return notification;
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "保存失敗");
      return null;
    } finally {
      setSaving(false);
    }
  };

  /** 保存草稿按钮 */
  const handleSaveDraft = async () => {
    const result = await saveAsDraft();
    if (result) {
      setExistingNotification(result);
    }
  };

  /** 立即发送 - 打开确认弹窗 */
  const handleSendClick = async () => {
    // 如果还没保存，先保存
    if (!existingNotification) {
      const saved = await saveAsDraft();
      if (!saved) return;
      setExistingNotification(saved);
    }
    setConfirmOpen(true);
  };

  /** 确认发送 */
  const handleConfirmSend = async () => {
    if (!existingNotification) return;

    setSending(true);
    try {
      const result = await notificationService.sendNotification(existingNotification.id);
      toast("success", `發送完成：成功 ${result.success}，失敗 ${result.failed}`);
      setConfirmOpen(false);
      // 跳转到详情页
      router.push(`/dashboard/apple/notifications/${existingNotification.id}`);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "發送失敗");
    } finally {
      setSending(false);
    }
  };

  /** 估算发送人数 */
  const estimatedRecipients = useMemo(() => {
    if (targetClasses.length === 0) return 0;
    // 粗略估算每班30人
    // TODO: 调用 /api/v1/classes/{id}/students/count 获取精确人数
    return targetClasses.length * 30;
  }, [targetClasses]);

  // ===== 渲染 =====

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="新建通告" subtitle="選擇模板、填寫信息、發送通告" />
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          加載中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={editId ? "編輯通告" : "新建通告"}
        subtitle="選擇模板、填寫信息、AI 生成中英文通告、選擇班級發送"
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* ===== 左侧：表单区 ===== */}
        <div className="space-y-5">
          {/* 步骤1：选择模板 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                1
              </span>
              <h3 className="text-base font-semibold text-gray-900">選擇模板</h3>
            </div>
            <select
              value={templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
            >
              <option value="">-- 選擇模板 --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（{t.category}）
                </option>
              ))}
            </select>
          </div>

          {/* 步骤2：填写占位符 */}
          {selectedTemplate && placeholderKeys.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                  2
                </span>
                <h3 className="text-base font-semibold text-gray-900">填寫信息</h3>
              </div>

              <div className="space-y-3">
                {/* 标题 */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      中文標題 <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={titleZh}
                      onChange={(e) => setTitleZh(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                      placeholder="如：考試通知"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      英文標題
                    </label>
                    <input
                      value={titleEn}
                      onChange={(e) => setTitleEn(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                      placeholder="如：Examination Notice"
                    />
                  </div>
                </div>

                {/* 占位符输入 */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {placeholderKeys.map((key) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs font-semibold text-gray-500 capitalize">
                        {key === "event"
                          ? "事項"
                          : key === "date"
                            ? "日期"
                            : key === "time"
                              ? "時間"
                              : key === "location"
                                ? "地點"
                                : key === "note"
                                  ? "備註"
                                  : key}
                      </label>
                      <input
                        type={key === "date" ? "date" : key === "time" ? "time" : "text"}
                        value={placeholders[key] ?? ""}
                        onChange={(e) => updatePlaceholder(key, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                        placeholder={key}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 步骤3：AI 生成 */}
          {selectedTemplate && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                  3
                </span>
                <h3 className="text-base font-semibold text-gray-900">AI 生成</h3>
              </div>
              <button
                onClick={handleGenerate}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              >
                <Megaphone size={16} />
                {saving ? "生成中..." : "AI 生成中英文通告"}
              </button>
              <p className="mt-2 text-xs text-gray-400">
                根據模板和填寫的信息，AI 將生成正式的中英文雙語通告。
              </p>
            </div>
          )}

          {/* 步骤4：选择班级 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                4
              </span>
              <h3 className="text-base font-semibold text-gray-900">
                選擇班級 <span className="text-xs font-normal text-gray-400">（多選）</span>
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {classes.map((cls) => {
                const checked = targetClasses.includes(cls);
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => toggleClass(cls)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      checked
                        ? "border-primary-500 bg-primary-50 text-primary-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {cls}
                  </button>
                );
              })}
            </div>

            {targetClasses.length > 0 && (
              <p className="mt-3 text-xs text-gray-400">
                已選 {targetClasses.length} 個班級，預計約 {estimatedRecipients} 位家長
              </p>
            )}
          </div>

          {/* 步骤5：操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "保存中..." : "保存草稿"}
            </button>

            <button
              onClick={handleSendClick}
              disabled={saving || !canSend}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              title={!canSend ? "無發送權限" : undefined}
            >
              <Bell size={16} />
              立即發送
            </button>
          </div>

          {/* 可选：批次发送控制（预留扩展点） */}
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Pause size={16} className="text-gray-400" />
              <h4 className="text-sm font-semibold text-gray-500">批次發送控制</h4>
            </div>
            <p className="text-xs text-gray-400">
              發送過程中可暫停/繼續。
              {/* TODO: 待後端提供 POST /{id}/pause 和 POST /{id}/resume 端點 */}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                disabled
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-400"
              >
                <Pause size={13} />
                暫停
              </button>
              <button
                disabled
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-400"
              >
                <Play size={13} />
                繼續
              </button>
            </div>
          </div>
        </div>

        {/* ===== 右侧：预览区 ===== */}
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-base font-semibold text-gray-900">預覽</h3>

            {!selectedTemplate ? (
              <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-400">
                <FileIcon size={32} className="mb-2 text-gray-300" />
                請先選擇模板
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {/* 中文预览 */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-gray-400">中文預覽</div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">
                      {titleZh || "（未填寫標題）"}
                    </h4>
                    <div className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                      {previewZh || "（模板替換後顯示）"}
                    </div>
                  </div>
                  {/* 手动编辑 */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-primary-600 hover:underline">
                      手動編輯中文內容
                    </summary>
                    <textarea
                      value={manualContentZh}
                      onChange={(e) => setManualContentZh(e.target.value)}
                      rows={6}
                      className="mt-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                      placeholder="手動編輯中文內容..."
                    />
                  </details>
                </div>

                {/* 英文预览 */}
                <div>
                  <div className="mb-2 text-xs font-semibold text-gray-400">English Preview</div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">
                      {titleEn || "(Untitled)"}
                    </h4>
                    <div className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                      {previewEn || "(Preview after template rendering)"}
                    </div>
                  </div>
                  {/* 手动编辑 */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-primary-600 hover:underline">
                      Edit English Content
                    </summary>
                    <textarea
                      value={manualContentEn}
                      onChange={(e) => setManualContentEn(e.target.value)}
                      rows={6}
                      className="mt-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                      placeholder="Edit English content..."
                    />
                  </details>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 发送确认弹窗 */}
      <SendConfirmDialog
        open={confirmOpen}
        titleZh={titleZh || existingNotification?.title_zh || ""}
        titleEn={titleEn || existingNotification?.title_en}
        targetClasses={targetClasses}
        estimatedRecipients={estimatedRecipients}
        contentPreview={previewZh}
        loading={sending}
        onConfirm={handleConfirmSend}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/** 内联 FileIcon（避免额外 import） */
function FileIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
