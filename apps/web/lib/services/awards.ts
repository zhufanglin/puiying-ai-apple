/* ============================================================
 * 奖状 & 奖学金 — 前端 API 调用服务
 *
 * 所有后端 API 调用集中在此文件，支持：
 * - 奖状模板 CRUD
 * - 奖状 CRUD + 状态操作
 * - 获奖学生管理
 * - 奖学金 CRUD + 审核
 * - 统计看板数据
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

/** 奖状 & 奖学金 API 集合 */
export const awardApi = {
  // ==================== 统计 ====================

  /** 获取综合统计数据 */
  getStatistics: () =>
    api.get<AwardsDashboardStats>("/apple/awards/statistics"),

  // ==================== 奖状模板 ====================

  /** 查询奖状模板列表 */
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

  /** 获取单个奖状模板 */
  getTemplate: (id: number) =>
    api.get<AwardTemplate>(`/apple/awards/templates/${id}`),

  /** 创建奖状模板 */
  createTemplate: (data: { name: string; category?: string; description?: string }) =>
    api.post<AwardTemplate>("/apple/awards/templates", data),

  /** 更新奖状模板 */
  updateTemplate: (id: number, data: Partial<AwardTemplate>) =>
    api.put<AwardTemplate>(`/apple/awards/templates/${id}`, data),

  /** 删除奖状模板 */
  deleteTemplate: (id: number) =>
    api.delete<{ deleted: boolean }>(`/apple/awards/templates/${id}`),

  // ==================== 奖状 ====================

  /** 查询奖状列表 */
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

  /** 获取单个奖状详情（含模板 + 获奖名单） */
  getAward: (id: number) =>
    api.get<Award>(`/apple/awards/${id}`),

  /** 创建奖状（含获奖学生） */
  createAward: (data: AwardCreatePayload) =>
    api.post<Award>("/apple/awards", data),

  /** 更新奖状基本信息 */
  updateAward: (id: number, data: AwardUpdatePayload) =>
    api.put<Award>(`/apple/awards/${id}`, data),

  /** 删除奖状 */
  deleteAward: (id: number) =>
    api.delete<{ deleted: boolean }>(`/apple/awards/${id}`),

  /** 批量删除奖状 */
  batchDeleteAwards: (ids: number[]) =>
    api.post<{ deleted_count: number; total: number }>("/apple/awards/batch-delete", { ids }),

  /** 确认奖状（draft/calculated → confirmed） */
  publishAward: (id: number) =>
    api.post<Award>(`/apple/awards/${id}/publish`),

  /** 取消奖状（→ cancelled） */
  cancelAward: (id: number) =>
    api.post<Award>(`/apple/awards/${id}/cancel`),

  // ==================== 批量生成 ====================

  /** 批量生成奖状文档 */
  batchGenerate: (data: {
    template_id: number;
    recipients: { student_name: string; student_class: string }[];
    issue_date: string;
    award_year: string;
  }) => api.post<BatchGenerateData>(
    "/apple/awards/batch-generate", { ...data, output_format: "pdf" }
  ),

  // ==================== 获奖学生 ====================

  /** 批量添加获奖学生 */
  addRecipients: (awardId: number, recipients: AwardRecipientCreatePayload[]) =>
    api.post<AwardRecipient[]>(`/apple/awards/${awardId}/recipients`, recipients),

  /** 删除获奖学生 */
  removeRecipient: (recipientId: number) =>
    api.delete<{ deleted: boolean }>(`/apple/awards/recipients/${recipientId}`),

  // ==================== 奖学金 ====================

  /** 查询奖学金申请列表 */
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

  /** 获取单个奖学金申请详情 */
  getScholarship: (id: number) =>
    api.get<ScholarshipApplication>(`/apple/awards/scholarships/${id}`),

  /** 提交奖学金申请 */
  applyScholarship: (data: ScholarshipApplyPayload) =>
    api.post<ScholarshipApplication>("/apple/awards/scholarships", data),

  /** 审核奖学金申请 */
  reviewScholarship: (id: number, data: ScholarshipReviewPayload) =>
    api.post<ScholarshipApplication>(`/apple/awards/scholarships/${id}/review`, data),

  // ==================== 奖学金核算 ====================

  /** 核算奖学金金额（按获奖等级自动计算） */
  calculateScholarship: (awardId: number, rules?: Record<string, number>) =>
    api.post<CalculateResult>(`/apple/awards/${awardId}/calculate`, { rules }),

  /** 确认核算结果（将状态从 calculated 改为 confirmed） */
  confirmScholarship: (awardId: number) =>
    api.post<{ id: number; status: string; message: string }>(`/apple/awards/${awardId}/confirm`),

  // ==================== 读稿生成 ====================

  /** 生成颁奖读稿（按指定方式排序） */
  generateScript: (awardId: number, groupBy: string = "class") => {
    const params = new URLSearchParams({ group_by: groupBy });
    return api.get<ScriptOut>(`/apple/awards/${awardId}/script?${params}`);
  },

  // ==================== 批量生成证书（基于现有奖状） ====================

  /** 为奖状中指定获奖者批量生成证书 */
  generateCertificates: (awardId: number, data: CertificateRequestPayload) =>
    api.post<BatchGenerateData>(`/apple/awards/${awardId}/certificates`, data),

  // ==================== 证书生成与下载 ====================

  /** 下载单个获奖者证书（自动触发浏览器下载） */
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

  /** 下载已通过奖学金证书（自动触发浏览器下载） */
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

  // ==================== 批量导出证书 ====================

  /** 批量导出奖状证书（ZIP 包，自动触发下载） */
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

  /** 批量导出奖学金证书（ZIP 包，自动触发下载） */
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
