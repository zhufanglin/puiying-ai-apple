const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8100";
const BASE = `${API_URL}/api/v1`;

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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `請求失敗 (${res.status})`);
  }
  return json;
}

export const api = {
  baseUrl: BASE,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
