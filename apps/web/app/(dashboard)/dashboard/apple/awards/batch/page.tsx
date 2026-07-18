"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Upload, ArrowLeft, Download, X, Check, Loader2, RefreshCw, Eye, FileText } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import FormSection from "@/components/ui/FormSection";
import { api } from "@/lib/api";
import { awardApi } from "@/lib/services/awards";
import type { AwardTemplate, BatchGenerateFileInfo } from "@/lib/types/awards";

interface ParsedStudent {
  student_name: string;
  student_class: string;
}

/** 解析文字區域輸入的學生清單，每行格式為「姓名, 班級」 */
function parseStudentInput(text: string): ParsedStudent[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes(","))
    .map((line) => {
      const parts = line.split(",").map((s) => s.trim());
      return {
        student_name: parts[0] || "",
        student_class: parts[1] || "",
      };
    })
    .filter((s) => s.student_name && s.student_class);
}

/** 取得當前學年度（預設：今年 9 月前為上一學年，之後為本學年） */
function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 9) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

/** 取得今天的日期字串 YYYY-MM-DD */
function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BatchGeneratePage() {
  const router = useRouter();

  // 表單狀態
  const [templates, setTemplates] = useState<AwardTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number>(0);
  const [studentInput, setStudentInput] = useState("");
  const [issueDate, setIssueDate] = useState(getTodayString());
  const [awardYear, setAwardYear] = useState(getCurrentSchoolYear());
  // 操作狀態
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [downloads, setDownloads] = useState<BatchGenerateFileInfo[] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // 載入範本
  useEffect(() => {
    awardApi
      .getTemplates({ page_size: 100 })
      .then((res) => {
        setTemplates(res.data.items.filter((t) => t.is_active));
      })
      .catch(console.error);
  }, []);

  // 解析後的學生清單
  const parsedStudents = useMemo(() => parseStudentInput(studentInput), [studentInput]);

  // 當前選中的模板
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templateId, templates],
  );

  const handleReset = () => {
    setTemplateId(0);
    setStudentInput("");
    setIssueDate(getTodayString());
    setAwardYear(getCurrentSchoolYear());
    setError("");
    setDownloads(null);
    setShowResult(false);
  };

  const handleGenerate = async () => {
    if (!templateId) {
      setError("請選擇獎狀範本");
      return;
    }
    if (parsedStudents.length === 0) {
      setError("請輸入至少一位學生資料（格式：姓名, 班級）");
      return;
    }
    if (!issueDate) {
      setError("請選擇頒發日期");
      return;
    }
    if (!awardYear.trim()) {
      setError("請填寫學年度");
      return;
    }

    setError("");
    setGenerating(true);
    try {
      const res = await awardApi.batchGenerate({
        template_id: templateId,
        recipients: parsedStudents,
        issue_date: issueDate,
        award_year: awardYear.trim(),
      });
      setDownloads(res.data.files || []);
      setShowResult(true);
    } catch (e: any) {
      setError(e.message || "批量生成失敗");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!downloads || downloads.length === 0) return;
    setDownloadingZip(true);
    try {
      for (const item of downloads) {
        const link = document.createElement("a");
        link.href = `${api.baseUrl}/apple/awards/download/${item.file_path}`;
        link.download = `${item.student_name}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="批量生成獎狀"
        subtitle="選擇範本、輸入學生清單，一鍵批量生成獎狀檔案"
        actions={
          <button
            onClick={() => router.back()}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左側：模板預覽 */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Eye size={16} /> 模板預覽
            </h3>

            {selectedTemplate ? (
              <div className="space-y-3">
                <div
                  className="w-full aspect-[4/3] rounded-lg border-2 border-primary-200 bg-gradient-to-br from-green-50 to-white flex items-center justify-center"
                >
                  <div className="text-center px-4">
                    <FileText size={32} className="text-primary-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-primary-700">{selectedTemplate.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{selectedTemplate.category}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p><span className="font-medium text-gray-700">範本名稱：</span>{selectedTemplate.name}</p>
                  <p><span className="font-medium text-gray-700">分類：</span>{selectedTemplate.category}</p>
                  {selectedTemplate.description && (
                    <p><span className="font-medium text-gray-700">描述：</span>{selectedTemplate.description}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Eye size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">請選擇一個獎狀範本以預覽</p>
              </div>
            )}
          </div>
        </div>

        {/* 右側：表單 */}
        <div className="lg:col-span-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
          >
            {/* 基本設定 */}
            <FormSection title="基本設定" subtitle="選擇獎狀範本">
              {/* 第 1 行：範本 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  獎狀範本 <span className="text-red-500">*</span>
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                >
                  <option value={0}>-- 請選擇範本 --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}（{t.category}）
                    </option>
                  ))}
                </select>
              </div>

              {/* 第 2 行：學年度 + 頒發日期 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    學年度 <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={awardYear}
                    onChange={(e) => setAwardYear(e.target.value)}
                    placeholder="如：2025-2026"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    頒發日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
              </div>
            </FormSection>

            {/* 學生清單 */}
            <FormSection
              title="學生清單"
              subtitle={
                parsedStudents.length > 0
                  ? `已解析 ${parsedStudents.length} 位學生`
                  : "請輸入學生姓名與班級"
              }
            >
              {/* 第 4 行：文字輸入區 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  輸入學生資料 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={studentInput}
                  onChange={(e) => setStudentInput(e.target.value)}
                  rows={8}
                  placeholder={"每行一位學生，格式：姓名, 班級\n範例：\n陳小華, 中五甲班\n李小明, 中四乙班\n王小花, 中六甲班"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">
                  格式：每行「姓名, 班級」，用逗號分隔
                </p>
              </div>

              {/* 解析預覽 */}
              {parsedStudents.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    解析預覽（共 {parsedStudents.length} 人）
                  </label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            #
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            姓名
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            班級
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedStudents.map((s, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-800">
                              {s.student_name}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{s.student_class}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </FormSection>

            {/* 操作按鈕 */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw size={16} /> 重置
              </button>
              <button
                type="submit"
                disabled={generating}
                className="flex items-center gap-1.5 px-6 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> 生成中...
                  </>
                ) : (
                  <>
                    <Upload size={16} /> 生成
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 結果彈窗 */}
      {showResult && downloads && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResult(false);
          }}
        >
          <div className="modal" style={{ maxWidth: "520px" }}>
            {/* 標題 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#e8f5e9" }}
                >
                  <Check size={18} style={{ color: "#2e7d32" }} />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                  生成完成
                </h3>
              </div>
              <button
                onClick={() => setShowResult(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
              共生成 {downloads.length} 份獎狀檔案
            </p>

            {/* 下載清單 */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                      學生
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                      下載
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {downloads.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {item.student_name}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={`${api.baseUrl}/apple/awards/download/${item.file_path}`}
                          download={`${item.student_name}.pdf`}
                          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                        >
                          <Download size={14} /> 下載
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 按鈕 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleDownloadAll}
                disabled={downloadingZip}
                className="btn btn-primary flex items-center gap-1.5"
              >
                {downloadingZip ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> 下載中...
                  </>
                ) : (
                  <>
                    <Download size={16} /> 下載全部（ZIP）
                  </>
                )}
              </button>
              <button
                onClick={() => setShowResult(false)}
                className="btn btn-ghost"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
