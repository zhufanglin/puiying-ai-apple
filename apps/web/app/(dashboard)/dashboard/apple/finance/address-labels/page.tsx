"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, CheckSquare, Square, FileText, Printer, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const B = "#23675f"; const BG = "#f6f7f9"; const BD = "#d8dee6"; const MU = "#667085";
const SH = { boxShadow: "0 10px 30px rgba(16,24,40,0.08)" };

interface IncomeRecord {
  id: number;
  project: string;
  date: string;
  amount: number;
  handler: string;
  status: string;
}

const Pill = ({ label, tone }: { label: string; tone: string }) => {
  const map: Record<string, string> = {
    good: "bg-[#ecfdf3] text-[#027a48]",
    warning: "bg-[#fffaeb] text-[#936a00]",
    neutral: "bg-[#f1f5f8] text-[#667085]",
  };
  return <span className={`inline-flex items-center rounded-full px-[7px] py-[3px] text-[11px] font-bold whitespace-nowrap ${map[tone] || map.neutral}`}>{label}</span>;
};

export default function AddressLabelsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [showLabels, setShowLabels] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<any>("/apple/finance/income").catch(() => ({ data: { items: [] } })),
    ]).then(([incomeRes]) => {
      if (cancelled) return;
      const items = incomeRes.data?.items ?? incomeRes.data ?? [];
      setRecords(items.map((r: any) => ({
        id: r.id,
        project: r.project || r.name || "",
        date: r.date?.slice(0, 10) || "",
        amount: r.amount || 0,
        handler: r.handler || "-",
        status: r.status || "pending",
      })));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === records.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map(r => r.id)));
    }
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    try {
      const res = await api.post<any>("/apple/finance/address-labels", {
        record_ids: Array.from(selected),
      });
      const data = res.data ?? res;
      setLabels(data.labels || []);
      setShowLabels(true);
    } catch (err) {
      console.error("Label generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    const content = labels.join("\n\n---\n\n");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>地址標籤</title><style>body{font-family:monospace;white-space:pre-wrap;padding:20px;font-size:14px;line-height:1.6}@media print{body{margin:0}}</style></head><body><pre>${content}</pre><script>window.onload=function(){window.print()}<\/script></body></html>`);
  };

  if (loading) return <div style={{ background: BG }} className="min-h-screen" />;

  return (
    <div style={{ background: BG }} className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm font-bold text-[#667085] hover:text-[#1d2939]">
        <ArrowLeft size={16} /> 返回財務列表
      </button>

      <div className="bg-white rounded-lg border border-[#d8dee6] p-6" style={SH}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1d2939]">地址標籤生成</h2>
            <p className="text-sm text-[#667085] mt-1">選擇收入記錄，批量生成郵寄地址標籤</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#667085]">已選 {selected.size} / {records.length}</span>
          </div>
        </div>
      </div>

      {/* 記錄列表 */}
      <div className="bg-white rounded-lg border border-[#d8dee6] overflow-hidden" style={SH}>
        <div className="flex items-center justify-between p-4 border-b border-[#d8dee6]">
          <div className="flex items-center gap-3">
            <button onClick={toggleAll} className="flex items-center gap-1 text-sm text-[#667085] hover:text-[#1d2939] font-bold">
              {selected.size === records.length ? <CheckSquare size={16} /> : <Square size={16} />}
              全選
            </button>
          </div>
          <button
            onClick={handleGenerate}
            disabled={selected.size === 0 || generating}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg font-bold disabled:opacity-50"
            style={{ background: B }}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {generating ? "生成中..." : "生成標籤"}
          </button>
        </div>

        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: "8%" }} />
            <col style={{ width: "28%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-[#d8dee6] bg-[#f8fafc]">
              <th className="px-[8px] py-[8px] text-[12px] font-bold text-[#344054] text-center">選擇</th>
              <th className="px-[8px] py-[8px] text-left text-[12px] font-bold text-[#344054]">項目名稱</th>
              <th className="px-[8px] py-[8px] text-left text-[12px] font-bold text-[#344054]">金額</th>
              <th className="px-[8px] py-[8px] text-left text-[12px] font-bold text-[#344054]">日期</th>
              <th className="px-[8px] py-[8px] text-left text-[12px] font-bold text-[#344054]">經手人</th>
              <th className="px-[8px] py-[8px] text-left text-[12px] font-bold text-[#344054]">狀態</th>
            </tr>
          </thead>
          <tbody>
            {records.map(row => (
              <tr
                key={row.id}
                onClick={() => toggleSelect(row.id)}
                className={`border-b border-[#d8dee6] last:border-0 text-[13px] cursor-pointer hover:bg-[#f1f5f8] transition-colors ${selected.has(row.id) ? "bg-[#eef4ff]" : ""}`}
              >
                <td className="px-[8px] py-[8px] text-center">
                  {selected.has(row.id) ? (
                    <CheckSquare size={16} className="text-[#23675f] mx-auto" />
                  ) : (
                    <Square size={16} className="text-[#d8dee6] mx-auto" />
                  )}
                </td>
                <td className="px-[8px] py-[8px] text-[#1d2939] font-bold">{row.project}</td>
                <td className="px-[8px] py-[8px] text-[#1d2939]">HK$ {row.amount.toLocaleString()}</td>
                <td className="px-[8px] py-[8px] text-[#667085]">{row.date}</td>
                <td className="px-[8px] py-[8px] text-[#667085]">{row.handler}</td>
                <td className="px-[8px] py-[8px]">
                  <Pill label={row.status === "confirmed" ? "已入賬" : "待入賬"} tone={row.status === "confirmed" ? "good" : "warning"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 生成的標籤 */}
      {showLabels && labels.length > 0 && (
        <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={SH}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-bold text-[#1d2939]">
              <Mail size={16} className="inline mr-2" />
              已生成 {labels.length} 個地址標籤
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => navigator.clipboard.writeText(labels.join("\n\n---\n\n"))} className="px-3 py-1.5 text-sm border border-[#d8dee6] rounded font-bold text-[#667085] hover:text-[#1d2939]">
                複製全部
              </button>
              <button onClick={handlePrint} className="px-4 py-1.5 text-sm text-white rounded font-bold flex items-center gap-1" style={{ background: B }}>
                <Printer size={14} /> 打印標籤
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {labels.map((label, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-[#d8dee6]" style={{ background: "#f8fafc" }}>
                <span className="text-xs font-bold text-[#667085] w-6 text-right shrink-0">{i + 1}.</span>
                <pre className="text-sm text-[#1d2939] font-mono whitespace-pre-wrap flex-1">{label}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
