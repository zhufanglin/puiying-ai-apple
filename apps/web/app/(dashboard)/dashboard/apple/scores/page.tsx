"use client";

import { ChangeEvent, Dispatch, ReactNode, SetStateAction, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import DataTable, { type Column } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import StatsCard from "@/components/ui/StatsCard";
import * as scoreService from "@/lib/services/scores";
import type {
  ScoreClassFilters,
  ScoreClassStats,
  ScoreComment,
  ScoreCommentStatus,
  ScoreCommentUpdatePayload,
  ScoreImportResult,
} from "@/lib/types/scores";
import {
  SCORE_COMMENT_STATUS_LABELS,
  SCORE_DELIVERY_STATUS_LABELS,
} from "@/lib/types/scores";

const DEFAULT_FILTERS: ScoreClassFilters = {
  schoolYear: "2025/26",
  term: "上学期",
  examType: "期末考试",
  className: "中四A班",
  subject: "",
};

const PRIMARY_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#23675f] px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const FIELD_LABEL = "flex flex-col gap-1 text-sm font-medium text-gray-700";

const EMPTY_STATS: ScoreClassStats = {
  school_year: DEFAULT_FILTERS.schoolYear,
  term: DEFAULT_FILTERS.term,
  exam_type: DEFAULT_FILTERS.examType,
  class_name: DEFAULT_FILTERS.className,
  subject: null,
  student_count: 0,
  average: 0,
  highest: 0,
  lowest: 0,
  pass_rate: 0,
  bands: { A: 0, B: 0, C: 0, D: 0 },
  subject_averages: [],
  rankings: [],
};

type TabKey = "import" | "stats" | "comments";

interface EditState {
  id: number;
  values: ScoreCommentUpdatePayload;
}

export default function ScoresPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("stats");
  const [filters, setFilters] = useState<ScoreClassFilters>(DEFAULT_FILTERS);
  const [stats, setStats] = useState<ScoreClassStats>(EMPTY_STATS);
  const [comments, setComments] = useState<ScoreComment[]>([]);
  const [commentStatus, setCommentStatus] = useState<ScoreCommentStatus | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [importResult, setImportResult] = useState<ScoreImportResult | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const context = useMemo(
    () => ({
      schoolYear: filters.schoolYear.trim(),
      term: filters.term.trim(),
      examType: filters.examType.trim(),
    }),
    [filters.schoolYear, filters.term, filters.examType],
  );

  const selectedComments = useMemo(
    () => comments.filter((comment) => selectedIds.has(comment.id)),
    [comments, selectedIds],
  );

  const pendingCount = comments.filter((comment) => comment.status === "pending").length;
  const confirmedCount = comments.filter((comment) => comment.status === "confirmed").length;
  const sentCount = comments.filter((comment) => comment.status === "sent").length;

  const loadData = async () => {
    setLoading(true);
    setError("");
    const [statsResult, commentsResult] = await Promise.allSettled([
      scoreService.getClassStats(filters),
      scoreService.listComments(context, commentStatus),
    ]);

    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value);
    } else {
      setStats({ ...EMPTY_STATS, school_year: context.schoolYear, term: context.term, exam_type: context.examType, class_name: filters.className });
    }

    if (commentsResult.status === "fulfilled") {
      setComments(commentsResult.value);
      setSelectedIds(new Set());
    } else {
      setComments([]);
      setError(readError(commentsResult.reason) || "无法读取成绩评语数据");
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [commentStatus]);

  const updateFilter = (key: keyof ScoreClassFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      if (current.size === comments.length) return new Set();
      return new Set(comments.map((comment) => comment.id));
    });
  };

  const handleImport = async () => {
    if (!file) {
      setError("请先选择 .xlsx 成绩文件");
      return;
    }
    setBusyAction("import");
    setError("");
    setNotice("");
    try {
      const result = await scoreService.importScores(file, context);
      setImportResult(result);
      setNotice(`导入完成：新增 ${result.imported} 条，更新 ${result.updated} 条，失败 ${result.failed} 条。`);
      await loadData();
      setActiveTab("stats");
    } catch (err) {
      setError(readError(err) || "成绩导入失败");
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError("请输入本次调用使用的 DeepSeek API Key");
      return;
    }
    setBusyAction("generate");
    setError("");
    setNotice("");
    try {
      const result = await scoreService.generateComments(context, apiKey.trim());
      setNotice(`AI 评语生成完成：成功 ${result.generated_count} 条，失败 ${result.failed_count} 条。`);
      setApiKey("");
      await loadData();
      setActiveTab("comments");
    } catch (err) {
      setError(readError(err) || "AI 评语生成失败");
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirm = async () => {
    const ids = selectedIds.size
      ? Array.from(selectedIds)
      : comments.filter((comment) => comment.status === "pending").map((comment) => comment.id);
    if (!ids.length) {
      setError("当前没有可确认的评语");
      return;
    }
    setBusyAction("confirm");
    setError("");
    setNotice("");
    try {
      const result = await scoreService.confirmComments(ids);
      setNotice(`确认完成：已确认 ${result.confirmed} 条，跳过 ${result.skipped} 条。`);
      await loadData();
    } catch (err) {
      setError(readError(err) || "确认评语失败");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSend = async () => {
    const ids = selectedIds.size
      ? Array.from(selectedIds)
      : comments.filter((comment) => comment.status === "confirmed").map((comment) => comment.id);
    if (!ids.length) {
      setError("当前没有可推送的已确认评语");
      return;
    }
    setBusyAction("send");
    setError("");
    setNotice("");
    try {
      const result = await scoreService.sendComments(context, ids);
      setNotice(`WhatsApp 推送完成：成功 ${result.success} 条，失败 ${result.failed} 条，跳过 ${result.skipped} 条。`);
      await loadData();
    } catch (err) {
      setError(readError(err) || "WhatsApp 推送失败");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setBusyAction("save");
    setError("");
    setNotice("");
    try {
      await scoreService.updateComment(editing.id, editing.values);
      setNotice("评语已保存。");
      setEditing(null);
      await loadData();
    } catch (err) {
      setError(readError(err) || "保存评语失败");
    } finally {
      setBusyAction(null);
    }
  };

  const columns: Column<ScoreComment>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label="选择全部评语"
          checked={comments.length > 0 && selectedIds.size === comments.length}
          onChange={toggleAllVisible}
        />
      ),
      width: "48px",
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`选择评语 ${row.id}`}
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelected(row.id)}
        />
      ),
    },
    { key: "student_id", header: "学生", render: (row) => <span className="font-semibold">{row.student_id}</span> },
    { key: "comment_text", header: "AI 评语", render: (row) => <p className="line-clamp-2 max-w-xl">{row.comment_text}</p> },
    { key: "highlight_subject", header: "亮点", render: (row) => row.highlight_subject || "-" },
    { key: "improve_subject", header: "需提升", render: (row) => row.improve_subject || "-" },
    { key: "status", header: "审阅", render: (row) => <StatusPill label={SCORE_COMMENT_STATUS_LABELS[row.status]} tone={row.status} /> },
    {
      key: "delivery_status",
      header: "推送",
      render: (row) => (
        <StatusPill
          label={SCORE_DELIVERY_STATUS_LABELS[row.delivery_status]}
          tone={row.delivery_status === "failed" ? "failed" : row.delivery_status === "not_sent" ? "muted" : "sent"}
        />
      ),
    },
    {
      key: "actions",
      header: "操作",
      render: (row) => (
        <button
          className="text-xs font-bold text-[#23675f] hover:underline disabled:text-gray-300"
          disabled={row.status === "sent"}
          onClick={() => setEditing({
            id: row.id,
            values: {
              comment_text: row.comment_text,
              highlight_subject: row.highlight_subject || "",
              improve_subject: row.improve_subject || "",
              suggestion: row.suggestion || "",
            },
          })}
        >
          编辑
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="成绩分析与评语"
        subtitle="成绩导入、班级统计、AI 评语审阅、WhatsApp 推送"
        actions={
          <div className="flex items-center gap-2">
            <button className={SECONDARY_BUTTON} onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={15} />
              刷新
            </button>
            <button className={PRIMARY_BUTTON} onClick={handleGenerate} disabled={busyAction === "generate"}>
              <Sparkles size={15} />
              生成评语
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard label="班级人数" value={stats.student_count} icon={FileSpreadsheet} color="text-[#23675f]" />
        <StatsCard label="平均分" value={`${stats.average.toFixed(1)}%`} icon={BarChart3} color="text-blue-600" />
        <StatsCard label="合格率" value={`${stats.pass_rate.toFixed(1)}%`} icon={CheckCircle2} color="text-green-600" />
        <StatsCard label="待审阅评语" value={pendingCount} icon={MessageCircle} color="text-amber-600" />
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Field label="学年" value={filters.schoolYear} onChange={(value) => updateFilter("schoolYear", value)} />
          <Field label="学期" value={filters.term} onChange={(value) => updateFilter("term", value)} />
          <Field label="考试" value={filters.examType} onChange={(value) => updateFilter("examType", value)} />
          <Field label="班级" value={filters.className} onChange={(value) => updateFilter("className", value)} />
          <Field label="科目" value={filters.subject || ""} placeholder="全部科目" onChange={(value) => updateFilter("subject", value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={PRIMARY_BUTTON} onClick={() => void loadData()} disabled={loading}>
            <BarChart3 size={15} />
            查询统计
          </button>
          <input
            className="min-w-[260px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            type="password"
            value={apiKey}
            placeholder="DeepSeek API Key，仅本次生成使用"
            autoComplete="new-password"
            onChange={(event) => setApiKey(event.target.value)}
          />
        </div>
      </section>

      {(notice || error) && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error ? <AlertCircle size={16} className="mt-0.5" /> : <CheckCircle2 size={16} className="mt-0.5" />}
          <span>{error || notice}</span>
        </div>
      )}

      <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
        {[
          { key: "stats" as TabKey, label: "统计图表" },
          { key: "import" as TabKey, label: "成绩导入" },
          { key: "comments" as TabKey, label: `评语审阅 ${comments.length}` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              activeTab === tab.key ? "bg-[#23675f] text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "stats" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Panel title="分数段分布">
            <div className="space-y-3">
              {(["A", "B", "C", "D"] as const).map((band) => (
                <BarRow key={band} label={`${band} 档`} value={stats.bands[band]} max={Math.max(1, stats.student_count)} />
              ))}
            </div>
          </Panel>

          <Panel title="科目平均">
            <div className="space-y-3">
              {stats.subject_averages.length ? stats.subject_averages.map((item) => (
                <BarRow key={item.subject} label={item.subject} value={item.average_percentage} max={100} suffix="%" />
              )) : <p className="py-10 text-center text-sm text-gray-400">暂无科目统计</p>}
            </div>
          </Panel>

          <div className="xl:col-span-2">
            <Panel title="班级排名">
              <DataTable
                columns={[
                  { key: "rank", header: "排名", width: "80px" },
                  { key: "student_no", header: "学号", render: (row) => row.student_no || row.student_id },
                  { key: "student_name", header: "姓名", render: (row) => row.student_name || "-" },
                  { key: "average_percentage", header: "平均百分比", align: "right", render: (row) => `${row.average_percentage.toFixed(1)}%` },
                ]}
                data={stats.rankings}
                total={stats.rankings.length}
                pageSize={10}
                emptyText="暂无排名数据"
              />
            </Panel>
          </div>
        </div>
      )}

      {activeTab === "import" && (
        <Panel title="Excel 批量导入">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <label className="flex min-h-[96px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center hover:bg-gray-100">
              <Upload size={22} className="mb-2 text-[#23675f]" />
              <span className="text-sm font-bold text-gray-800">{file ? file.name : "选择 .xlsx 成绩文件"}</span>
              <span className="mt-1 text-xs text-gray-500">支持长表：学号/科目/成绩；也支持宽表：学号 + 各科成绩</span>
              <input className="hidden" type="file" accept=".xlsx" onChange={handleFileChange(setFile)} />
            </label>
            <button className={`${PRIMARY_BUTTON} min-w-[150px] justify-center`} onClick={handleImport} disabled={busyAction === "import"}>
              <Upload size={15} />
              确认导入
            </button>
          </div>

          {importResult && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm font-bold text-gray-800">
                新增 {importResult.imported} 条，更新 {importResult.updated} 条，失败 {importResult.failed} 条
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-3 max-h-52 overflow-auto rounded-md bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs text-gray-500">
                      <tr><th className="px-3 py-2">行号</th><th className="px-3 py-2">科目</th><th className="px-3 py-2">原因</th></tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((item, index) => (
                        <tr key={`${item.row}-${index}`} className="border-t border-gray-100">
                          <td className="px-3 py-2">{item.row}</td>
                          <td className="px-3 py-2">{item.subject || "-"}</td>
                          <td className="px-3 py-2 text-red-600">{item.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Panel>
      )}

      {activeTab === "comments" && (
        <div className="space-y-4">
          <Panel title="AI 评语审阅">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={commentStatus}
                  onChange={(event) => setCommentStatus(event.target.value as ScoreCommentStatus | "")}
                >
                  <option value="">全部状态</option>
                  <option value="pending">待审阅</option>
                  <option value="confirmed">已确认</option>
                  <option value="sent">已发送</option>
                </select>
                <span className="text-sm text-gray-500">
                  待审阅 {pendingCount} · 已确认 {confirmedCount} · 已发送 {sentCount}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className={SECONDARY_BUTTON} onClick={handleConfirm} disabled={busyAction === "confirm"}>
                  <CheckCircle2 size={15} />
                  确认评语
                </button>
                <button className={PRIMARY_BUTTON} onClick={handleSend} disabled={busyAction === "send"}>
                  <Send size={15} />
                  WhatsApp 推送
                </button>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={comments}
              total={comments.length}
              pageSize={8}
              loading={loading}
              emptyText="暂无评语记录"
            />
          </Panel>

          {editing && (
            <Panel title={`编辑评语 #${editing.id}`}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <label className={`lg:col-span-3 ${FIELD_LABEL}`}>
                  <span>评语内容</span>
                  <textarea
                    className="min-h-[120px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={editing.values.comment_text}
                    onChange={(event) => setEditing((current) => current && {
                      ...current,
                      values: { ...current.values, comment_text: event.target.value },
                    })}
                  />
                </label>
                <Field label="亮点科目" value={editing.values.highlight_subject || ""} onChange={(value) => updateEditing("highlight_subject", value, setEditing)} />
                <Field label="提升科目" value={editing.values.improve_subject || ""} onChange={(value) => updateEditing("improve_subject", value, setEditing)} />
                <Field label="建议" value={editing.values.suggestion || ""} onChange={(value) => updateEditing("suggestion", value, setEditing)} />
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button className={SECONDARY_BUTTON} onClick={() => setEditing(null)}>取消</button>
                <button className={PRIMARY_BUTTON} onClick={handleSaveEdit} disabled={busyAction === "save"}>
                  <Save size={15} />
                  保存
                </button>
              </div>
            </Panel>
          )}

          {selectedComments.some((comment) => comment.send_error) && (
            <Panel title="发送失败原因">
              <div className="space-y-2 text-sm text-red-700">
                {selectedComments.filter((comment) => comment.send_error).map((comment) => (
                  <p key={comment.id}>#{comment.id} {comment.student_id}: {comment.send_error}</p>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={FIELD_LABEL}>
      <span>{label}</span>
      <input
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-base font-bold text-gray-900">{title}</h3>
      {children}
    </section>
  );
}

function BarRow({
  label,
  value,
  max,
  suffix = "",
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const width = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[92px_1fr_70px] items-center gap-3 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <div className="h-3 rounded-full bg-gray-100">
        <div className="h-3 rounded-full bg-[#23675f]" style={{ width: `${width}%` }} />
      </div>
      <span className="text-right font-bold text-gray-900">{Number(value).toFixed(suffix ? 1 : 0)}{suffix}</span>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: ScoreCommentStatus | "sent" | "failed" | "muted";
}) {
  const classes: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    confirmed: "bg-blue-50 text-blue-700",
    sent: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
    muted: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${classes[tone]}`}>
      {label}
    </span>
  );
}

function handleFileChange(setFile: (file: File | null) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };
}

function updateEditing(
  key: keyof ScoreCommentUpdatePayload,
  value: string,
  setEditing: Dispatch<SetStateAction<EditState | null>>,
) {
  setEditing((current) => current && {
    ...current,
    values: { ...current.values, [key]: value },
  });
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "";
}
