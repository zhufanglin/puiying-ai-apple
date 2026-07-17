"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState, LoadingState, PageHeader } from "@/components/shared";
import { appleApi, importAttendanceExcel, studentCertificatePdfUrl, studentScoresExportUrl } from "@/lib/api";
import type { AttendanceRecord, ScoreRecord, Student, StudentCertificate } from "@/lib/types";

type Tab = "profile" | "attendance" | "scores" | "certificates";
const PAGE_SIZE = 8;

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [message, setMessage] = useState("");
  const attendanceFileRef = useRef<HTMLInputElement>(null);
  const load = async () => { const result = await appleApi.student(id); if (result.success) setStudent(result.data); else setMessage(result.error); };
  useEffect(() => { const initial = new URLSearchParams(window.location.search).get("tab"); if (["profile", "attendance", "scores", "certificates"].includes(initial || "")) setTab(initial as Tab); void load(); }, [id]);

  const importAttendance = async (file?: File) => {
    if (!file) return;
    const result = await importAttendanceExcel(id, file);
    setMessage(result.success ? `考勤导入完成：新增 ${result.data.imported}、更新 ${result.data.updated}、错误 ${result.data.errors.length}` : result.error);
    if (result.success) await load();
    if (attendanceFileRef.current) attendanceFileRef.current.value = "";
  };
  if (!student && !message) return <LoadingState text="正在加载学生资料…" />;
  if (!student) return <section className="error-box">{message}</section>;

  return <>
    <PageHeader eyebrow="APPLE / 学生事务" title={`${student.nameZh} · ${student.studentNo}`} description={`${student.className} 班 · ${studentStatusLabel(student.status)}`} actions={<a className="button" href="/dashboard/apple/students">返回学生总览</a>} />
    {message && <section className="notice">{message}</section>}
    <section className="panel student-identity"><div className="student-avatar">{student.photoUrl ? <img src={student.photoUrl} alt={`${student.nameZh} 学生照片`} /> : <span>{student.nameZh.slice(-1)}</span>}</div><div><strong>{student.nameZh}</strong><p>{student.nameEn || "未登记英文姓名"}</p><div className="card-line"><span className="pill brand">{student.studentNo}</span><span className="pill good">{student.className}</span></div></div></section>
    <section className="panel">
      <div className="sub-tabs" role="tablist">{([['profile', '基本信息'], ['attendance', '考勤记录'], ['scores', '成绩记录'], ['certificates', '证明申请']] as [Tab, string][]).map(([key, label]) => <button role="tab" aria-selected={tab === key} className={`sub-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)} key={key}>{label}</button>)}</div>
      {tab === "profile" && <ProfileTab student={student} />}
      {tab === "attendance" && <AttendanceTab student={student} fileRef={attendanceFileRef} onImport={importAttendance} />}
      {tab === "scores" && <ScoresTab student={student} />}
      {tab === "certificates" && <CertificatesTab student={student} onSaved={async (text) => { setMessage(text); await load(); }} />}
    </section>
  </>;
}

function ProfileTab({ student }: { student: Student }) {
  const rows = [["学号", student.studentNo], ["中文姓名", student.nameZh], ["英文姓名", student.nameEn || "未登记"], ["班级", student.className], ["入学日期", student.admissionDate || "未登记"], ["学生状态", studentStatusLabel(student.status)], ["家长姓名", student.parentName || "未登记"], ["家长电话", student.parentPhone || "未登记"], ["家长电邮", student.parentEmail || "未登记"]];
  return <div className="profile-content"><div className="profile-photo-card"><span>学生照片</span><div className="student-avatar profile-photo">{student.photoUrl ? <img src={student.photoUrl} alt={`${student.nameZh} 学生照片`} /> : <span>{student.nameZh.slice(-1)}</span>}</div></div><div className="profile-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div>;
}

function AttendanceTab({ student, fileRef, onImport }: { student: Student; fileRef: React.RefObject<HTMLInputElement>; onImport: (file?: File) => Promise<void> }) {
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
    <div className="toolbar-line"><p className="muted">可按时间、考勤状态和备注查询；重复日期会更新原记录。</p><div><input ref={fileRef} hidden type="file" accept=".xlsx" onChange={(event) => void onImport(event.target.files?.[0])} /><button className="button primary" onClick={() => fileRef.current?.click()}>Excel 导入该生考勤</button></div></div>
    <div className="record-filter-bar detail-record-filters">
      <input value={query} onChange={(event) => update(() => setQuery(event.target.value))} placeholder="搜索日期或备注" />
      <select value={status} onChange={(event) => update(() => setStatus(event.target.value))}><option value="">全部状态</option><option value="present">出勤</option><option value="late">迟到</option><option value="absent">缺席</option><option value="sick_leave">病假</option></select>
      <label className="inline-date"><span>开始</span><input type="date" value={dateFrom} onChange={(event) => update(() => setDateFrom(event.target.value))} /></label>
      <label className="inline-date"><span>结束</span><input type="date" value={dateTo} onChange={(event) => update(() => setDateTo(event.target.value))} /></label>
      <button className="button" onClick={() => { setQuery(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); }}>重置</button>
    </div>
    {visible.length ? <><div className="table-wrap"><table><thead><tr><th>日期</th><th>状态</th><th>备注</th></tr></thead><tbody>{visible.map((row) => <AttendanceRow key={row.id} row={row} />)}</tbody></table></div><Pagination page={page} total={rows.length} onPage={setPage} /></> : <EmptyState text="当前筛选条件下没有考勤记录" />}
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
    <div className="toolbar-line"><p className="muted">选择学期或科目后，导出的 Excel 只包含当前筛选范围。</p><a className="button primary" href={studentScoresExportUrl(student.id, { schoolYear, term, subject })}>导出成绩 Excel</a></div>
    <div className="record-filter-bar score-record-filters">
      <input value={query} onChange={(event) => update(() => setQuery(event.target.value))} placeholder="搜索科目或等级" />
      <select value={schoolYear} onChange={(event) => update(() => setSchoolYear(event.target.value))}><option value="">全部学年</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={term} onChange={(event) => update(() => setTerm(event.target.value))}><option value="">全部学期</option>{terms.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={subject} onChange={(event) => update(() => setSubject(event.target.value))}><option value="">全部科目</option>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <button className="button" onClick={() => { setQuery(""); setSchoolYear(""); setTerm(""); setSubject(""); setPage(1); }}>重置</button>
    </div>
    {visible.length ? <><div className="table-wrap"><table><thead><tr><th>学年</th><th>学期</th><th>科目</th><th>分数</th><th>等级</th></tr></thead><tbody>{visible.map((row) => <ScoreRow key={row.id} row={row} />)}</tbody></table></div><Pagination page={page} total={rows.length} onPage={setPage} /></> : <EmptyState text="当前筛选条件下没有成绩记录" />}
  </>;
}

function ScoreRow({ row }: { row: ScoreRecord }) {
  return <tr><td>{row.schoolYear}</td><td>{row.term}</td><td>{row.subject}</td><td>{row.score}</td><td><span className="pill brand">{row.grade}</span></td></tr>;
}

function CertificatesTab({ student, onSaved }: { student: Student; onSaved: (text: string) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"enrollment_bilingual" | "enrollment" | "transcript_reissue">("enrollment_bilingual");
  const [purpose, setPurpose] = useState("学校事务");
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const create = async () => {
    const result = await appleApi.createStudentCertificate(student.id, { certificateType: type, language: type === "enrollment" ? "zh" : "bilingual", purpose });
    if (result.success) { setShowForm(false); await onSaved("申请已建立，可一键生成 PDF"); } else await onSaved(result.error);
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
    <div className="toolbar-line"><p className="muted">可按申请日期、证明类型、状态和用途查询。</p><button className="button primary" onClick={() => setShowForm(!showForm)}>+ 申请在学证明</button></div>
    {showForm && <div className="certificate-form"><label className="field"><span>申请类型</span><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="enrollment_bilingual">中英双语在学证明</option><option value="enrollment">中文在学证明</option><option value="transcript_reissue">成绩表补领</option></select></label><label className="field"><span>用途</span><input value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label><button className="button primary" onClick={() => void create()}>提交申请</button></div>}
    <div className="record-filter-bar certificate-record-filters">
      <input value={query} onChange={(event) => update(() => setQuery(event.target.value))} placeholder="搜索用途或证明类型" />
      <select value={filterType} onChange={(event) => update(() => setFilterType(event.target.value))}><option value="">全部类型</option><option value="enrollment_bilingual">双语在学证明</option><option value="enrollment">中文在学证明</option><option value="transcript_reissue">成绩表补领</option></select>
      <select value={status} onChange={(event) => update(() => setStatus(event.target.value))}><option value="">全部状态</option><option value="pending">待生成</option><option value="generated">已生成</option></select>
      <label className="inline-date"><span>开始</span><input type="date" value={dateFrom} onChange={(event) => update(() => setDateFrom(event.target.value))} /></label>
      <label className="inline-date"><span>结束</span><input type="date" value={dateTo} onChange={(event) => update(() => setDateTo(event.target.value))} /></label>
      <button className="button" onClick={() => { setQuery(""); setFilterType(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); }}>重置</button>
    </div>
    {visible.length ? <><div className="table-wrap"><table><thead><tr><th>申请日期</th><th>类型</th><th>用途</th><th>状态</th><th>操作</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td>{row.requestDate}</td><td>{certificateLabel(row.certificateType)}</td><td>{row.purpose}</td><td><span className={`pill ${row.status === "generated" ? "good" : "warning"}`}>{row.status === "generated" ? "已生成" : "待生成"}</span></td><td><a className="button small primary" href={studentCertificatePdfUrl(student.id, row.id)} target="_blank" rel="noreferrer">一键生成 PDF</a></td></tr>)}</tbody></table></div><Pagination page={page} total={rows.length} onPage={setPage} /></> : <EmptyState text="当前筛选条件下没有证明申请" />}
  </>;
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div className="pagination"><span>共 {total} 条 · 第 {page}/{totalPages} 页</span><div><button className="button small" disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button><button className="button small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>下一页</button></div></div>;
}

function paginate<T>(rows: T[], page: number): T[] { return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE); }
function unique(values: string[]): string[] { return Array.from(new Set(values)).sort(); }
function studentStatusLabel(value: Student["status"]): string { return { active: "在读", suspended: "停学", withdrawn: "已离校" }[value]; }
function attendanceLabel(value: AttendanceRecord["status"]): string { return { present: "出勤", late: "迟到", absent: "缺席", sick_leave: "病假" }[value]; }
function certificateLabel(value: StudentCertificate["certificateType"]): string { return { enrollment: "中文在学证明", enrollment_bilingual: "中英双语在学证明", transcript_reissue: "成绩表补领" }[value]; }
