/* ============================================================
 * 奖状 & 奖学金 — TypeScript 类型定义
 *
 * 与后端 API 响应结构一一对应。
 * 后端 Pydantic Schema 变更时，此文件需同步更新。
 * ============================================================ */

// ==================== 通用 ====================

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

// ==================== 奖状模板 ====================

export interface AwardTemplate {
  id: number;
  name: string;
  description?: string;
  category: string;        // 学业 / 品德 / 活动 / 其他
  default_content?: string;
  badge_style?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AwardTemplateQuery {
  name?: string;
  category?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

// ==================== 奖状 ====================

export interface AwardRecipient {
  id: number;
  award_id: number;
  student_name: string;
  student_class: string;
  student_grade?: string;
  certificate_no?: string;
  reason?: string;
  rank?: string;           // 一等奖 / 二等奖 / 三等奖 / 优秀奖
  created_at: string;
}

export interface Award {
  id: number;
  template_id: number;
  title: string;
  issue_date: string;
  issuer?: string;
  status: string;          // draft / calculated / confirmed / cancelled
  amount?: number;
  remark?: string;
  total_recipients: number;
  created_at: string;
  updated_at: string;
  template?: AwardTemplate;
  recipients?: AwardRecipient[];
}

export interface AwardListItem {
  id: number;
  title: string;
  template_name?: string;
  template_category?: string;
  issue_date: string;
  issuer?: string;
  amount?: number;
  status: string;
  total_recipients: number;
  created_at: string;
}

export interface AwardQuery {
  title?: string;
  template_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface AwardCreatePayload {
  template_id: number;
  title: string;
  issue_date?: string;
  issuer?: string;
  amount?: number;
  remark?: string;
  recipients: AwardRecipientCreatePayload[];
}

export interface AwardRecipientCreatePayload {
  student_name: string;
  student_class: string;
  student_grade?: string;
  reason?: string;
  rank?: string;
}

export interface AwardUpdatePayload {
  template_id?: number;
  title?: string;
  issue_date?: string;
  issuer?: string;
  amount?: number;
  remark?: string;
}

// ==================== 奖学金 ====================

export interface ScholarshipApplication {
  id: number;
  student_name: string;
  student_class: string;
  student_grade?: string;
  scholarship_type: string;  // 学业优秀 / 品德风尚 / 科技竞赛 / 体艺特长 / 助学金
  academic_year: string;
  semester: string;          // 上 / 下
  application_date: string;
  status: string;            // pending / approved / rejected
  amount: number;
  reason?: string;
  remark?: string;
  reviewer_id?: number;
  review_comment?: string;
  review_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ScholarshipQuery {
  student_name?: string;
  scholarship_type?: string;
  status?: string;
  academic_year?: string;
  page?: number;
  page_size?: number;
}

export interface ScholarshipApplyPayload {
  student_name: string;
  student_class: string;
  student_grade?: string;
  scholarship_type: string;
  academic_year: string;
  semester: string;
  amount: number;
  reason?: string;
  remark?: string;
}

export interface ScholarshipReviewPayload {
  status: "approved" | "rejected";
  review_comment?: string;
}

// ==================== 统计 ====================

export interface AwardStatistics {
  total_awards: number;
  draft_count: number;
  calculated_count: number;
  confirmed_count: number;
  cancelled_count: number;
  total_recipients: number;
  template_count: number;
}

export interface ScholarshipStatistics {
  total_applications: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  total_amount: number;
  approved_amount: number;
}

export interface AwardsDashboardStats {
  awards: AwardStatistics;
  scholarships: ScholarshipStatistics;
}


// ==================== 奖学金核算 ====================

export interface CalculateResultItem {
  student_name: string;
  student_class: string;
  rank?: string;
  base_amount: number;
  final_amount: number;
  remark?: string;
}

export interface CalculateResult {
  items: CalculateResultItem[];
  total_amount: number;
}


// ==================== 读稿生成 ====================

export interface ScriptItem {
  student_name: string;
  student_class: string;
  student_grade?: string;
  script_text: string;
}

export interface ScriptOut {
  award_title: string;
  total: number;
  items: ScriptItem[];
}


// ==================== 批量证书生成（基于现有奖状） ====================

export interface CertificateRequestPayload {
  template_id?: number;
  recipient_ids: number[];
  signatory?: string;
}


// ==================== 批量生成文件信息 ====================

export interface BatchGenerateFileInfo {
  student_name: string;
  file_path: string;
}

export interface BatchGenerateData {
  files: BatchGenerateFileInfo[];
  download_token: string;
}
