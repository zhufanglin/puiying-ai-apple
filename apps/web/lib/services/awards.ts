/* ============================================================
 * 獎狀 & 獎學金 — 前端 API 調用服務
 *
 * 所有後端 API 調用集中在此文件，支持：
 * - 獎狀模板 CRUD
 * - 獎狀 CRUD + 狀態操作
 * - 獲獎學生管理
 * - 獎學金 CRUD + 審核
 * - 統計看板數據
 *
 * 使用方法：
 *   import { awardApi } from "@/lib/services/awards";
 *   const list = await awardApi.getAwards({ page: 1 });
 * ============================================================ */

import { api } from "@/lib/api";
import type {
  ApiResponse,
  PaginatedData,
  AwardTemplate,
  AwardTemplateQuery,
  Award,
  AwardListItem,
  AwardQuery,
  AwardCreatePayload,
  AwardUpdatePayload,
  AwardRecipient,
  AwardRecipientCreatePayload,
  ScholarshipApplication,
  ScholarshipQuery,
  ScholarshipApplyPayload,
  ScholarshipReviewPayload,
  AwardsDashboardStats,
  CalculateResult,
  ScriptOut,
  CertificateRequestPayload,
  BatchGenerateData,
} from "@/lib/types/awards";

/** 獎狀 & 獎學金 API 集合 */
export const awardApi = {
  // ==================== 統計 ====================

  /** 獲取綜合統計數據 */
  getStatistics: () =>
    api.get<AwardsDashboardStats>("/apple/awards/statistics"),

  // ==================== 獎狀模板 ====================

  /** 查詢獎狀模板列表 */
  getTemplates: (params?: AwardTemplateQuery) => {
    const search = new URLSearchParams();
    if (params?.name) search.set("name", params.name);
    if (params?.category) search.set("category", params.category);
    if (params?.is_active !== undefined) search.set("is_active", String(params.is_active));
    if (params?.page) search.set("page", String(params.page));
    if (params?.page_size) search.set("page_size", String(params.page_size));
    const qs = search.toString();
    return api.get<PaginatedData<AwardTemplate>>(`/apple/awards/templates${qs ? `?${qs}` : ""}`);
  },

  /** 獲取單個獎狀模板 */
  getTemplate: (id: number) =>
    api.get<AwardTemplate>(`/apple/awards/templates/${id}`),

  /** 創建獎狀模板 */
  createTemplate: (data: { name: string; category?: string; description?: string }) =>
    api.post<AwardTemplate>("/apple/awards/templates", data),

  /** 更新獎狀模板 */
  updateTemplate: (id: number, data: Partial<AwardTemplate>) =>
    api.put<AwardTemplate>(`/apple/awards/templates/${id}`, data),

  /** 刪除獎狀模板 */
  deleteTemplate: (id: number) =>
    api.delete<{ deleted: boolean }>(`/apple/awards/templates/${id}`),

  // ==================== 獎狀 ====================

  /** 查詢獎狀列表 */
  getAwards: (params?: AwardQuery) => {
    const search = new URLSearchParams();
    if (params?.title) search.set("title", params.title);
    if (params?.template_id) search.set("template_id", String(params.template_id));
    if (params?.status) search.set("status", params.status);
    if (params?.date_from) search.set("date_from", params.date_from);
    if (params?.date_to) search.set("date_to", params.date_to);
    if (params?.page) search.set("page", String(params.page));
    if (params?.page_size) search.set("page_size", String(params.page_size));
    const qs = search.toString();
    return api.get<PaginatedData<AwardListItem>>(`/apple/awards${qs ? `?${qs}` : ""}`);
  },

  /** 獲取單個獎狀詳情（含模板 + 獲獎名單） */
  getAward: (id: number) =>
    api.get<Award>(`/apple/awards/${id}`),

  /** 創建獎狀（含獲獎學生） */
  createAward: (data: AwardCreatePayload) =>
    api.post<Award>("/apple/awards", data),

  /** 更新獎狀基本信息 */
  updateAward: (id: number, data: AwardUpdatePayload) =>
    api.put<Award>(`/apple/awards/${id}`, data),

  /** 刪除獎狀 */
  deleteAward: (id: number) =>
    api.delete<{ deleted: boolean }>(`/apple/awards/${id}`),

  /** 批量刪除獎狀 */
  batchDeleteAwards: (ids: number[]) =>
    api.post<{ deleted_count: number; total: number }>("/apple/awards/batch-delete", { ids }),

  /** 確認獎狀（draft/calculated → confirmed） */
  publishAward: (id: number) =>
    api.post<Award>(`/apple/awards/${id}/publish`),

  /** 取消獎狀（→ cancelled） */
  cancelAward: (id: number) =>
    api.post<Award>(`/apple/awards/${id}/cancel`),

  // ==================== 批量生成 ====================

  /** 批量生成獎狀文檔 */
  batchGenerate: (data: {
    template_id: number;
    recipients: { student_name: string; student_class: string }[];
    issue_date: string;
    award_year: string;
  }) => api.post<BatchGenerateData>(
    "/apple/awards/batch-generate", { ...data, output_format: "pdf" }
  ),

  // ==================== 獲獎學生 ====================

  /** 批量添加獲獎學生 */
  addRecipients: (awardId: number, recipients: AwardRecipientCreatePayload[]) =>
    api.post<AwardRecipient[]>(`/apple/awards/${awardId}/recipients`, recipients),

  /** 刪除獲獎學生 */
  removeRecipient: (recipientId: number) =>
    api.delete<{ deleted: boolean }>(`/apple/awards/recipients/${recipientId}`),

  // ==================== 獎學金 ====================

  /** 查詢獎學金申請列表 */
  getScholarships: (params?: ScholarshipQuery) => {
    const search = new URLSearchParams();
    if (params?.student_name) search.set("student_name", params.student_name);
    if (params?.scholarship_type) search.set("scholarship_type", params.scholarship_type);
    if (params?.status) search.set("status", params.status);
    if (params?.academic_year) search.set("academic_year", params.academic_year);
    if (params?.page) search.set("page", String(params.page));
    if (params?.page_size) search.set("page_size", String(params.page_size));
    const qs = search.toString();
    return api.get<PaginatedData<ScholarshipApplication>>(`/apple/awards/scholarships${qs ? `?${qs}` : ""}`);
  },

  /** 獲取單個獎學金申請詳情 */
  getScholarship: (id: number) =>
    api.get<ScholarshipApplication>(`/apple/awards/scholarships/${id}`),

  /** 提交獎學金申請 */
  applyScholarship: (data: ScholarshipApplyPayload) =>
    api.post<ScholarshipApplication>("/apple/awards/scholarships", data),

  /** 審核獎學金申請 */
  reviewScholarship: (id: number, data: ScholarshipReviewPayload) =>
    api.post<ScholarshipApplication>(`/apple/awards/scholarships/${id}/review`, data),

  // ==================== 獎學金核算 ====================

  /** 核算獎學金金額（按獲獎等級自動計算） */
  calculateScholarship: (awardId: number, rules?: Record<string, number>) =>
    api.post<CalculateResult>(`/apple/awards/${awardId}/calculate`, { rules }),

  /** 確認核算結果（將狀態從 calculated 改為 confirmed） */
  confirmScholarship: (awardId: number) =>
    api.post<{ id: number; status: string; message: string }>(`/apple/awards/${awardId}/confirm`),

  // ==================== 讀稿生成 ====================

  /** 生成頒獎讀稿（按指定方式排序） */
  generateScript: (awardId: number, groupBy: string = "class") => {
    const params = new URLSearchParams({ group_by: groupBy });
    return api.get<ScriptOut>(`/apple/awards/${awardId}/script?${params}`);
  },

  // ==================== 批量生成證書（基於現有獎狀） ====================

  /** 為獎狀中指定獲獎者批量生成證書 */
  generateCertificates: (awardId: number, data: CertificateRequestPayload) =>
    api.post<BatchGenerateData>(`/apple/awards/${awardId}/certificates`, data),

  // ==================== 證書生成與下載 ====================

  /** 下載單個獲獎者證書（自動觸發瀏覽器下載） */
  downloadRecipientCertificate: async (
    awardId: number,
    recipientId: number,
  ) => {
    const token = localStorage.getItem("token");
    const url = `${api.baseUrl}/apple/awards/${awardId}/recipients/${recipientId}/certificate`;
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("生成證書失敗");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "certificate.pdf";
    link.click();
    URL.revokeObjectURL(link.href);
  },

  /** 下載已通過獎學金證書（自動觸發瀏覽器下載） */
  downloadScholarshipCertificate: async (
    appId: number,
  ) => {
    const token = localStorage.getItem("token");
    const url = `${api.baseUrl}/apple/awards/scholarships/${appId}/certificate`;
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("生成證書失敗");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "scholarship_certificate.pdf";
    link.click();
    URL.revokeObjectURL(link.href);
  },

  // ==================== 批量導出證書 ====================

  /** 批量導出獎狀證書（ZIP 包，自動觸發下載） */
  batchExportAwards: async (awardIds: number[]) => {
    const token = localStorage.getItem("token");
    const url = `${api.baseUrl}/apple/awards/batch-export`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: awardIds, output_format: "pdf" }),
    });
    if (!res.ok) throw new Error("批量導出失敗");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "certificates.zip";
    link.click();
    URL.revokeObjectURL(link.href);
  },

  /** 批量導出獎學金證書（ZIP 包，自動觸發下載） */
  batchExportScholarships: async (appIds: number[]) => {
    const token = localStorage.getItem("token");
    const url = `${api.baseUrl}/apple/awards/scholarships/batch-export`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: appIds, output_format: "pdf" }),
    });
    if (!res.ok) throw new Error("批量導出失敗");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "scholarships.zip";
    link.click();
    URL.revokeObjectURL(link.href);
  },
};
