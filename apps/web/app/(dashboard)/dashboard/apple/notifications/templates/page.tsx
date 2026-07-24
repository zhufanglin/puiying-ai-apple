"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Search, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { type Column } from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { usePermission } from "@/hooks/usePermission";
import { NOTIFICATIONS_PERMISSIONS } from "@/lib/types/notification";
import * as notificationService from "@/lib/services/notification";
import type { NoticeTemplate } from "@/lib/types/notification";

// ========== 表单 Schema ==========

const CATEGORY_VALUES = ["考试", "活動", "活动", "放假", "其他"] as const;

const templateSchema = z.object({
  name: z.string().min(1, "模板名稱不能為空").max(100, "最多100字"),
  category: z.enum(CATEGORY_VALUES, { message: "請選擇分類" }),
  zh_content_template: z.string().min(1, "中文模板不能為空"),
  en_content_template: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

// ========== 辅助函数 ==========

const CATEGORY_LABELS: Record<string, string> = {
  "考试": "考試",
  "活動": "活動",
  "活动": "活動",
  "放假": "放假",
  "其他": "其他",
};

// ========== 页面组件 ==========

export default function TemplatesPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission(NOTIFICATIONS_PERMISSIONS.WRITE);

  const [templates, setTemplates] = useState<NoticeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NoticeTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoticeTemplate | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      category: "其他",
      zh_content_template: "",
      en_content_template: "",
      is_active: true,
    },
  });

  const isActive = watch("is_active");

  // ===== 数据加载 =====

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationService.getTemplates();
      setTemplates(data);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "加載模板失敗");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ===== 筛选 =====

  const filteredTemplates = templates.filter((t) =>
    !search
      ? true
      : t.name.toLowerCase().includes(search.toLowerCase())
  );

  // ===== 表单操作 =====

  const openCreateDialog = () => {
    setEditingTemplate(null);
    reset({
      name: "",
      category: "其他",
      zh_content_template: "",
      en_content_template: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (template: NoticeTemplate) => {
    setEditingTemplate(template);
    reset({
      name: template.name,
      category: template.category as TemplateFormValues["category"],
      zh_content_template: template.zh_content_template,
      en_content_template: template.en_content_template ?? "",
      is_active: template.is_active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const onSubmit = async (values: TemplateFormValues) => {
    setSaving(true);
    try {
      if (editingTemplate) {
        await notificationService.updateTemplate(editingTemplate.id, values);
        toast("success", "模板已更新");
      } else {
        await notificationService.createTemplate(values);
        toast("success", "模板已創建");
      }
      closeDialog();
      await loadTemplates();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "保存失敗");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await notificationService.deleteTemplate(deleteTarget.id);
      toast("success", "模板已刪除");
      setDeleteTarget(null);
      await loadTemplates();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "刪除失敗");
    }
  };

  // ===== 表格列 =====

  const columns: Column<NoticeTemplate>[] = [
    {
      key: "name",
      header: "模板名稱",
      render: (row) => (
        <span className="text-sm font-semibold text-gray-900">{row.name}</span>
      ),
    },
    {
      key: "category",
      header: "分類",
      width: "100px",
      render: (row) => (
        <span className="inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
          {CATEGORY_LABELS[row.category] || row.category}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "狀態",
      width: "80px",
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.is_active
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {row.is_active ? "啟用" : "停用"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      width: "120px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          {canWrite && (
            <>
              <button
                onClick={() => openEditDialog(row)}
                className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
              >
                編輯
              </button>
              <button
                onClick={() => setDeleteTarget(row)}
                className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                刪除
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="通告模板"
        subtitle="管理家校通告模板，含中英文內容"
        actions={
          canWrite && (
            <button
              onClick={openCreateDialog}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
            >
              <Plus size={15} />
              新增模板
            </button>
          )
        }
      />

      {/* 搜索栏 */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <Search size={18} className="text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm text-gray-700 outline-none placeholder:text-gray-400"
          placeholder="搜尋模板名稱..."
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 数据表格 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <DataTable
          columns={columns}
          data={filteredTemplates}
          total={filteredTemplates.length}
          loading={loading}
          emptyText="暫無模板，點擊上方按鈕創建"
        />
      </div>

      {/* 新建/编辑弹窗 */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeDialog}
        >
          <div
            className="mx-4 w-full max-w-xl rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingTemplate ? "編輯模板" : "新增模板"}
              </h3>
              <button
                onClick={closeDialog}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
              {/* 名称 */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  模板名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("name")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                  placeholder="如：考試通知、家長會通知"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* 分类 */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">分類</label>
                <select
                  {...register("category")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                >
                  <option value="考试">考試</option>
                  <option value="活动">活動</option>
                  <option value="放假">放假</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              {/* 中文模板 */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  中文模板 <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register("zh_content_template")}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                  placeholder={'各位家長：\n\n本校將於 {{date}} {{time}} 在 {{location}} 舉行 {{event}}...\n\n支援占位符：{{date}} {{time}} {{location}} {{event}} {{note}}'}
                />
                {errors.zh_content_template && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.zh_content_template.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  支援占位符：{"{{date}} {{time}} {{location}} {{event}} {{note}}"}
                </p>
              </div>

              {/* 英文模板 */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  英文模板 <span className="text-xs font-normal text-gray-400">（可選）</span>
                </label>
                <textarea
                  {...register("en_content_template")}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                  placeholder="Dear Parents, ..."
                />
              </div>

              {/* 启用状态 */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">啟用狀態</label>
                <button
                  type="button"
                  onClick={() => setValue("is_active", !isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive ? "bg-primary-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      isActive ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-500">
                  {isActive ? "啟用" : "停用"}
                </span>
              </div>

              {/* 按钮 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  {saving ? "保存中..." : editingTemplate ? "更新" : "創建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="刪除模板"
        message={`確定要刪除模板「${deleteTarget?.name}」嗎？此操作無法撤銷。`}
        variant="danger"
        confirmText="確定刪除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
