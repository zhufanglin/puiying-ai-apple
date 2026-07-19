"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState, LoadingState, PageHeader } from "../components";
import { importAttendanceExcel, studentCertificatePdfUrl, studentMediaUrl, studentScoresExportUrl, studentsApi } from "@/lib/students-api";
import type { AttendanceRecord, ScoreRecord, Student, StudentCertificate } from "@/lib/students-api";

type Tab = "profile" | "attendance" | "scores" | "certificates";
const PAGE_SIZE = 8;

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [message, setMessage] = useState("");
  const attendanceFileRef = useRef<HTMLInputElement>(null);
  const load = async () => { const result = await studentsApi.student(id); if (result.success) setStudent(result.data); else setMessage(result.error); };
  useEffect(() => { const initial = new URLSearchParams(window.location.search).get("tab"); if (["profile", "attendance", "scores", "certificates"].includes(initial || "")) setTab(initial as Tab); void load(); }, [id]);

  const importAttendance = async (file?: File) => {
    if (!file) return;
    const result = await importAttendanceExcel(id, file);
    setMessage(result.success ? `考勤導入完成：新增 ${result.data.imported}、更新 ${result.data.updated}、錯誤 ${result.data.errors.length}` : result.error);
    if (result.success) await load();
    if (attendanceFileRef.current) attendanceFileRef.current.value = "";
  };
  if (!student && !message) return <LoadingState text="正在加載學生資料…" />;
  if (!student) return <section className="error-box">{message}</section>;

  return <>
    <PageHeader backHref="/dashboard/apple/students" eyebrow="APPLE / 學生事務" title={`${student.nameZh} · ${student.studentNo}`} description={`${student.className} 班 · ${studentStatusLabel(student.status)}`} actions={<a className="button" href="/dashboard/apple/students">返回學生總覽</a>} />
    {message && <section className="notice">{message}</section>}
    <section className="panel student-identity"><div className="student-avatar">{student.photoUrl ? <img src={studentMediaUrl(student.photoUrl)} alt={`${student.nameZh} 學生照片`} /> : <span>{student.nameZh.slice(-1)}</span>}</div><div><strong>{student.nameZh}</strong><p>{student.nameEn || "未登記英文姓名"}</p><div className="card-line"><span className="pill brand">{student.studentNo}</span><span className="pill good">{student.className}</span></div></div></section>
    <section className="panel">
      <div className="sub-tabs" role="tablist">{([['profile', '基本信息'], ['attendance', '考勤記錄'], ['scores', '成績記錄'], ['certificates', '證明申請']] as [Tab, string][]).map(([key, label]) => <button role="tab" aria-selected={tab === key} className={`sub-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)} key={key}>{label}</button>)}</div>
      {tab === "profile" && <ProfileTab student={student} />}
      {tab === "attendance" && <AttendanceTab student={student} fileRef={attendanceFileRef} onImport={importAttendance} />}
      {tab === "scores" && <ScoresTab student={student} />}
      {tab === "certificates" && <CertificatesTab student={student} onSaved={async (text) => { setMessage(text); await load(); }} />}
    </section>
  </>;
}

function ProfileTab({ student }: { student: Student }) {
  const rows = [["學號", student.studentNo], ["中文姓名", student.nameZh], ["英文姓名", student.nameEn || "未登記"], ["班級", student.className], ["入學日期", student.admissionDate || "未登記"], ["學生狀態", studentStatusLabel(student.status)], ["家長姓名", student.parentName || "未登記"], ["家長電話", student.parentPhone || "未登記"], ["家長電郵", student.parentEmail || "未登記"]];
  return <div className="profile-content"><div className="profile-photo-card"><span>學生照片</span><div className="student-avatar profile-photo">{student.photoUrl ? <img src={studentMediaUrl(student.photoUrl)} alt={`${student.nameZh} 學生照片`} /> : <span>{student.nameZh.slice(-1)}</span>}</div></div><div className="profile-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div>;
}

function AttendanceTab({ student, fileRef, onImport }: { student: Student; fileRef: React.RefObject<HTMLInputElement | null>; onImport: (file?: File) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const rows = (student.attendance || []).filter((row) =>
    (!query || `${row.date} ${row.remarks || ""}`.toLowerCase().includes(query.toLowerCase()))
    && (!status || row.status === status)
    && (!dateFrom || row.date >= dateFrom)
    && (!dateTo || row.date <= dateTo)
  );
  const visible = paginate(rows, page);
  const update = (action: () => void) => { action(); setPage(1); };
  return <>
    <div className="toolbar-line"><p className="muted">可按時間、考勤狀態和備註查詢；重複日期會更新原記錄。</p><div><input ref={fileRef} hidden type="file" accept=".xlsx" onChange={(event) => void onImport(event.target.files?.[0])} /><button className="button primary" onClick={() => fileRef.current?.click()}>Excel 導入該生考勤</button></div></div>
    <div className="record-filter-bar detail-record-filters">
      <input value={query} onChange={(event) => update(() => setQuery(event.target.value))} placeholder="搜索日期或備註" />
      <select value={status} onChange={(event) => update(() => setStatus(event.target.value))}><option value="">全部狀態</option><option value="present">出勤</option><option value="late">遲到</option><option value="absent">缺席</option><option value="sick_leave">病假</option></select>
      <label className="inline-date"><span>開始</span><input type="date" value={dateFrom} onChange={(event) => update(() => setDateFrom(event.target.value))} /></label>
      <label className="inline-date"><span>結束</span><input type="date" value={dateTo} onChange={(event) => update(() => setDateTo(event.target.value))} /></label>
      <button className="button" onClick={() => { setQuery(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); }}>重置</button>
    </div>
    {visible.length ? <><div className="table-wrap"><table><thead><tr><th>日期</th><th>狀態</th><th>備註</th></tr></thead><tbody>{visible.map((row) => <AttendanceRow key={row.id} row={row} />)}</tbody></table></div><Pagination page={page} total={rows.length} onPage={setPage} /></> : <EmptyState text="當前篩選條件下沒有考勤記錄" />}
  </>;
}

function AttendanceRow({ row }: { row: AttendanceRecord }) {
  return <tr><td>{row.date}</td><td><span className={`pill ${row.status === "present" ? "good" : row.status === "late" ? "warning" : "danger"}`}>{attendanceLabel(row.status)}</span></td><td>{row.remarks || "—"}</td></tr>;
}

function ScoresTab({ student }: { student: Student }) {
  const allRows = student.scores || [];
  const [query, setQuery] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [term, setTerm] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);
  const years = unique(allRows.map((row) => row.schoolYear));
  const terms = unique(allRows.map((row) => row.term));
  const subjects = unique(allRows.map((row) => row.subject));
  const rows = allRows.filter((row) =>
    (!query || `${row.subject} ${row.grade}`.toLowerCase().includes(query.toLowerCase()))
    && (!schoolYear || row.schoolYear === schoolYear)
    && (!term || row.term === term)
    && (!subject || row.subject === subject)
  );
  const visible = paginate(rows, page);
  const update = (action: () => void) => { action(); setPage(1); };
  return <>
    <div className="toolbar-line"><p className="muted">選擇學期或科目後，導出的 Excel 只包含當前篩選範圍。</p><a className="button primary" href={studentScoresExportUrl(student.id, { schoolYear, term, subject })}>導出成績 Excel</a></div>
    <div className="record-filter-bar score-record-filters">
      <input value={query} onChange={(event) => update(() => setQuery(event.target.value))} placeholder="搜索科目或等級" />
      <select value={schoolYear} onChange={(event) => update(() => setSchoolYear(event.target.value))}><option value="">全部學年</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={term} onChange={(event) => update(() => setTerm(event.target.value))}><option value="">全部學期</option>{terms.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={subject} onChange={(event) => update(() => setSubject(event.target.value))}><option value="">全部科目</option>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <button className="button" onClick={() => { setQuery(""); setSchoolYear(""); setTerm(""); setSubject(""); setPage(1); }}>重置</button>
    </div>
    {visible.length ? <><div className="table-wrap"><table><thead><tr><th>學年</th><th>學期</th><th>科目</th><th>分數</th><th>等級</th></tr></thead><tbody>{visible.map((row) => <ScoreRow key={row.id} row={row} />)}</tbody></table></div><Pagination page={page} total={rows.length} onPage={setPage} /></> : <EmptyState text="當前篩選條件下沒有成績記錄" />}
  </>;
}

function ScoreRow({ row }: { row: ScoreRecord }) {
  return <tr><td>{row.schoolYear}</td><td>{row.term}</td><td>{row.subject}</td><td>{row.score}</td><td><span className="pill brand">{row.grade}</span></td></tr>;
}

function CertificatesTab({ student, onSaved }: { student: Student; onSaved: (text: string) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"enrollment_bilingual" | "enrollment" | "transcript_reissue">("enrollment_bilingual");
  const [purpose, setPurpose] = useState("學校事務");
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const create = async () => {
    const result = await studentsApi.createCertificate(student.id, { certificateType: type, language: type === "enrollment" ? "zh" : "bilingual", purpose });
    if (result.success) { setShowForm(false); await onSaved("申請已建立，可一鍵生成 PDF"); } else await onSaved(result.error);
  };
  const rows = (student.certificates || []).filter((row) =>
    (!query || `${row.purpose} ${certificateLabel(row.certificateType)}`.toLowerCase().includes(query.toLowerCase()))
    && (!filterType || row.certificateType === filterType)
    && (!status || row.status === status)
    && (!dateFrom || row.requestDate >= dateFrom)
    && (!dateTo || row.requestDate <= dateTo)
  );
  const visible = paginate(rows, page);
  const update = (action: () => void) => { action(); setPage(1); };
  return <>
    <div className="toolbar-line"><p className="muted">可按申請日期、證明類型、狀態和用途查詢。</p><button className="button primary" onClick={() => setShowForm(!showForm)}>+ 申請在學證明</button></div>
    {showForm && <div className="certificate-form"><label className="field"><span>申請類型</span><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="enrollment_bilingual">中英雙語在學證明</option><option value="enrollment">中文在學證明</option><option value="transcript_reissue">成績表補領</option></select></label><label className="field"><span>用途</span><input value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label><button className="button primary" onClick={() => void create()}>提交申請</button></div>}
    <div className="record-filter-bar certificate-record-filters">
      <input value={query} onChange={(event) => update(() => setQuery(event.target.value))} placeholder="搜索用途或證明類型" />
      <select value={filterType} onChange={(event) => update(() => setFilterType(event.target.value))}><option value="">全部類型</option><option value="enrollment_bilingual">雙語在學證明</option><option value="enrollment">中文在學證明</option><option value="transcript_reissue">成績表補領</option></select>
      <select value={status} onChange={(event) => update(() => setStatus(event.target.value))}><option value="">全部狀態</option><option value="pending">待生成</option><option value="generated">已生成</option></select>
      <label className="inline-date"><span>開始</span><input type="date" value={dateFrom} onChange={(event) => update(() => setDateFrom(event.target.value))} /></label>
      <label className="inline-date"><span>結束</span><input type="date" value={dateTo} onChange={(event) => update(() => setDateTo(event.target.value))} /></label>
      <button className="button" onClick={() => { setQuery(""); setFilterType(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); }}>重置</button>
    </div>
    {visible.length ? <><div className="table-wrap"><table><thead><tr><th>申請日期</th><th>類型</th><th>用途</th><th>狀態</th><th>操作</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td>{row.requestDate}</td><td>{certificateLabel(row.certificateType)}</td><td>{row.purpose}</td><td><span className={`pill ${row.status === "generated" ? "good" : "warning"}`}>{row.status === "generated" ? "已生成" : "待生成"}</span></td><td><a className="button small primary" href={studentCertificatePdfUrl(student.id, row.id)} target="_blank" rel="noreferrer">一鍵生成 PDF</a></td></tr>)}</tbody></table></div><Pagination page={page} total={rows.length} onPage={setPage} /></> : <EmptyState text="當前篩選條件下沒有證明申請" />}
  </>;
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div className="pagination"><span>共 {total} 條 · 第 {page}/{totalPages} 頁</span><div><button className="button small" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一頁</button><button className="button small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>下一頁</button></div></div>;
}

function paginate<T>(rows: T[], page: number): T[] { return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE); }
function unique(values: string[]): string[] { return Array.from(new Set(values)).sort(); }
function studentStatusLabel(value: Student["status"]): string { return { active: "在讀", suspended: "停學", withdrawn: "已離校" }[value]; }
function attendanceLabel(value: AttendanceRecord["status"]): string { return { present: "出勤", late: "遲到", absent: "缺席", sick_leave: "病假" }[value]; }
function certificateLabel(value: StudentCertificate["certificateType"]): string { return { enrollment: "中文在學證明", enrollment_bilingual: "中英雙語在學證明", transcript_reissue: "成績表補領" }[value]; }
