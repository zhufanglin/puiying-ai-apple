export interface ScoreContext {
  schoolYear: string;
  term: string;
  examType: string;
}

export interface ScoreClassFilters extends ScoreContext {
  className: string;
  subject?: string;
}

export interface ScoreImportResult {
  school_year: string;
  term: string;
  exam_type: string;
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{
    row: number;
    subject?: string;
    message: string;
  }>;
}

export interface ScoreSubjectAverage {
  subject: string;
  average_score: number;
  average_percentage: number;
}

export interface ScoreRanking {
  student_id: string;
  student_no?: string;
  student_name?: string;
  rank: number;
  average_percentage: number;
}

export interface ScoreClassStats {
  school_year: string;
  term: string;
  exam_type: string;
  class_name: string;
  subject?: string | null;
  student_count: number;
  average: number;
  highest: number;
  lowest: number;
  pass_rate: number;
  bands: Record<"A" | "B" | "C" | "D", number>;
  subject_averages: ScoreSubjectAverage[];
  rankings: ScoreRanking[];
}

export type ScoreCommentStatus = "pending" | "confirmed" | "sent";
export type ScoreDeliveryStatus =
  | "not_sent"
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface ScoreComment {
  id: number;
  student_id: string;
  school_year: string;
  term: string;
  exam_type: string;
  comment_text: string;
  highlight_subject?: string | null;
  improve_subject?: string | null;
  suggestion?: string | null;
  status: ScoreCommentStatus;
  delivery_status: ScoreDeliveryStatus;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  sent_at?: string | null;
  whatsapp_message_id?: string | null;
  send_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ScoreCommentStatusCounts {
  total: number;
  workflow: Record<ScoreCommentStatus, number>;
  delivery: Record<ScoreDeliveryStatus, number>;
}

export interface ScoreGenerateResult {
  generated: ScoreComment[];
  generated_count: number;
  failed_count: number;
  errors: Array<{
    student_id: string;
    student_name?: string;
    message: string;
  }>;
}

export interface ScoreConfirmResult {
  confirmed: number;
  skipped: number;
  missing_ids: number[];
}

export interface ScoreSendResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  details: Array<{
    comment_id: number;
    student_id: string;
    status: string;
    message_id?: string | null;
    error?: string | null;
  }>;
}

export interface ScoreCommentUpdatePayload {
  comment_text: string;
  highlight_subject?: string | null;
  improve_subject?: string | null;
  suggestion?: string | null;
}

export const SCORE_COMMENT_STATUS_LABELS: Record<ScoreCommentStatus, string> = {
  pending: "待审阅",
  confirmed: "已确认",
  sent: "已发送",
};

export const SCORE_DELIVERY_STATUS_LABELS: Record<ScoreDeliveryStatus, string> = {
  not_sent: "未发送",
  pending: "发送中",
  sent: "已发送",
  delivered: "已送达",
  read: "已读",
  failed: "失败",
};
