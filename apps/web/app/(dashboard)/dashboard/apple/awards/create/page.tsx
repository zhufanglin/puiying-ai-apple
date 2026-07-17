"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, AlertCircle } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import FormSection from "@/components/ui/FormSection";
import { awardApi } from "@/lib/services/awards";
import type { AwardTemplate, AwardRecipientCreatePayload } from "@/lib/types/awards";

interface RecipientEntry extends AwardRecipientCreatePayload {
  key: string;
}

let keyCounter = 0;
const newKey = () => `r_${++keyCounter}`;

/** 表单验证结果 */
interface FieldErrors {
  template?: string;
  title?: string;
  recipients?: string;
  /** key -> { field -> message } */
  recipientFields?: Record<string, Record<string, string>>;
}

export default function CreateAwardPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<AwardTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    awardApi.getTemplates({ page_size: 100 }).then((res) => {
      setTemplates(res.data.items.filter((t) => t.is_active));
    }).catch(console.error);
  }, []);

  const addRecipient = () => {
    setRecipients([...recipients, {
      key: newKey(),
      student_name: "",
      student_class: "",
      student_grade: "",
      rank: "",
      reason: "",
    }]);
  };

  const updateRecipient = (key: string, field: string, value: string) => {
    setRecipients(recipients.map((r) =>
      r.key === key ? { ...r, [field]: value } : r
    ));
    // 清除对应字段的错误
    if (fieldErrors.recipientFields?.[key]?.[field]) {
      const next = { ...fieldErrors };
      if (next.recipientFields?.[key]) {
        delete next.recipientFields[key][field];
        if (Object.keys(next.recipientFields[key]).length === 0) {
          delete next.recipientFields[key];
        }
      }
      setFieldErrors(next);
    }
  };

  const removeRecipient = (key: string) => {
    setRecipients(recipients.filter((r) => r.key !== key));
    // 清除该学生的错误
    if (fieldErrors.recipientFields?.[key]) {
      const next = { ...fieldErrors };
      delete next.recipientFields![key];
      setFieldErrors(next);
    }
  };

  /** 验证表单，返回是否有错误 */
  const validate = (): boolean => {
    const errors: FieldErrors = {};
    let hasError = false;

    // 奖状模板
    if (!templateId) {
      errors.template = "請選擇獎狀範本";
      hasError = true;
    }

    // 奖状标题
    if (!title.trim()) {
      errors.title = "請填寫獎狀標題";
      hasError = true;
    }

    // 获奖学生
    if (recipients.length === 0) {
      errors.recipients = "請至少添加一名獲獎學生";
      hasError = true;
    } else {
      const rErrors: Record<string, Record<string, string>> = {};
      recipients.forEach((r) => {
        const e: Record<string, string> = {};
        if (!r.student_name.trim()) {
          e.student_name = "請填寫學生姓名";
          hasError = true;
        }
        if (!r.student_class.trim()) {
          e.student_class = "請填寫班級";
          hasError = true;
        }
        if (Object.keys(e).length > 0) {
          rErrors[r.key] = e;
        }
      });
      if (Object.keys(rErrors).length > 0) {
        errors.recipientFields = rErrors;
      }
    }

    setFieldErrors(errors);
    return !hasError;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await awardApi.createAward({
        template_id: templateId,
        title: title.trim(),
        issuer: issuer.trim() || undefined,
        issue_date: issueDate || undefined,
        amount: amount.trim() ? Number(amount.trim()) : undefined,
        remark: remark.trim() || undefined,
        recipients: recipients.map(({ key, ...r }) => r),
      });
      router.push(`/dashboard/apple/awards/${res.data.id}`);
    } catch (e: any) {
      setFieldErrors({ recipients: e.message || "創建失敗，請檢查填寫內容" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await awardApi.createAward({
        template_id: templateId,
        title: title.trim(),
        issuer: issuer.trim() || undefined,
        issue_date: issueDate || undefined,
        amount: amount.trim() ? Number(amount.trim()) : undefined,
        remark: remark.trim() || undefined,
        recipients: recipients.map(({ key, ...r }) => r),
      });
      router.push(`/dashboard/apple/awards`);
    } catch (e: any) {
      setFieldErrors({ recipients: e.message || "保存失敗，請檢查填寫內容" });
    } finally {
      setSubmitting(false);
    }
  };

  /** 输入框的错误样式 */
  const inputErr = (has: boolean) =>
    has ? "border border-red-400 focus:border-red-500 bg-red-50" : "border border-gray-200 focus:border-primary-400";

  return (
    <div>
      <PageHeader
        title="新增獎狀"
        subtitle="選擇範本並填寫獲獎學生名單"
        actions={
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft size={16} /> 返回
          </button>
        }
      />

      {fieldErrors.recipients && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={16} /> {fieldErrors.recipients}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {/* 基本資訊 */}
        <FormSection title="基本資訊" subtitle="選擇範本和填寫獎狀資訊">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                獎狀範本 <span className="text-red-500">*</span>
              </label>
              <select
                value={templateId}
                onChange={(e) => { setTemplateId(Number(e.target.value)); setFieldErrors({}); }}
                className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none ${inputErr(!!fieldErrors.template)}`}
              >
                <option value={0}>-- 請選擇範本 --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}（{t.category}）
                  </option>
                ))}
              </select>
              {fieldErrors.template && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {fieldErrors.template}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                頒發部門
              </label>
              <input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="如：德育處"
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
                <span className="block text-xs font-normal text-gray-400 mt-0.5">創建後將自動帶入核算步驟</span>
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
              placeholder="如：2025學年上學期三好學生表彰"
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

        {/* 獲獎學生 */}
        <FormSection
          title="獲獎學生名單"
          subtitle={`已添加 ${recipients.length} 人`}
          error={fieldErrors.recipientFields ? "請填寫每位學生的姓名和班級" : undefined}
        >
          {recipients.map((r) => {
            const rErr = fieldErrors.recipientFields?.[r.key] || {};
            return (
              <div key={r.key} className="flex flex-wrap items-end gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs text-gray-500 mb-1">
                    姓名 <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={r.student_name}
                    onChange={(e) => updateRecipient(r.key, "student_name", e.target.value)}
                    placeholder="學生姓名"
                    className={`w-full rounded px-2 py-1.5 text-sm ${inputErr(!!rErr.student_name)}`}
                  />
                  {rErr.student_name && (
                    <p className="mt-0.5 text-xs text-red-500">{rErr.student_name}</p>
                  )}
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs text-gray-500 mb-1">
                    班級 <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={r.student_class}
                    onChange={(e) => updateRecipient(r.key, "student_class", e.target.value)}
                    placeholder="如：中五甲班"
                    className={`w-full rounded px-2 py-1.5 text-sm ${inputErr(!!rErr.student_class)}`}
                  />
                  {rErr.student_class && (
                    <p className="mt-0.5 text-xs text-red-500">{rErr.student_class}</p>
                  )}
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-500 mb-1">年級</label>
                  <input
                    value={r.student_grade || ""}
                    onChange={(e) => updateRecipient(r.key, "student_grade", e.target.value)}
                    placeholder="如：中五"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-500 mb-1">獲獎等級</label>
                  <select
                    value={r.rank || ""}
                    onChange={(e) => updateRecipient(r.key, "rank", e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">--</option>
                    <option value="一等獎">一等獎</option>
                    <option value="二等獎">二等獎</option>
                    <option value="三等獎">三等獎</option>
                    <option value="優秀獎">優秀獎</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs text-gray-500 mb-1">獲獎原因</label>
                  <input
                    value={r.reason || ""}
                    onChange={(e) => updateRecipient(r.key, "reason", e.target.value)}
                    placeholder="獲獎原因"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRecipient(r.key)}
                  className="p-1.5 text-gray-400 hover:text-red-500 mb-0.5"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRecipient}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus size={15} /> 添加學生
          </button>
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
            type="button"
            onClick={handleSaveDraft}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "創建並返回總覽"}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {submitting ? "創建中..." : "創建並核算"}
          </button>
        </div>
      </form>
    </div>
  );
}
