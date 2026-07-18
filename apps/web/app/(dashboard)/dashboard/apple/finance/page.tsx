"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, DollarSign, Clock, CheckCircle, FileText, Plus, Search, Upload } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatsCard from "@/components/ui/StatsCard";
import DataTable, { type Column } from "@/components/ui/DataTable";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge";
import FilterBar from "@/components/ui/FilterBar";
import UploadReceiptDialog from "@/components/modules/apple/UploadReceiptDialog";

/* ================================================================
   參考 wendy-substitute.html 樣式
   - 品牌色: #23675f / 深: #174f49
   - 面板: #fff + border #d8dee6 + 陰影
   - 文字: #1d2939 / 次要: #667085
   ================================================================ */
const B = "#23675f"; const B2 = "#174f49"; const BG = "#f6f7f9";
const BD = "#d8dee6"; const TX = "#1d2939"; const MU = "#667085";
const SH = "0 10px 30px rgba(16,24,40,0.08)";

type TabKey = "income" | "expense" | "quotations";

interface IncomeRecord {
  id: number; date: string; project: string; amount: number;
  paymentMethod: string; handler: string; status: string;
}
interface ExpenseRecord {
  id: number; invoiceNo: string; supplier: string; project: string;
  amount: number; approver: string; status: string;
}
interface QuotationRecord {
  id: number; projectName: string; vendor: string; amount: number;
  isLowest: boolean; isSelected: boolean; remark: string;
}

// ─── Mock ───
const MOCK_INCOME: IncomeRecord[] = [
  { id:1, date:"2026-07-15", project:"中六畢業禮活動經費", amount:1500, paymentMethod:"現金", handler:"陳大明", status:"confirmed" },
  { id:2, date:"2026-07-14", project:"春季運動會贊助款", amount:5000, paymentMethod:"銀行轉賬", handler:"李小華", status:"confirmed" },
  { id:3, date:"2026-07-12", project:"家長會捐款", amount:3200, paymentMethod:"支票", handler:"王美玲", status:"pending" },
  { id:4, date:"2026-07-10", project:"校慶活動贊助", amount:8000, paymentMethod:"銀行轉賬", handler:"陳大明", status:"confirmed" },
  { id:5, date:"2026-07-08", project:"圖書館捐贈", amount:2000, paymentMethod:"現金", handler:"張偉強", status:"pending" },
  { id:6, date:"2026-07-05", project:"課後輔導班收費", amount:4500, paymentMethod:"支票", handler:"李小華", status:"confirmed" },
  { id:7, date:"2026-07-03", project:"學雜費補繳", amount:1200, paymentMethod:"現金", handler:"王美玲", status:"confirmed" },
  { id:8, date:"2026-07-01", project:"校園開放日贊助", amount:6000, paymentMethod:"銀行轉賬", handler:"陳大明", status:"pending" },
];

const MOCK_EXPENSE: ExpenseRecord[] = [
  { id:1, invoiceNo:"INV-2026-0715", supplier:"永發文具公司", project:"辦公用品採購", amount:2350, approver:"李校長", status:"approved" },
  { id:2, invoiceNo:"INV-2026-0714", supplier:"中華印刷廠", project:"獎狀印刷費", amount:1800, approver:"陳主任", status:"approved" },
  { id:3, invoiceNo:"INV-2026-0712", supplier:"新光電器有限公司", project:"教室空調維修", amount:4200, approver:"李校長", status:"pending" },
  { id:4, invoiceNo:"INV-2026-0710", supplier:"美味樂餐飲公司", project:"運動會午餐供應", amount:6500, approver:"陳主任", status:"approved" },
  { id:5, invoiceNo:"INV-2026-0708", supplier:"永發文具公司", project:"筆墨紙張補充", amount:890, approver:"王主任", status:"pending" },
  { id:6, invoiceNo:"INV-2026-0705", supplier:"快捷清潔服務", project:"校園清潔用品", amount:1560, approver:"李校長", status:"approved" },
  { id:7, invoiceNo:"INV-2026-0703", supplier:"天行計算機公司", project:"電腦維修保養", amount:3800, approver:"陳主任", status:"rejected" },
  { id:8, invoiceNo:"INV-2026-0701", supplier:"中華印刷廠", project:"試卷印刷費", amount:2750, approver:"王主任", status:"approved" },
];

const MOCK_QUOTATION: QuotationRecord[] = [
  { id:1, projectName:"校慶紀念品採購", vendor:"精美禮品公司", amount:15000, isLowest:true, isSelected:true, remark:"品質優，交貨快" },
  { id:2, projectName:"校慶紀念品採購", vendor:"佳好工藝品廠", amount:16800, isLowest:false, isSelected:false, remark:"款式較多" },
  { id:3, projectName:"校慶紀念品採購", vendor:"永恒紀念品有限公司", amount:18200, isLowest:false, isSelected:false, remark:"有現貨" },
  { id:4, projectName:"教室空調採購", vendor:"格力電器專賣店", amount:48000, isLowest:true, isSelected:true, remark:"含安裝及3年保養" },
  { id:5, projectName:"教室空調採購", vendor:"美的電器代理", amount:52000, isLowest:false, isSelected:false, remark:"含5年保養" },
  { id:6, projectName:"校園綠化工程", vendor:"綠意園林設計", amount:35000, isLowest:false, isSelected:true, remark:"口碑好、設計方案優" },
  { id:7, projectName:"校園綠化工程", vendor:"春暉園藝公司", amount:28000, isLowest:true, isSelected:false, remark:"價格最低但經驗不足" },
  { id:8, projectName:"圖書館書架定製", vendor:"恒達家具廠", amount:22000, isLowest:true, isSelected:false, remark:"" },
];

const INCOME_STATS = {
  monthlyTotal: MOCK_INCOME.reduce((s,r)=>s+r.amount,0),
  pending: MOCK_INCOME.filter(r=>r.status==="pending").reduce((s,r)=>s+r.amount,0),
  confirmed: MOCK_INCOME.filter(r=>r.status==="confirmed").reduce((s,r)=>s+r.amount,0),
  count: MOCK_INCOME.length,
};

/* ─── Pill ─── */
const Pill = ({ label, tone }: { label: string; tone: "good"|"warning"|"danger"|"info"|"neutral" }) => {
  const map: Record<string, string> = {
    good: "bg-[#ecfdf3] text-[#027a48]",
    warning: "bg-[#fffaeb] text-[#936a00]",
    danger: "bg-[#fef3f2] text-[#b42318]",
    info: "bg-[#eef4ff] text-[#155eef]",
    neutral: "bg-[#f1f5f8] text-[#667085]",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-[7px] py-[3px] text-[11px] font-bold whitespace-nowrap ${map[tone] || map.neutral}`}>
      {label}
    </span>
  );
};

/* ================================================================
   主組件
   ================================================================ */
export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("income");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [incomeData, setIncomeData] = useState<IncomeRecord[]>(MOCK_INCOME);
  const [expenseData] = useState<ExpenseRecord[]>(MOCK_EXPENSE);
  const [quotationData] = useState<QuotationRecord[]>(MOCK_QUOTATION);
  const [ifilters, setIfilters] = useState<Record<string,string>>({});
  const [efilters, setEfilters] = useState<Record<string,string>>({});

  const handleReceipt = (r: { amount:number|null; date:string; payer:string; purpose:string }) => {
    const n: IncomeRecord = {
      id: incomeData.length+1, date: r.date, project: r.purpose,
      amount: r.amount??0, paymentMethod:"現金", handler: r.payer, status:"pending",
    };
    setIncomeData(p=>[n,...p]);
  };

  // ─── 列 ───
  const incomeCols: Column<IncomeRecord>[] = [
    { key:"date", header:"日期" },
    { key:"project", header:"項目" },
    { key:"amount", header:"金額", align:"right", render: r => <span className="font-bold">HK$ {r.amount.toLocaleString()}</span> },
    { key:"paymentMethod", header:"支付方式" },
    { key:"handler", header:"經手人" },
    { key:"status", header:"狀態", render: r => <TaskStatusBadge status={r.status} /> },
    { key:"actions", header:"操作", render: r => (
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/apple/finance/income/${r.id}`} className="text-xs font-bold text-[#23675f] hover:underline">查看詳情</Link>
        {r.status==="pending" && <button onClick={()=>setReceiptOpen(true)} className="inline-flex items-center gap-1 text-xs text-[#667085] hover:text-[#23675f]"><Upload size={12}/>上傳收據</button>}
      </div>
    )},
  ];

  const expenseCols: Column<ExpenseRecord>[] = [
    { key:"invoiceNo", header:"發票號" },
    { key:"supplier", header:"供應商" },
    { key:"project", header:"項目" },
    { key:"amount", header:"金額", align:"right", render: r => <span className="font-bold">HK$ {r.amount.toLocaleString()}</span> },
    { key:"approver", header:"審批人" },
    { key:"status", header:"狀態", render: r => <TaskStatusBadge status={r.status} /> },
    { key:"actions", header:"操作", render: r => (
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/apple/finance/expense/${r.id}`} className="text-xs font-bold text-[#23675f] hover:underline">查看詳情</Link>
        {r.status==="pending" && <button className="inline-flex items-center gap-1 text-xs text-[#667085] hover:text-[#23675f]"><Upload size={12}/>上傳發票</button>}
      </div>
    )},
  ];

  // ─── 篩選 ───
  const filteredIncome = incomeData.filter(r => {
    if (ifilters.status && r.status!==ifilters.status) return false;
    if (ifilters.project && !r.project.includes(ifilters.project)) return false;
    return true;
  });
  const filteredExpense = expenseData.filter(r => {
    if (efilters.status && r.status!==efilters.status) return false;
    if (efilters.supplier && !r.supplier.includes(efilters.supplier)) return false;
    return true;
  });

  const qRowClass = (row: QuotationRecord, all: QuotationRecord[]) => {
    const same = all.filter(r=>r.projectName===row.projectName);
    if (same.length===1) return "bg-[#fffaeb]";
    if (row.isLowest && !row.isSelected) return "bg-[#fef3f2]";
    return "";
  };

  /* ============================================================ */
  return (
    <div style={{background:BG}} className="space-y-4">
      <PageHeader
        title="財務收支"
        subtitle="收支記錄管理、票據 OCR 識別、分類統計"
        actions={
          <button style={{background:B, borderColor:B}}
            className="flex items-center gap-1.5 px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90"
            onClick={() => activeTab==="income" && setReceiptOpen(true)}>
            <Plus size={16}/> {activeTab==="income"?"新增收入":activeTab==="expense"?"新增支出":"新增報價單"}
          </button>
        }
      />

      {/* Tab */}
      <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-[#d8dee6]" style={{boxShadow:SH}}>
        {([
          {k:"income" as TabKey, label:"收入", n:MOCK_INCOME.length},
          {k:"expense" as TabKey, label:"支出", n:MOCK_EXPENSE.length},
          {k:"quotations" as TabKey, label:"報價單", n:MOCK_QUOTATION.length},
        ]).map(t=>(
          <button key={t.k} onClick={()=>setActiveTab(t.k)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg font-bold transition-colors ${
              activeTab===t.k ? "text-white shadow-sm" : "text-[#667085] hover:bg-[#f1f5f8]"
            }`}
            style={activeTab===t.k ? {background:B} : {}}>
            {t.label}
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs rounded-full font-bold ${
              activeTab===t.k ? "bg-white/20 text-white" : "bg-[#f1f5f8] text-[#667085]"
            }`}>{t.n}</span>
          </button>
        ))}
      </div>

      {/* ═══════ 收入 ═══════ */}
      {activeTab==="income" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="本月收入" value={`HK$ ${INCOME_STATS.monthlyTotal.toLocaleString()}`} icon={DollarSign} trend="12.5%" trendUp color="text-[#23675f]" />
            <StatsCard label="待入賬" value={`HK$ ${INCOME_STATS.pending.toLocaleString()}`} icon={Clock} color="text-[#936a00]" />
            <StatsCard label="已入賬" value={`HK$ ${INCOME_STATS.confirmed.toLocaleString()}`} icon={CheckCircle} color="text-[#027a48]" />
            <StatsCard label="單據數" value={INCOME_STATS.count} icon={FileText} color="text-[#155eef]" />
          </div>

          <FilterBar fields={[
            {key:"status",label:"狀態",type:"select",options:[{label:"已入賬",value:"confirmed"},{label:"待入賬",value:"pending"}]},
            {key:"project",label:"項目",type:"text",placeholder:"項目名"},
          ]} values={ifilters} onChange={(k,v)=>setIfilters(p=>({...p,[k]:v}))} onReset={()=>setIfilters({})} onSearch={()=>{}} />

          <DataTable columns={incomeCols} data={filteredIncome} total={filteredIncome.length} page={1} pageSize={20} emptyText="暫無收入記錄" />
        </div>
      )}

      {/* ═══════ 支出 ═══════ */}
      {activeTab==="expense" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="本月支出" value={`HK$ ${MOCK_EXPENSE.reduce((s,r)=>s+r.amount,0).toLocaleString()}`} icon={DollarSign} trend="8.3%" color="text-[#23675f]" />
            <StatsCard label="待審批" value={MOCK_EXPENSE.filter(r=>r.status==="pending").length} icon={Clock} color="text-[#936a00]" />
            <StatsCard label="已審批" value={MOCK_EXPENSE.filter(r=>r.status==="approved").length} icon={CheckCircle} color="text-[#027a48]" />
            <StatsCard label="單據數" value={MOCK_EXPENSE.length} icon={FileText} color="text-[#155eef]" />
          </div>

          <FilterBar fields={[
            {key:"status",label:"狀態",type:"select",options:[{label:"已通過",value:"approved"},{label:"待審批",value:"pending"},{label:"已拒絕",value:"rejected"}]},
            {key:"supplier",label:"供應商",type:"text",placeholder:"供應商名"},
          ]} values={efilters} onChange={(k,v)=>setEfilters(p=>({...p,[k]:v}))} onReset={()=>setEfilters({})} onSearch={()=>{}} />

          <DataTable columns={expenseCols} data={filteredExpense} total={filteredExpense.length} page={1} pageSize={20} emptyText="暫無支出記錄" />
        </div>
      )}

      {/* ═══════ 報價單 ═══════ */}
      {activeTab==="quotations" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg border text-sm" style={{background:"#eef4ff", borderColor:"#bfdbfe", color:"#155eef"}}>
            <Search size={16} className="mt-0.5 shrink-0"/>
            <div>
              <p className="font-bold">自動分析說明</p>
              <ul className="mt-1 space-y-0.5 text-xs opacity-80">
                <li>🟡 <strong>黃色高亮</strong>：該項目僅有一家報價，建議增加比價</li>
                <li>🔴 <strong>紅色高亮</strong>：未採納最低報價，需在備註中說明原因</li>
              </ul>
            </div>
          </div>

          {(()=>{
            const groups = new Map<string,QuotationRecord[]>();
            quotationData.forEach(q=>{ const e=groups.get(q.projectName)||[]; e.push(q); groups.set(q.projectName,e); });
            return Array.from(groups.entries()).map(([pn, items])=>{
              const single = items.length===1;
              const nonLow = items.some(q=>!q.isLowest&&q.isSelected);
              return (
                <div key={pn} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-[#1d2939]">{pn}</h3>
                    {single && <Pill label="單一報價" tone="warning"/>}
                    {nonLow && <Pill label="未採納最低報價" tone="danger"/>}
                  </div>

                  <div className="bg-white rounded-lg border border-[#d8dee6] overflow-hidden" style={{boxShadow:SH}}>
                    <table className="w-full border-collapse table-fixed">
                      <thead>
                        <tr className="border-b border-[#d8dee6] bg-[#f8fafc]">
                          {["項目名","報價單位","報價金額","是否最低","備註"].map(h=>(
                            <th key={h} className="px-[8px] py-[8px] text-left text-[12px] font-bold text-[#344054]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(row=>(
                          <tr key={row.id} className={`border-b border-[#d8dee6] last:border-0 text-[13px] ${qRowClass(row, quotationData)}`}>
                            <td className="px-[8px] py-[8px] text-[#1d2939]">{row.projectName}</td>
                            <td className="px-[8px] py-[8px] text-[#1d2939]">{row.vendor}</td>
                            <td className="px-[8px] py-[8px] text-right font-bold text-[#1d2939]">HK$ {row.amount.toLocaleString()}</td>
                            <td className="px-[8px] py-[8px]">{row.isLowest ? <Pill label="最低價" tone="good"/> : <span className="text-xs text-[#667085]">—</span>}</td>
                            <td className="px-[8px] py-[8px] text-[#667085] text-[13px]">{row.remark||"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      <UploadReceiptDialog open={receiptOpen} onClose={()=>setReceiptOpen(false)} onConfirm={handleReceipt} />
    </div>
  );
}
