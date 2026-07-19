
const BASE = `/api/v1`;

interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token")
    : null;

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  const text = await res.text();
  let json: any = { code: 0, message: "ok", data: null };
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { code: res.status, message: text, data: null };
    }
  }
  if (!res.ok) {
    const detail = typeof json.detail === "string"
      ? json.detail
      : json.detail?.message;
    throw new Error(detail || json.message || `請求失敗 (${res.status})`);
  }
  return json;
}

export const api = {
  baseUrl: BASE,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  postWithHeaders: <T>(path: string, body: unknown, headers: Record<string, string>) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body), headers }),
  form: <T>(path: string, body: FormData) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
