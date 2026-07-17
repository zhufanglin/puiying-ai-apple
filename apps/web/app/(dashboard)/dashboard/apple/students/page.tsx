"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState, LoadingState, PageHeader } from "@/components/shared";
import { appleApi, importBulkAttendanceExcel, uploadStudentPhoto } from "@/lib/api";
import type { Student, StudentSummary, StudentWorkItem, StudentWorkItemsResult } from "@/lib/types";

type QueueCategory = "attendance" | "transcript_reissue" | "enrollment_certificate";
type QueueFilters = { search: string; className: string; status: string; dateFrom: string; dateTo: string; page: number };

const EMPTY_SUMMARY: StudentSummary = { activeStudents: 0, monthlyAttendanceExceptions: 0, pendingTranscriptReissues: 0, pendingEnrollmentCertificates: 0 };
const EMPTY_QUEUE: StudentWorkItemsResult = { items: [], pagination: { page: 1, pageSize: 10, total: 0 }, availableClasses: [] };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<StudentSummary>(EMPTY_SUMMARY);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [queueCategory, setQueueCategory] = useState<QueueCategory | null>(null);
  const [queueFilters, setQueueFilters] = useState<QueueFilters>({ search: "", className: "", status: "", dateFrom: "", dateTo: "", page: 1 });
  const [queue, setQueue] = useState<StudentWorkItemsResult>(EMPTY_QUEUE);
  const [queueLoading, setQueueLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (query = "") => {
    const [studentsResult, summaryResult] = await Promise.all([appleApi.students(query), appleApi.studentSummary()]);
    if (studentsResult.success) setStudents(studentsResult.data); else setMessage(studentsResult.error);
    if (summaryResult.success) setSummary(summaryResult.data); else setMessage(summaryResult.error);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const importExcel = async (file?: File) => {
    if (!file) return;
    const result = await importBulkAttendanceExcel(file);
    if (result.success) {
      setMessage(`考勤导入完成：新增 ${result.data.imported}、更新 ${result.data.updated}、涉及学生 ${result.data.affectedStudents || 0}、错误 ${result.data.errors.length}`);
      await load(search);
      if (queueCategory === "attendance") await loadQueue("attendance", queueFilters);
    } else setMessage(result.error);
    if (fileRef.current) fileRef.current.value = "";
  };

  const requestDocument = async (student: Student, type: "transcript_reissue" | "enrollment_bilingual") => {
    const result = await appleApi.createStudentCertificate(student.id, { certificateType: type, language: "bilingual", purpose: type === "transcript_reissue" ? "补领本学年成绩表" : "学校事务" });
    setMessage(result.success ? (type === "transcript_reissue" ? "成绩表补领申请已建立" : "在学证明申请已建立") : result.error);
    if (result.success) await load(search);
  };

  const loadQueue = async (category: QueueCategory, filters: QueueFilters) => {
    setQueueLoading(true);
    const result = await appleApi.studentWorkItems({
      category,
      search: filters.search,
      className: filters.className,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page,
      pageSize: 10,
    });
    if (result.success) setQueue(result.data); else setMessage(result.error);
    setQueueLoading(false);
  };

  const openQueue = async (category: QueueCategory) => {
    const range = category === "attendance" ? currentMonthRange() : { dateFrom: "", dateTo: "" };
    const next: QueueFilters = { search: "", className: "", status: "", dateFrom: range.dateFrom, dateTo: range.dateTo, page: 1 };
    setQueueCategory(category);
    setQueueFilters(next);
    await loadQueue(category, next);
    window.setTimeout(() => document.getElementById("student-work-items")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const applyQueueFilters = async () => {
    if (!queueCategory) return;
    const next = { ...queueFilters, page: 1 };
    setQueueFilters(next);
    await loadQueue(queueCategory, next);
  };

  const changeQueuePage = async (page: number) => {
    if (!queueCategory) return;
    const next = { ...queueFilters, page };
    setQueueFilters(next);
    await loadQueue(queueCategory, next);
  };

  const classes = Array.from(new Set(students.map((student) => student.className))).sort();

  return <>
    <PageHeader
      eyebrow="APPLE / 学生事务"
      title="学生总览"
      description="集中查询学生资料、跨学生导入考勤、处理成绩表补领及在学证明。"
      actions={<>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(event) => void importExcel(event.target.files?.[0])} />
        <a className="button" href="/templates/apple_attendance_import_test.xlsx" download>下载考勤测试 Excel</a>
        <button className="button" onClick={() => fileRef.current?.click()}>Excel 批量导入考勤</button>
        <button className="button primary" onClick={() => setShowCreate(true)}>+ 新增学生</button>
      </>}
    />
    {message && <section className="notice">{message}</section>}
    {loading ? <LoadingState /> : <>
      <section className="stats-grid" aria-label="学生事务统计">
        <div className="stat"><span>在读学生</span><strong>{summary.activeStudents}</strong></div>
        <QueueStat label="本月考勤异常" value={summary.monthlyAttendanceExceptions} active={queueCategory === "attendance"} onClick={() => void openQueue("attendance")} />
        <QueueStat label="待补领" value={summary.pendingTranscriptReissues} active={queueCategory === "transcript_reissue"} onClick={() => void openQueue("transcript_reissue")} />
        <QueueStat label="在学证明待发" value={summary.pendingEnrollmentCertificates} active={queueCategory === "enrollment_certificate"} onClick={() => void openQueue("enrollment_certificate")} />
      </section>

      {queueCategory && <WorkItemsPanel
        category={queueCategory}
        filters={queueFilters}
        setFilters={setQueueFilters}
        result={queue}
        loading={queueLoading}
        classes={classes}
        onCategory={openQueue}
        onSearch={applyQueueFilters}
        onPage={changeQueuePage}
      />}

      <section className="panel">
        <div className="panel-header"><h3>学生名单</h3><div className="search-box"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(search); }} placeholder="搜索学号或姓名" /><button className="button" onClick={() => void load(search)}>查询</button></div></div>
        {students.length ? <div className="table-wrap"><table><thead><tr><th>学号</th><th>学生</th><th>班级</th><th>状态</th><th style={{ width: "46%" }}>操作</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.studentNo}</td><td><div className="student-row-identity"><StudentPhoto student={student} compact /><div><strong>{student.nameZh}</strong>{student.nameEn && <small className="table-subtext">{student.nameEn}</small>}</div></div></td><td>{student.className}</td><td><span className={`pill ${student.status === "active" ? "good" : "warning"}`}>{studentStatusLabel(student.status)}</span></td><td><div className="table-actions"><a className="button small" href={`/dashboard/apple/students/${student.id}`}>查看详情</a><a className="button small" href={`/dashboard/apple/students/${student.id}?tab=attendance`}>考勤记录</a><button className="button small" onClick={() => void requestDocument(student, "transcript_reissue")}>补领成绩表</button><button className="button small primary" onClick={() => void requestDocument(student, "enrollment_bilingual")}>申请在学证明</button></div></td></tr>)}</tbody></table></div> : <EmptyState text="没有符合条件的学生" />}
      </section>
    </>}
    {showCreate && <CreateStudentDialog onClose={() => setShowCreate(false)} onSaved={async (text) => { setShowCreate(false); setMessage(text); await load(search); }} />}
  </>;
}

function QueueStat({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return <button type="button" className={`stat stat-action ${active ? "active" : ""}`} onClick={onClick}><span>{label}</span><strong>{value}</strong><small>点击查看及分类</small></button>;
}

function WorkItemsPanel({ category, filters, setFilters, result, loading, classes, onCategory, onSearch, onPage }: {
  category: QueueCategory;
  filters: QueueFilters;
  setFilters: (value: QueueFilters) => void;
  result: StudentWorkItemsResult;
  loading: boolean;
  classes: string[];
  onCategory: (value: QueueCategory) => Promise<void>;
  onSearch: () => Promise<void>;
  onPage: (page: number) => Promise<void>;
}) {
  const statuses = category === "attendance"
    ? [["", "全部异常"], ["late", "迟到"], ["absent", "缺席"], ["sick_leave", "病假"]]
    : [["", "全部待办"], ["pending", "待处理"]];
  const totalPages = Math.max(1, Math.ceil(result.pagination.total / result.pagination.pageSize));
  return <section className="panel" id="student-work-items">
    <div className="panel-header"><div><h3>{queueTitle(category)}</h3><p className="muted">可按日期、异常或申请状态、班级及学生资料分类查询。</p></div><div className="sub-tabs compact-tabs">{(["attendance", "transcript_reissue", "enrollment_certificate"] as QueueCategory[]).map((item) => <button key={item} className={`sub-tab ${category === item ? "active" : ""}`} onClick={() => void onCategory(item)}>{queueTitle(item)}</button>)}</div></div>
    <div className="record-filter-bar">
      <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void onSearch(); }} placeholder="搜索学号、姓名或备注" />
      <select value={filters.className} onChange={(event) => setFilters({ ...filters, className: event.target.value })}><option value="">全部班级</option>{classes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <label className="inline-date"><span>开始</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
      <label className="inline-date"><span>结束</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
      <button className="button primary" onClick={() => void onSearch()}>查询</button>
    </div>
    {loading ? <LoadingState text="正在加载待办..." /> : result.items.length ? <>
      <div className="table-wrap"><table><thead><tr><th>日期</th><th>学生</th><th>班级</th><th>分类/状态</th><th>备注或用途</th><th>操作</th></tr></thead><tbody>{result.items.map((item) => <WorkItemRow key={`${item.category}-${item.id}`} item={item} />)}</tbody></table></div>
      <Pagination page={result.pagination.page} totalPages={totalPages} total={result.pagination.total} onPage={onPage} />
    </> : <EmptyState text="当前筛选条件下没有待办记录" />}
  </section>;
}

function WorkItemRow({ item }: { item: StudentWorkItem }) {
  const tab = item.category === "attendance" ? "attendance" : "certificates";
  return <tr><td>{item.date}</td><td><strong>{item.studentName}</strong><small className="table-subtext">{item.studentNo}</small></td><td>{item.className}</td><td><span className={`pill ${item.category === "attendance" ? "danger" : "warning"}`}>{item.category === "attendance" ? attendanceLabel(item.status) : "待处理"}</span></td><td>{item.detail}</td><td><a className="button small primary" href={`/dashboard/apple/students/${item.studentId}?tab=${tab}`}>查看学生记录</a></td></tr>;
}

function CreateStudentDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState({ studentNo: "", nameZh: "", nameEn: "", className: "", admissionDate: "", parentName: "", parentPhone: "", parentEmail: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const save = async () => {
    setSaving(true);
    setError("");
    let photoUrl: string | null = null;
    if (photo) {
      const upload = await uploadStudentPhoto(photo);
      if (!upload.success) { setError(upload.error); setSaving(false); return; }
      photoUrl = upload.data.photoUrl;
    }
    const result = await appleApi.createStudent({ ...form, status: "active", admissionDate: form.admissionDate || null, parentEmail: form.parentEmail || null, photoUrl });
    if (result.success) await onSaved(`${result.data.nameZh} 已新增`); else setError(result.error);
    setSaving(false);
  };
  const field = (key: keyof typeof form, label: string, type = "text") => <label className="field"><span>{label}</span><input type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>;
  return <div className="modal-backdrop open"><div className="modal"><div className="panel-header"><h3>新增学生</h3><button className="button small" onClick={onClose}>关闭</button></div>{error && <p className="error-box">{error}</p>}<div className="student-photo-upload"><div className="student-avatar preview">{preview ? <img src={preview} alt="学生照片预览" /> : <span>{form.nameZh.slice(-1) || "照"}</span>}</div><label className="field"><span>学生照片（JPG、PNG 或 WebP，最大 5MB）</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label></div><div className="modal-grid">{field("studentNo", "学号")}{field("nameZh", "中文姓名")}{field("nameEn", "英文姓名")}{field("className", "班级")}{field("admissionDate", "入学日期", "date")}{field("parentName", "家长姓名")}{field("parentPhone", "家长电话")}{field("parentEmail", "家长电邮", "email")}</div><div className="form-actions" style={{ marginTop: 14 }}><button className="button" onClick={onClose}>取消</button><button className="button primary" disabled={saving || !form.studentNo || !form.nameZh || !form.className} onClick={() => void save()}>{saving ? "保存中..." : "保存学生"}</button></div></div></div>;
}

function StudentPhoto({ student, compact = false }: { student: Student; compact?: boolean }) {
  return <div className={compact ? "student-avatar compact" : "student-avatar"}>{student.photoUrl ? <img src={student.photoUrl} alt={`${student.nameZh} 学生照片`} /> : <span>{student.nameZh.slice(-1)}</span>}</div>;
}

function Pagination({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (page: number) => Promise<void> }) {
  return <div className="pagination"><span>共 {total} 条 · 第 {page}/{totalPages} 页</span><div><button className="button small" disabled={page <= 1} onClick={() => void onPage(page - 1)}>上一页</button><button className="button small" disabled={page >= totalPages} onClick={() => void onPage(page + 1)}>下一页</button></div></div>;
}

function currentMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, "0");
  return { dateFrom: `${year}-${month}-01`, dateTo: `${year}-${month}-${lastDay}` };
}

function queueTitle(value: QueueCategory): string { return { attendance: "考勤异常", transcript_reissue: "成绩表待补领", enrollment_certificate: "在学证明待发" }[value]; }
function studentStatusLabel(value: Student["status"]): string { return { active: "在读", suspended: "停学", withdrawn: "已离校" }[value]; }
function attendanceLabel(value: string): string { return { present: "出勤", late: "迟到", absent: "缺席", sick_leave: "病假" }[value] || value; }
