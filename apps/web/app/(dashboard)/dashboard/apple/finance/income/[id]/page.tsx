"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, Clock, User, Calendar, DollarSign } from "lucide-react";

const B = "#23675f"; const BG = "#f6f7f9"; const BD = "#d8dee6"; const MU = "#667085";

// 與 finance 頁面共享的 mock 數據
const MOCK_INCOME = [
  { id:1, date:"2026-07-15", project:"中六畢業禮活動經費", amount:1500, paymentMethod:"現金", handler:"陳大明", status:"confirmed" },
  { id:2, date:"2026-07-14", project:"春季運動會贊助款", amount:5000, paymentMethod:"銀行轉賬", handler:"李小華", status:"confirmed" },
  { id:3, date:"2026-07-12", project:"家長會捐款", amount:3200, paymentMethod:"支票", handler:"王美玲", status:"pending" },
  { id:4, date:"2026-07-10", project:"校慶活動贊助", amount:8000, paymentMethod:"銀行轉賬", handler:"陳大明", status:"confirmed" },
  { id:5, date:"2026-07-08", project:"圖書館捐贈", amount:2000, paymentMethod:"現金", handler:"張偉強", status:"pending" },
  { id:6, date:"2026-07-05", project:"課後輔導班收費", amount:4500, paymentMethod:"支票", handler:"李小華", status:"confirmed" },
  { id:7, date:"2026-07-03", project:"學雜費補繳", amount:1200, paymentMethod:"現金", handler:"王美玲", status:"confirmed" },
  { id:8, date:"2026-07-01", project:"校園開放日贊助", amount:6000, paymentMethod:"銀行轉賬", handler:"陳大明", status:"pending" },
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

export default function IncomeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);
  const record = MOCK_INCOME.find(r => r.id === id);

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

  const statusTone = record.status==="confirmed"?"good":"warning";
  const statusLabel = record.status==="confirmed"?"已入賬":"待入賬";

  return (
    <div style={{background:BG}} className="space-y-4">
      {/* 返回 */}
      <button onClick={()=>router.back()} className="flex items-center gap-1 text-sm font-bold text-[#667085] hover:text-[#1d2939]">
        <ArrowLeft size={16}/> 返回收入列表
      </button>

      {/* 標題 */}
      <div className="bg-white rounded-lg border border-[#d8dee6] p-6" style={{boxShadow:"0 10px 30px rgba(16,24,40,0.08)"}}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1d2939]">{record.project}</h2>
            <p className="text-sm text-[#667085] mt-1">收入記錄 #{record.id}</p>
          </div>
          <Pill label={statusLabel} tone={statusTone}/>
        </div>
      </div>

      {/* 詳細信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={{boxShadow:"0 10px 30px rgba(16,24,40,0.08)"}}>
          <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">基本信息</h3>
          <div className="space-y-3">
            {[
              { icon:Calendar, label:"日期", value:record.date },
              { icon:DollarSign, label:"金額", value:`HK$ ${record.amount.toLocaleString()}` },
              { icon:TrendingUp, label:"支付方式", value:record.paymentMethod },
              { icon:User, label:"經手人", value:record.handler },
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
          <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">相關單據</h3>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock size={40} className="text-[#d8dee6] mb-3"/>
            <p className="text-sm text-[#667085]">暫無上傳收據</p>
            <button className="mt-3 px-4 py-2 text-sm text-white rounded-lg font-bold" style={{background:B}}>上傳收據</button>
          </div>
        </div>
      </div>

      {/* 審計記錄 */}
      <div className="bg-white rounded-lg border border-[#d8dee6] p-5" style={{boxShadow:"0 10px 30px rgba(16,24,40,0.08)"}}>
        <h3 className="text-[16px] font-bold text-[#1d2939] mb-4">審計記錄</h3>
        <div className="space-y-0">
          {[
            { action:"創建記錄", operator:record.handler, time:`${record.date} 09:15`, detail:"提交收入記錄" },
            { action:record.status==="confirmed"?"確認入賬":"待處理", operator:"系統", time:`${record.date} 09:16`, detail:record.status==="confirmed"?"自動匹配銀行入賬記錄":"等待確認收款" },
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
