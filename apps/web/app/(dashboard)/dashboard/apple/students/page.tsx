"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import { Plus, GraduationCap, Search } from "lucide-react";

interface StudentRecord {
  id: string;
  studentNo: string;
  nameZh: string;
  nameEn?: string;
  className: string;
  status: string;
  admissionDate?: string;
  parentName?: string;
  parentPhone?: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: { label: "在讀", className: "bg-green-50 text-green-700" },
  graduated: { label: "已畢業", className: "bg-blue-50 text-blue-700" },
  transferred: { label: "已轉學", className: "bg-orange-50 text-orange-700" },
  suspended: { label: "休學", className: "bg-gray-50 text-gray-700" },
};

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem("token");
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8100";
      const res = await fetch(`${apiBase}/api/v1/apple/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) {
        setStudents(Array.isArray(json.data) ? json.data : json.data.items || []);
      }
    } catch (err) {
      console.error("加載學生列表失敗", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filtered = search
    ? students.filter(
        (s) =>
          s.nameZh.includes(search) ||
          s.studentNo.includes(search) ||
          s.className.includes(search)
      )
    : students;

  const columns: Column<StudentRecord>[] = [
    { key: "studentNo", header: "學號", width: "120px" },
    { key: "nameZh", header: "姓名", width: "100px" },
    {
      key: "className",
      header: "班級",
      width: "100px",
      render: (row) => (
        <span className="text-sm font-medium text-gray-900">{row.className}</span>
      ),
    },
    {
      key: "status",
      header: "狀態",
      width: "90px",
      render: (row) => {
        const s = STATUS_MAP[row.status] || { label: row.status, className: "bg-gray-50 text-gray-600" };
        return (
          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${s.className}`}>
            {s.label}
          </span>
        );
      },
    },
    {
      key: "parentName",
      header: "家長",
      width: "100px",
      render: (row) => row.parentName || "-",
    },
    {
      key: "parentPhone",
      header: "聯繫電話",
      width: "130px",
      render: (row) => row.parentPhone || "-",
    },
    {
      key: "admissionDate",
      header: "入學日期",
      width: "110px",
      render: (row) => row.admissionDate || "-",
    },
  ];

  return (
    <div>
      <PageHeader
        title="學生事務"
        subtitle="學生檔案管理"
      />

      {/* 搜索欄 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索姓名/學號/班級..."
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <span className="text-sm text-gray-500">
          {loading ? "加載中..." : `共 ${filtered.length} 名學生`}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        total={filtered.length}
        loading={loading}
        emptyText="暫未導入學生數據，請通過後台上傳學生信息"
      />
    </div>
  );
}
