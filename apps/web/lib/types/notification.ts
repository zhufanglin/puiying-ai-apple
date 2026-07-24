/**
 * 通告模块类型定义
 * 与后端 Pydantic schemas 严格对齐
 * @see apps/api/app/modules/apple/notifications/schemas.py
 */

// ========== 通用响应包装 ==========

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ========== 通告模板 ==========

export interface NoticeTemplate {
  id: number;
  name: string;
  category: string;
  zh_content_template: string;
  en_content_template?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface NoticeTemplateCreatePayload {
  name: string;
  category: string;
  zh_content_template: string;
  en_content_template?: string | null;
}

export interface NoticeTemplateUpdatePayload {
  name?: string;
  category?: string;
  zh_content_template?: string;
  en_content_template?: string | null;
  is_active?: boolean;
}

// ========== 通告 ==========

export interface NotificationRecord {
  id: number;
  template_id?: number | null;
  title_zh: string;
  title_en?: string | null;
  content_zh: string;
  content_en?: string | null;
  target_classes?: string | null;
  status: NotificationStatus;
  pdf_path?: string | null;
  sent_at?: string | null;
  created_by: number;
  created_at?: string | null;
}

export interface NotificationCreatePayload {
  template_id: number;
  title_zh: string;
  title_en?: string | null;
  target_classes: string[];
  placeholders: Record<string, string>;
}

export interface NotificationGeneratePayload {
  placeholders: Record<string, string>;
}

export type NotificationStatus =
  | "draft"
  | "sent"
  | "partial"
  | "failed"
  | "pending";

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  sent: "已發送",
  partial: "部分成功",
  failed: "發送失敗",
  pending: "待發送",
};

// ========== 发送日志 ==========

export interface NotificationLog {
  id: number;
  notification_id: number;
  parent_phone: string;
  student_name: string;
  message_status: MessageStatus;
  error_msg?: string | null;
  status_updated_at?: string | null;
  created_at?: string | null;
}

export type MessageStatus = "sent" | "delivered" | "read" | "failed" | "pending";

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  sent: "已發送",
  delivered: "已送達",
  read: "已讀",
  failed: "失敗",
  pending: "待發送",
};

// ========== 统计 ==========

export interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

// ========== 发送结果 ==========

export interface SendResult {
  total: number;
  success: number;
  failed: number;
  status: string;
  error?: string;
}

// ========== 权限码 ==========

export const NOTIFICATIONS_PERMISSIONS = {
  READ: "apple:notifications:read",
  WRITE: "apple:notifications:write",
  SEND: "apple:notifications:send",
} as const;
