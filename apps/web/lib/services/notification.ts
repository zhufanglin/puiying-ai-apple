/**
 * 通告模块 API 服务层
 * 封装所有通告相关的后端 API 调用
 */
import { api } from "@/lib/api";
import type {
  ApiResponse,
  PaginatedData,
  NoticeTemplate,
  NoticeTemplateCreatePayload,
  NoticeTemplateUpdatePayload,
  NotificationRecord,
  NotificationCreatePayload,
  NotificationLog,
  NotificationStats,
  SendResult,
} from "@/lib/types/notification";

const BASE_PATH = "/apple/notifications";

// ========== 模板 ==========

/** 获取模板列表 */
export async function getTemplates(): Promise<NoticeTemplate[]> {
  const res = await api.get<NoticeTemplate[]>(`${BASE_PATH}/templates`);
  return res.data ?? [];
}

/** 创建模板 */
export async function createTemplate(
  data: NoticeTemplateCreatePayload
): Promise<NoticeTemplate> {
  const res = await api.post<NoticeTemplate>(`${BASE_PATH}/templates`, data);
  return res.data!;
}

/** 更新模板 */
export async function updateTemplate(
  id: number,
  data: NoticeTemplateUpdatePayload
): Promise<NoticeTemplate> {
  const res = await api.put<NoticeTemplate>(`${BASE_PATH}/templates/${id}`, data);
  return res.data!;
}

/** 删除（软删除）模板 */
export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`${BASE_PATH}/templates/${id}`);
}

// ========== 通告 ==========

/** 获取发送记录列表（分页） */
export async function getNotifications(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedData<NotificationRecord>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("page_size", String(params.page_size));

  const qs = searchParams.toString();
  const res = await api.get<PaginatedData<NotificationRecord>>(
    `${BASE_PATH}${qs ? `?${qs}` : ""}`
  );
  return (
    res.data ?? { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }
  );
}

/** 获取通告详情 */
export async function getNotification(
  id: number
): Promise<NotificationRecord> {
  const res = await api.get<NotificationRecord>(`${BASE_PATH}/${id}`);
  return res.data!;
}

/** 新建通告（保存草稿，后端自动生成内容） */
export async function createNotification(
  data: NotificationCreatePayload
): Promise<NotificationRecord> {
  const res = await api.post<NotificationRecord>(BASE_PATH, data);
  return res.data!;
}

/** 重新生成通告内容 */
export async function generateContent(
  id: number,
  placeholders: Record<string, string>
): Promise<NotificationRecord> {
  const res = await api.post<NotificationRecord>(
    `${BASE_PATH}/${id}/generate`,
    { placeholders }
  );
  return res.data!;
}

/** 发送通告（WhatsApp 推送） */
export async function sendNotification(id: number): Promise<SendResult> {
  const res = await api.post<SendResult>(`${BASE_PATH}/${id}/send`);
  return res.data!;
}

// ========== 日志 ==========

/** 获取通告发送日志 */
export async function getLogs(
  notificationId: number
): Promise<NotificationLog[]> {
  const res = await api.get<NotificationLog[]>(
    `${BASE_PATH}/${notificationId}/logs`
  );
  return res.data ?? [];
}

// ========== 统计 ==========

/** 获取全局发送统计 */
export async function getStats(): Promise<NotificationStats> {
  const res = await api.get<NotificationStats>(`${BASE_PATH}/stats`);
  return (
    res.data ?? { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 }
  );
}

// ========== PDF 导出 ==========

/**
 * 导出通告 PDF
 * TODO: 后端 PDF 端点待确认（schemas 有 pdf_path 字段，router 暂无 /{id}/pdf 端点）
 */
export async function downloadPdf(id: number): Promise<void> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`/api/v1${BASE_PATH}/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error("PDF 下載失敗");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `notification-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
