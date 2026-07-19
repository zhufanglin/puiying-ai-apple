export type StudentStatus = "active" | "suspended" | "withdrawn";

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: "present" | "late" | "absent" | "sick_leave";
  remarks: string;
  sourceFileId?: string | null;
}

export interface ScoreRecord {
  id: string;
  studentId: string;
  schoolYear: string;
  term: string;
  subject: string;
  score: number;
  grade: string;
}

export interface StudentCertificate {
  id: string;
  studentId: string;
  requestDate: string;
  certificateType: "enrollment" | "enrollment_bilingual" | "transcript_reissue";
  language: "zh" | "en" | "bilingual";
  purpose: string;
  status: string;
  generatedAt?: string | null;
}

export interface Student {
  id: string;
  studentNo: string;
  nameZh: string;
  nameEn?: string | null;
  className: string;
  status: StudentStatus;
  admissionDate?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  photoUrl?: string | null;
  attendance?: AttendanceRecord[];
  certificates?: StudentCertificate[];
  scores?: ScoreRecord[];
}

export interface StudentSummary {
  activeStudents: number;
  monthlyAttendanceExceptions: number;
  pendingTranscriptReissues: number;
  pendingEnrollmentCertificates: number;
}

export interface StudentWorkItem {
  id: string;
  category: "attendance" | "transcript_reissue" | "enrollment_certificate";
  studentId: string;
  studentNo: string;
  studentName: string;
  className: string;
  date: string;
  status: string;
  detail: string;
}

export interface StudentWorkItemsResult {
  items: StudentWorkItem[];
  pagination: { page: number; pageSize: number; total: number };
  availableClasses: string[];
}

export interface ExcelImportResult {
  sourceFileId: string;
  imported: number;
  updated: number;
  skipped: number;
  affectedStudents?: number;
  errors: { row: number; message: string }[];
}

type ApiResult<T> = { success: true; data: T } | { success: false; data: null; error: string };
type Envelope<T> = { code?: number; message?: string; data: T };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STUDENTS_ROOT = `${API_URL}/api/v1/apple/students`;

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const isForm = options.body instanceof FormData;
    const response = await fetch(`${STUDENTS_ROOT}${path}`, {
      ...options,
      headers: isForm ? options.headers : { "Content-Type": "application/json", ...options.headers },
    });
    const payload = await response.json() as Envelope<T> | { detail?: string; message?: string };
    if (!response.ok) {
      const error = "detail" in payload ? payload.detail : payload.message;
      return { success: false, data: null, error: error || `請求失敗 (${response.status})` };
    }
    return { success: true, data: (payload as Envelope<T>).data };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : "網絡請求失敗" };
  }
}

function withQuery(path: string, values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return `${path}?${query.toString()}`;
}

async function upload<T>(path: string, file: File): Promise<ApiResult<T>> {
  const body = new FormData();
  body.append("file", file);
  return request<T>(path, { method: "POST", body });
}

export const studentsApi = {
  students: (search = "") => request<Student[]>(withQuery("", { pageSize: 200, search })),
  summary: () => request<StudentSummary>("/summary"),
  workItems: (params: Record<string, string | number | undefined>) => request<StudentWorkItemsResult>(withQuery("/work-items", params)),
  student: (id: string) => request<Student>(`/${encodeURIComponent(id)}`),
  create: (body: Record<string, unknown>) => request<Student>("", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) => request<Student>(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => request<{ id: string; deleted: boolean }>(`/${encodeURIComponent(id)}`, { method: "DELETE" }),
  createCertificate: (studentId: string, body: { certificateType: string; language: string; purpose: string }) => request<StudentCertificate>(`/${encodeURIComponent(studentId)}/certificates`, { method: "POST", body: JSON.stringify(body) }),
};

export const importBulkAttendanceExcel = (file: File) => upload<ExcelImportResult>("/attendance/import", file);
export const importAttendanceExcel = (studentId: string, file: File) => upload<ExcelImportResult>(`/${encodeURIComponent(studentId)}/attendance/import`, file);
export const uploadStudentPhoto = (file: File) => upload<{ photoId: string; photoUrl: string; contentType: string }>("/photos", file);

export function studentCertificatePdfUrl(studentId: string, certificateId: string): string {
  return `${STUDENTS_ROOT}/${encodeURIComponent(studentId)}/certificates/${encodeURIComponent(certificateId)}/pdf`;
}

export function studentMediaUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function studentScoresExportUrl(studentId: string, filters: { schoolYear?: string; term?: string; subject?: string }): string {
  return `${STUDENTS_ROOT}${withQuery(`/${encodeURIComponent(studentId)}/scores/export`, filters)}`;
}
