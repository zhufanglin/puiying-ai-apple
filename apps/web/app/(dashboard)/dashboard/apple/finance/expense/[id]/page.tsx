"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, User, Calendar, DollarSign, Building2 } from "lucide-react";

const B = "#23675f"; const BG = "#f6f7f9"; const BD = "#d8dee6"; const MU = "#667085";

const MOCK_EXPENSE = [
  { id:1, invoiceNo:"INV-2026-0715", supplier:"永發文具公司", project:"辦公用品採購", amount:2350, approver:"李校長", status:"approved" },
  { id:2, invoiceNo:"INV-2026-0714", supplier:"中華印刷廠", project:"獎狀印刷費", amount:1800, approver:"陳主任", status:"approved" },
  { id:3, invoiceNo:"INV-2026-0712", supplier:"新光電器有限公司", project:"教室空調維修", amount:4200, approver:"李校長", status:"pending" },
  { id:4, invoiceNo:"INV-2026-0710", supplier:"美味樂餐飲公司", project:"運動會午餐供應", amount:6500, approver:"陳主任", status:"approved" },
  { id:5, invoiceNo:"INV-2026-0708", supplier:"永發文具公司", project:"筆墨紙張補充", amount:890, approver:"王主任", status:"pending" },
  { id:6, invoiceNo:"INV-2026-0705", supplier:"快捷清潔服務", project:"校園清潔用品", amount:1560, approver:"李校長", status:"approved" },
  { id:7, invoiceNo:"INV-2026-0703", supplier:"天行計算機公司", project:"電腦維修保養", amount:3800, approver:"陳主任", status:"rejected" },
  { id:8, invoiceNo:"INV-2026-0701", supplier:"中華印刷廠", project:"試卷印刷費", amount:2750, approver:"王主任", status:"approved" },
];

const Pill = ({ label, tone }: { label: string; tone: string }) => {
  const map: Record<string, string> = {
    good: "bg-[#ecfdf3] text-[#027a48]",
    warning: "bg-[#fffaeb] text-[#936a00]",
    danger: "bg-[#fef3f2] text-[#b42318]",
    neutral: "bg-[#f1f5f8] text-[#667085]",
  };
  return <span className={`inline-flex items-center rounded-full px-[7px] py-[3px] text-[11px] font-bold whitespace-nowrap ${map[tone]||map.neutral}`}>{label}</span>;
};

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);
  const record = MOCK_EXPENSE.find(r => r.id === id);

  if (!record) {
    return (
      <div style={{background:BG}} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#667085] text-lg mb-4">找不到此記錄</p>
          <button onClick={()=>router.back()} className="px-4 py-2 text-sm text-white rounded-lg font-bold" style={{background:B}}>返回列表</button>
        </div>
      </div>
    );
  }

  const statusTone = record.status==="approved"?"good":record.status==="rejected"?"danger":"warning";
  const statusLabel = record.status==="approved"?"已通過":record.status==="rejected"?"已拒絕":"待審批";

  return (
    <div style={{background:BG}} className="space-y-4">
      <button onClick={()=>router.back()} className="flex items-center gap-1 text-sm font-bold text-[#667085] hover:text-[#1d2939]">
        <ArrowLeft size={16}/> 返回支出列表
      </button>

      <div className="bg-white rounded-lg border border-[#d8dee6] p-6" style={{boxShadow:"0 10px 30px rgba(16,24,40,0.08)"}}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1d2939]">{record.project}</h2>
            <p className="text-sm text-[#667085] mt-1">支出記錄 #{record.id} · 發票號：{record.invoiceNo}</p>
          </div>
          <Pill label={statusLabel} tone={statusTone}/>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={{boxShadow:"0 10px 30px rgba(16,24,40,0.08)"}}>
          <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">基本信息</h3>
          <div className="space-y-3">
            {[
              { icon:FileText, label:"發票號", value:record.invoiceNo },
              { icon:DollarSign, label:"金額", value:`HK$ ${record.amount.toLocaleString()}` },
              { icon:Building2, label:"供應商", value:record.supplier },
              { icon:User, label:"審批人", value:record.approver },
            ].map((item,i)=>(
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#d8dee6] last:border-0">
                <item.icon size={16} className="text-[#667085] shrink-0"/>
                <span className="text-sm text-[#667085] w-20">{item.label}</span>
                <span className="text-sm font-bold text-[#1d2939]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={{boxShadow:"0 10px 30px rgba(16,24,40,0.08)"}}>
          <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">相關發票</h3>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText size={40} className="text-[#d8dee6] mb-3"/>
            <p className="text-sm text-[#667085]">暫無上傳發票</p>
            <button className="mt-3 px-4 py-2 text-sm text-white rounded-lg font-bold" style={{background:B}}>上傳發票</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={{boxShadow:"0 10px 30px rgba(16,24,40,0.08)"}}>
        <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">審計記錄</h3>
        <div className="space-y-0">
          {[
            { action:"提交支出申請", operator:"系統", time:`${record.invoiceNo.slice(-4)} 10:30`, detail:`提交 "${record.project}" 支出申請` },
            { action:record.status==="approved"?"審批通過":record.status==="rejected"?"審批拒絕":"等待審批", operator:record.approver, time:`${record.invoiceNo.slice(-4)} 14:20`, detail:record.status==="approved"?"已批准此支出":record.status==="rejected"?"不符合預算要求":"" },
          ].map((entry,i,arr)=>(
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full mt-1.5" style={{background:B}}/>
                {i<arr.length-1 && <div className="w-0.5 flex-1 bg-[#d8dee6] mt-1"/>}
              </div>
              <div className={`pb-4 ${i===arr.length-1?"":""}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1d2939]">{entry.action}</span>
                  <span className="text-xs text-[#667085]">— {entry.operator}</span>
                </div>
                {entry.detail && <p className="text-xs text-[#667085] mt-0.5">{entry.detail}</p>}
                <p className="text-xs text-[#667085] mt-1">{entry.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
