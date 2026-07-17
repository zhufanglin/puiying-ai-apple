"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import FormSection from "@/components/ui/FormSection";
import DataTable, { Column } from "@/components/ui/DataTable";
import { awardApi } from "@/lib/services/awards";
import type { Award, AwardRecipient, AwardTemplate } from "@/lib/types/awards";

/** 表单验证结果 */
interface FieldErrors {
  title?: string;
}

export default function EditAwardPage() {
  const params = useParams();
  const router = useRouter();
  const awardId = Number(params.id);

  const [award, setAward] = useState<Award | null>(null);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<AwardTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!awardId) return;
    Promise.all([
      awardApi.getAward(awardId),
      awardApi.getTemplates({ page_size: 100 }),
    ]).then(([awardRes, templateRes]) => {
        const a = awardRes.data;
        setAward(a);
        setTemplateId(a.template_id);
        setTitle(a.title);
        setIssuer(a.issuer || "");
        setIssueDate(a.issue_date ? String(a.issue_date) : "");
        setAmount(a.amount ? String(a.amount) : "");
        setRemark(a.remark || "");
        // 包含活跃模板，并确保当前奖状的模板始终在列表中
        const activeTemplates = templateRes.data.items.filter((t) => t.is_active);
        if (a.template && !activeTemplates.find((t) => t.id === a.template!.id)) {
          activeTemplates.push(a.template);
        }
        setTemplates(activeTemplates);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [awardId]);

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    let hasError = false;

    if (!title.trim()) {
      errors.title = "請填寫獎狀標題";
      hasError = true;
    }

    setFieldErrors(errors);
    return !hasError;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await awardApi.updateAward(awardId, {
        template_id: templateId,
        title: title.trim(),
        issuer: issuer.trim() || undefined,
        issue_date: issueDate || undefined,
        amount: amount.trim() ? Number(amount.trim()) : undefined,
        remark: remark.trim() || undefined,
      });
      router.push(`/dashboard/apple/awards`);
    } catch (e: any) {
      setFieldErrors({ title: e.message || "更新失敗" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputErr = (has: boolean) =>
    has ? "border border-red-400 focus:border-red-500 bg-red-50" : "border border-gray-200 focus:border-primary-400";

  if (loading) {
    return <div className="text-center py-12 text-gray-400">載入中...</div>;
  }

  if (!award) {
    return <div className="text-center py-12 text-gray-400">獎狀不存在</div>;
  }

  const recipientColumns: Column<AwardRecipient>[] = [
    { key: "student_name", header: "姓名" },
    { key: "student_class", header: "班級" },
    { key: "student_grade", header: "年級" },
    { key: "rank", header: "獲獎等級",
      render: (row) => <span>{row.rank || "-"}</span> },
    { key: "reason", header: "獲獎原因",
      render: (row) => <span>{row.reason || "-"}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="編輯獎狀"
        subtitle={`${award.title} — 修改基本資訊`}
        actions={
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft size={16} /> 返回
          </button>
        }
      />

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {/* 基本資訊 */}
        <FormSection title="基本資訊" subtitle="修改獎狀基本資訊">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                獎狀範本 <span className="text-red-500">*</span>
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}（{t.category}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                頒發部門
              </label>
              <input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="如：德育處、教務處"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                頒發日期
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                默認獎學金金額（HKD）
                <span className="block text-xs font-normal text-gray-400 mt-0.5">保存後將自動帶入核算步驟</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="如：5000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              獎狀標題 <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setFieldErrors({}); }}
              className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none ${inputErr(!!fieldErrors.title)}`}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {fieldErrors.title}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
            />
          </div>
        </FormSection>

        {/* 獲獎學生（只讀列表） */}
        <FormSection
          title="獲獎學生名單"
          subtitle={`共 ${award?.recipients?.length || 0} 人（如需修改請在獎狀詳情頁操作）`}
        >
          <DataTable
            columns={recipientColumns}
            data={award?.recipients || []}
            pageSize={100}
          />
        </FormSection>

        {/* 提交按鈕 */}
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
            {submitting ? "保存中..." : "保存變更"}
          </button>
        </div>
      </form>
    </div>
  );
}
