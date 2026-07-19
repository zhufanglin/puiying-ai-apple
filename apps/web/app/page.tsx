"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `/api/v1/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );
      const json = await res.json();
      if (json.code !== 0) {
        setError(json.message || "登錄失敗");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", json.data.access_token);
      router.push("/dashboard/apple");
    } catch {
      setError("網絡錯誤，請檢查後端服務是否啓動");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#174f49] to-[#23675f] shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800">培英中學 AI 數智化平台</h1>
          <p className="text-sm text-slate-500 mt-1">Apple 子系統</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">用戶名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="請輸入用戶名"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#23675f] focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#23675f] focus:border-transparent transition"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#23675f] hover:bg-[#174f49] text-white text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "登錄中..." : "登 錄"}
          </button>

          <p className="text-xs text-slate-400 text-center">
            演示賬號: admin / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
