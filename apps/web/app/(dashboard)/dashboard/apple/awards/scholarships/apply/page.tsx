"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import FormSection from "@/components/ui/FormSection";
import { awardApi } from "@/lib/services/awards";

const SCHOLARSHIP_TYPES = ["學業優秀", "品德風尚", "科技競賽", "體藝特長", "助學金"];

export default function ApplyScholarshipPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    student_name: "",
    student_class: "",
    student_grade: "",
    scholarship_type: "",
    academic_year: "2025-2026",
    semester: "上",
    amount: "",
    reason: "",
    remark: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_name.trim()) { setError("請填寫學生姓名"); return; }
    if (!form.student_class.trim()) { setError("請填寫班級"); return; }
    if (!form.scholarship_type) { setError("請選擇獎學金類型"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError("請填寫有效金額"); return; }

    setError("");
    setSubmitting(true);
    try {
      const res = await awardApi.applyScholarship({
        student_name: form.student_name.trim(),
        student_class: form.student_class.trim(),
        student_grade: form.student_grade.trim() || undefined,
        scholarship_type: form.scholarship_type,
        academic_year: form.academic_year,
        semester: form.semester,
        amount: Number(form.amount),
        reason: form.reason.trim() || undefined,
        remark: form.remark.trim() || undefined,
      });
      router.push(`/dashboard/apple/awards/scholarships`);
    } catch (e: any) {
      setError(e.message || "提交失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader 
        title="提交獎學金申請"
        subtitle="填寫學生資訊和申請理由"
        actions={
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft size={16} /> 返回
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 學生資訊 */}
        <FormSection title="學生資訊" subtitle="申請學生基本資料">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                學生姓名 <span className="text-red-500">*</span>
              </label>
              <input
                value={form.student_name}
                onChange={(e) => update("student_name", e.target.value)}
                placeholder="請輸入姓名"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                班級 <span className="text-red-500">*</span>
              </label>
              <input
                value={form.student_class}
                onChange={(e) => update("student_class", e.target.value)}
                placeholder="如：中五甲班"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年級</label>
              <input
                value={form.student_grade}
                onChange={(e) => update("student_grade", e.target.value)}
                placeholder="如：中五"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>
        </FormSection>

        {/* 申請資訊 */}
        <FormSection title="申請資訊" subtitle="獎學金類型和金額">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                獎學金類型 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.scholarship_type}
                onChange={(e) => update("scholarship_type", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              >
                <option value="">-- 請選擇 --</option>
                {SCHOLARSHIP_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                申請金額 (HKD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={form.amount}
                onChange={(e) => update("amount", e.target.value)}
                placeholder="如：5000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">學年</label>
              <select
                value={form.academic_year}
                onChange={(e) => update("academic_year", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              >
                <option value="2025-2026">2025-2026</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2023-2024">2023-2024</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">學期</label>
              <select
                value={form.semester}
                onChange={(e) => update("semester", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              >
                <option value="上">上學期</option>
                <option value="下">下學期</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">申請理由</label>
            <textarea
              value={form.reason}
              onChange={(e) => update("reason", e.target.value)}
              rows={3}
              placeholder="請描述申請理由..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
            <textarea
              value={form.remark}
              onChange={(e) => update("remark", e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
            />
          </div>
        </FormSection>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {submitting ? "提交中..." : "提交申請"}
          </button>
        </div>
      </form>
    </div>
  );
}
