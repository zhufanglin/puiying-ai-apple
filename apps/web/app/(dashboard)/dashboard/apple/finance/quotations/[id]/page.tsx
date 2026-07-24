"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Building2, DollarSign, Tag, AlertTriangle, Check, X } from "lucide-react";
import { api } from "@/lib/api";

const B = "#23675f"; const BG = "#f6f7f9"; const BD = "#d8dee6"; const MU = "#667085";
const SH = { boxShadow: "0 10px 30px rgba(16,24,40,0.08)" };

const Pill = ({ label, tone }: { label: string; tone: string }) => {
  const map: Record<string, string> = {
    good: "bg-[#ecfdf3] text-[#027a48]",
    warning: "bg-[#fffaeb] text-[#936a00]",
    danger: "bg-[#fef3f2] text-[#b42318]",
    neutral: "bg-[#f1f5f8] text-[#667085]",
  };
  return <span className={`inline-flex items-center rounded-full px-[7px] py-[3px] text-[11px] font-bold whitespace-nowrap ${map[tone] || map.neutral}`}>{label}</span>;
};

interface QuotationDetail {
  id: number;
  project_name: string;
  vendor: string;
  amount: number;
  is_lowest: boolean;
  is_selected: boolean;
  remark: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);
  const [record, setRecord] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get<any>("/apple/finance/quotations")
      .then(res => {
        if (cancelled) return;
        const items: any[] = res.data?.items ?? res.data ?? [];
        const found = items.find((r: any) => r.id === id);
        if (found) {
          setRecord({
            id: found.id,
            project_name: found.project_name || found.projectName || "",
            vendor: found.vendor || "",
            amount: found.amount || 0,
            is_lowest: Boolean(found.is_lowest ?? found.isLowest),
            is_selected: Boolean(found.is_selected ?? found.isSelected),
            remark: found.remark || null,
            created_by: found.created_by || 0,
            created_at: found.created_at || "",
            updated_at: found.updated_at || "",
          });
        } else {
          setRecord(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRecord(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div style={{ background: BG }} className="min-h-screen" />;
  if (!record) {
    return (
      <div style={{ background: BG }} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#667085] text-lg mb-4">找不到此報價記錄</p>
          <button onClick={() => router.back()} className="px-4 py-2 text-sm text-white rounded-lg font-bold" style={{ background: B }}>返回列表</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: BG }} className="space-y-4">
      {/* 返回 */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm font-bold text-[#667085] hover:text-[#1d2939]">
        <ArrowLeft size={16} /> 返回報價單列表
      </button>

      {/* 標題 */}
      <div className="bg-white rounded-lg border border-[#d8dee6] p-6" style={SH}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1d2939]">{record.project_name}</h2>
            <p className="text-sm text-[#667085] mt-1">報價記錄 #{record.id}</p>
          </div>
          <div className="flex items-center gap-2">
            {record.is_lowest && <Pill label="最低報價" tone="good" />}
            {record.is_selected ? <Pill label="已採納" tone="good" /> : <Pill label="未採納" tone="neutral" />}
          </div>
        </div>
      </div>

      {/* 報價詳細信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={SH}>
          <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">報價信息</h3>
          <div className="space-y-3">
            {[
              { icon: FileText, label: "項目名稱", value: record.project_name },
              { icon: Building2, label: "報價單位", value: record.vendor },
              { icon: DollarSign, label: "報價金額", value: `HK$ ${record.amount.toLocaleString()}` },
              { icon: Tag, label: "備註", value: record.remark || "—" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#d8dee6] last:border-0">
                <item.icon size={16} className="text-[#667085] shrink-0" />
                <span className="text-sm text-[#667085] w-20 shrink-0">{item.label}</span>
                <span className="text-sm font-bold text-[#1d2939]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={SH}>
          <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">報價分析</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 py-2">
              {record.is_lowest ? (
                <Check size={18} className="text-[#027a48] shrink-0" />
              ) : (
                <X size={18} className="text-[#b42318] shrink-0" />
              )}
              <span className="text-sm text-[#667085]">是否最低報價</span>
              <span className="text-sm font-bold ml-auto" style={{ color: record.is_lowest ? "#027a48" : "#b42318" }}>
                {record.is_lowest ? "是 ✓" : "否 ✗"}
              </span>
            </div>
            <div className="flex items-center gap-3 py-2">
              {record.is_selected ? (
                <Check size={18} className="text-[#027a48] shrink-0" />
              ) : (
                <X size={18} className="text-[#b42318] shrink-0" />
              )}
              <span className="text-sm text-[#667085]">是否已採納</span>
              <span className="text-sm font-bold ml-auto" style={{ color: record.is_selected ? "#027a48" : "#b42318" }}>
                {record.is_selected ? "是 ✓" : "否 ✗"}
              </span>
            </div>

            {record.is_selected && !record.is_lowest && (
              <div className="mt-3 p-3 rounded-lg border flex items-start gap-2" style={{ background: "#fef3f2", borderColor: "#fecdca", color: "#b42318" }}>
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">未採納最低報價</p>
                  <p className="text-xs mt-1 opacity-80">此項目的最低報價未被採納，請在備註中説明原因</p>
                </div>
              </div>
            )}

            <div className="mt-3 p-3 rounded-lg" style={{ background: "#eef4ff", borderColor: "#bfdbfe" }}>
              <p className="text-xs text-[#155eef]">
                {record.is_lowest
                  ? "此報價為該項目的最低報價，推薦採納"
                  : "此報價非該項目最低價，請審慎評估"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 元數據 */}
      <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={SH}>
        <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">記錄信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "創建時間", value: record.created_at?.slice(0, 10) || "—" },
            { label: "更新時間", value: record.updated_at?.slice(0, 10) || "—" },
            { label: "創建者", value: record.created_by ? `用戶 #${record.created_by}` : "—" },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 rounded-lg" style={{ background: "#f8fafc" }}>
              <p className="text-xs text-[#667085] mb-1">{item.label}</p>
              <p className="text-sm font-bold text-[#1d2939]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
