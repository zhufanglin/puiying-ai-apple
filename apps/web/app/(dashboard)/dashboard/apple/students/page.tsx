"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import { Plus, GraduationCap, Search } from "lucide-react";

interface StudentRecord {
  id: string;
  student_no: string;
  name_zh: string;
  name_en?: string;
  class_name: string;
  status: string;
  admission_date?: string;
  parent_name?: string;
  parent_phone?: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: { label: "在读", className: "bg-green-50 text-green-700" },
  graduated: { label: "已毕业", className: "bg-blue-50 text-blue-700" },
  transferred: { label: "已转学", className: "bg-orange-50 text-orange-700" },
  suspended: { label: "休学", className: "bg-gray-50 text-gray-700" },
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
      console.error("加载学生列表失败", err);
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
          s.name_zh.includes(search) ||
          s.student_no.includes(search) ||
          s.class_name.includes(search)
      )
    : students;

  const columns: Column<StudentRecord>[] = [
    { key: "student_no", header: "学号", width: "120px" },
    { key: "name_zh", header: "姓名", width: "100px" },
    {
      key: "class_name",
      header: "班级",
      width: "100px",
      render: (row) => (
        <span className="text-sm font-medium text-gray-900">{row.class_name}</span>
      ),
    },
    {
      key: "status",
      header: "状态",
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
      key: "parent_name",
      header: "家长",
      width: "100px",
      render: (row) => row.parent_name || "-",
    },
    {
      key: "parent_phone",
      header: "联系电话",
      width: "130px",
      render: (row) => row.parent_phone || "-",
    },
    {
      key: "admission_date",
      header: "入学日期",
      width: "110px",
      render: (row) => row.admission_date || "-",
    },
  ];

  return (
    <div>
      <PageHeader
        title="学生事务"
        subtitle="学生档案管理"
      />

      {/* 搜索栏 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索姓名/学号/班级..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <span className="text-sm text-gray-500">
          {loading ? "加载中..." : `共 ${filtered.length} 名学生`}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        total={filtered.length}
        loading={loading}
        emptyText="暂未导入学生数据，请通过后台上传学生信息"
      />
    </div>
  );
}
