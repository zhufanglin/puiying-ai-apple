import { api } from "@/lib/api";
import type {
  ScoreClassFilters,
  ScoreClassStats,
  ScoreComment,
  ScoreCommentStatus,
  ScoreCommentStatusCounts,
  ScoreCommentUpdatePayload,
  ScoreConfirmResult,
  ScoreContext,
  ScoreGenerateResult,
  ScoreImportResult,
  ScoreSendResult,
} from "@/lib/types/scores";

const BASE_PATH = "/apple/scores";

function contextQuery(context: ScoreContext): URLSearchParams {
  return new URLSearchParams({
    schoolYear: context.schoolYear,
    term: context.term,
    examType: context.examType,
  });
}

function contextBody(context: ScoreContext) {
  return {
    school_year: context.schoolYear,
    term: context.term,
    exam_type: context.examType,
  };
}

export async function importScores(file: File, context: ScoreContext): Promise<ScoreImportResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.form<ScoreImportResult>(`${BASE_PATH}/import?${contextQuery(context)}`, form);
  return res.data;
}

export async function getClassStats(filters: ScoreClassFilters): Promise<ScoreClassStats> {
  const params = contextQuery(filters);
  params.set("className", filters.className);
  if (filters.subject) params.set("subject", filters.subject);
  const res = await api.get<ScoreClassStats>(`${BASE_PATH}/stats/class?${params}`);
  return res.data;
}

export async function getCommentStatus(context: Partial<ScoreContext>): Promise<ScoreCommentStatusCounts> {
  const params = new URLSearchParams();
  if (context.schoolYear) params.set("schoolYear", context.schoolYear);
  if (context.term) params.set("term", context.term);
  if (context.examType) params.set("examType", context.examType);
  const suffix = params.size ? `?${params}` : "";
  const res = await api.get<ScoreCommentStatusCounts>(`${BASE_PATH}/comments/status${suffix}`);
  return res.data;
}

export async function listComments(
  context: Partial<ScoreContext>,
  status?: ScoreCommentStatus | "",
): Promise<ScoreComment[]> {
  const params = new URLSearchParams();
  if (context.schoolYear) params.set("schoolYear", context.schoolYear);
  if (context.term) params.set("term", context.term);
  if (context.examType) params.set("examType", context.examType);
  if (status) params.set("status", status);
  const suffix = params.size ? `?${params}` : "";
  const res = await api.get<ScoreComment[]>(`${BASE_PATH}/comments${suffix}`);
  return res.data;
}

export async function generateComments(
  context: ScoreContext,
  apiKey: string,
  model = "deepseek-chat",
): Promise<ScoreGenerateResult> {
  const res = await api.postWithHeaders<ScoreGenerateResult>(
    `${BASE_PATH}/comments/generate`,
    { ...contextBody(context), model },
    { "X-AI-API-Key": apiKey },
  );
  return res.data;
}

export async function updateComment(
  id: number,
  payload: ScoreCommentUpdatePayload,
): Promise<ScoreComment> {
  const res = await api.patch<ScoreComment>(`${BASE_PATH}/comments/${id}`, payload);
  return res.data;
}

export async function confirmComments(commentIds: number[]): Promise<ScoreConfirmResult> {
  const res = await api.post<ScoreConfirmResult>(`${BASE_PATH}/comments/confirm`, {
    comment_ids: commentIds,
  });
  return res.data;
}

export async function sendComments(
  context: ScoreContext,
  commentIds: number[],
  resend = false,
): Promise<ScoreSendResult> {
  const res = await api.post<ScoreSendResult>(
    `${BASE_PATH}/comments/${encodeURIComponent(context.examType)}/send`,
    {
      ...contextBody(context),
      comment_ids: commentIds.length ? commentIds : undefined,
      resend,
    },
  );
  return res.data;
}
