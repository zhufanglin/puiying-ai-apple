"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, DollarSign, Clock, CheckCircle, FileText, Plus, Search, Upload, Mail } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatsCard from "@/components/ui/StatsCard";
import DataTable, { type Column } from "@/components/ui/DataTable";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge";
import FilterBar from "@/components/ui/FilterBar";
import UploadReceiptDialog from "@/components/modules/apple/UploadReceiptDialog";
import ExpenseCreateDialog from "@/components/modules/apple/ExpenseCreateDialog";
import QuotationCreateDialog from "@/components/modules/apple/QuotationCreateDialog";
import { api } from "@/lib/api";

/* ================================================================
   參考 wendy-substitute.html 樣式
   - 品牌色: #23675f / 深: #174f49
   - 面板: #fff + border #d8dee6 + 陰影
   - 文字: #1d2939 / 次要: #667085
   ================================================================ */
const B = "#23675f"; const B2 = "#174f49"; const BG = "#f6f7f9";
const BD = "#d8dee6"; const TX = "#1d2939"; const MU = "#667085";
const SH = "0 10px 30px rgba(16,24,40,0.08)";
const TABLE_PAGE_SIZE = 20;

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
  { id:3, projectName:"校慶紀念品採購", vendor:"永恆紀念品有限公司", amount:18200, isLowest:false, isSelected:false, remark:"有現貨" },
  { id:4, projectName:"教室空調採購", vendor:"格力電器專賣店", amount:48000, isLowest:true, isSelected:true, remark:"含安裝及3年保養" },
  { id:5, projectName:"教室空調採購", vendor:"美的電器代理", amount:52000, isLowest:false, isSelected:false, remark:"含5年保養" },
  { id:6, projectName:"校園綠化工程", vendor:"綠意園林設計", amount:35000, isLowest:false, isSelected:true, remark:"口碑好、設計方案優" },
  { id:7, projectName:"校園綠化工程", vendor:"春暉園藝公司", amount:28000, isLowest:true, isSelected:false, remark:"價格最低但經驗不足" },
  { id:8, projectName:"圖書館書架定製", vendor:"恆達傢俱廠", amount:22000, isLowest:true, isSelected:false, remark:"" },
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
  const router = useRouter();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [incomeData, setIncomeData] = useState<IncomeRecord[]>([]);
  const [expenseData, setExpenseData] = useState<ExpenseRecord[]>([]);
  const [quotationData, setQuotationData] = useState<QuotationRecord[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [ifilters, setIfilters] = useState<Record<string,string>>({});
  const [efilters, setEfilters] = useState<Record<string,string>>({});
  const [incomePage, setIncomePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);

  // 從 API 加載收入/支出
  const mapInc = (items: any[]): IncomeRecord[] => items.map((r: any) => ({
    id: r.id, date: r.date?.slice(0,10)??"", project: r.project??r.name??"",
    amount: Number(r.amount)||0, paymentMethod: r.payment_method??"現金",
    handler: r.handler??"-", status: r.status??"pending",
  }));
  const mapExp = (items: any[]): ExpenseRecord[] => items.map((r: any) => ({
    id: r.id, invoiceNo: r.invoice_no??"-", supplier: r.supplier??r.project??"-",
    project: r.project??r.name??"-", amount: Number(r.amount)||0,
    approver: r.approver??r.handler??"-", status: r.status??"pending",
  }));

  const loadFromAPI = async () => {
    try {
      const [incRes, expRes] = await Promise.all([
        api.get<{items:any[]}>("/apple/finance/income"),
        api.get<{items:any[]}>("/apple/finance/expense"),
      ]);
      if (incRes.data?.items) setIncomeData(mapInc(incRes.data.items));
      if (expRes.data?.items) setExpenseData(mapExp(expRes.data.items));
      const qRes = await api.get<{items:any[]}>("/apple/finance/quotations").catch(() => ({} as any));
      if (qRes.data?.items) setQuotationData(qRes.data.items.map((r:any) => ({
        id: r.id, projectName: r.project_name??r.projectName??r.project??"",
        vendor: r.vendor??"", amount: r.amount??0,
        isLowest: r.is_lowest??r.isLowest??false, isSelected: r.is_selected??r.isSelected??false,
        remark: r.remark??"",
      })));
    } catch {
      // Mock 兜底：API 不可用时使用内置演示数据
      if (!incomeData.length) setIncomeData(MOCK_INCOME);
      if (!expenseData.length) setExpenseData(MOCK_EXPENSE);
      if (!quotationData.length) setQuotationData(MOCK_QUOTATION);
    } finally {
      setDataReady(true);
    }
  };
  useEffect(() => { loadFromAPI(); }, []);

  const handleReceipt = async (r: { amount:number|null; date:string; payer:string; purpose:string; fileId?:number }) => {
    if (r.amount == null || r.amount <= 0) {
      alert("金額無效，請先填寫金額");
      return;
    }
    try {
      const payload = {
        type: "income",
        date: r.date || new Date().toISOString().slice(0, 10),
        project: r.purpose || "收據收入",
        amount: r.amount,
        payment_method: "現金",
        handler: r.payer || "經手人",
        file_id: r.fileId,
      };
      const res = await api.post<any>("/apple/finance/income", payload);
      if (res.code !== 0) throw new Error("寫入失敗：" + res.message);
      const created = res.data ? mapInc([res.data])[0] : null;
      if (created) {
        setIncomeData((previous) => [created, ...previous.filter((item) => item.id !== created.id)]);
      }
      setActiveTab("income");
      setIfilters({});
      setIncomePage(1);
      setDataReady(true);
    } catch {
      // API 不可用，本地追加
      const n: IncomeRecord = {
        id: incomeData.length + 1, date: r.date || new Date().toISOString().slice(0, 10), project: r.purpose || "收據收入",
        amount: r.amount ?? 0, paymentMethod:"現金", handler: r.payer || "經手人", status:"pending",
      };
      setActiveTab("income");
      setIfilters({});
      setIncomePage(1);
      setDataReady(true);
      setIncomeData(p=>[n,...p]);
    }
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
  const pagedIncome = filteredIncome.slice((incomePage - 1) * TABLE_PAGE_SIZE, incomePage * TABLE_PAGE_SIZE);
  const pagedExpense = filteredExpense.slice((expensePage - 1) * TABLE_PAGE_SIZE, expensePage * TABLE_PAGE_SIZE);

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
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-4 py-[8px] text-sm border border-[#d8dee6] rounded-lg font-bold text-[#1d2939] hover:bg-[#f1f5f8]"
              onClick={()=>router.push("/dashboard/apple/finance/address-labels")}>
              <Mail size={14}/> 地址標籤
            </button>
            <button style={{background:B, borderColor:B}}
              className="flex items-center gap-1.5 px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90"
              onClick={() => activeTab==="income" ? setReceiptOpen(true) : activeTab==="expense" ? setExpenseOpen(true) : setQuotationOpen(true)}>
              <Plus size={16}/> {activeTab==="income"?"新增收入":activeTab==="expense"?"新增支出":"新增報價單"}
            </button>
          </div>
        }
      />

      {/* Tab */}
      <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-[#d8dee6]" style={{boxShadow:SH}}>
        {([
          {k:"income" as TabKey, label:"收入", n: dataReady ? incomeData.length : "—"},
          {k:"expense" as TabKey, label:"支出", n: dataReady ? expenseData.length : "—"},
          {k:"quotations" as TabKey, label:"報價單", n: dataReady ? quotationData.length : "—"},
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
            <StatsCard label="本月收入" value={`HK$ ${incomeData.reduce((s,r)=>s+r.amount,0).toLocaleString()}`} icon={DollarSign} trend="12.5%" trendUp color="text-[#23675f]" />
            <StatsCard label="待入賬" value={`HK$ ${incomeData.filter(r=>r.status==="pending").reduce((s,r)=>s+r.amount,0).toLocaleString()}`} icon={Clock} color="text-[#936a00]" />
            <StatsCard label="已入賬" value={`HK$ ${incomeData.filter(r=>r.status==="confirmed").reduce((s,r)=>s+r.amount,0).toLocaleString()}`} icon={CheckCircle} color="text-[#027a48]" />
            <StatsCard label="單據數" value={incomeData.length} icon={FileText} color="text-[#155eef]" />
          </div>

          <FilterBar fields={[
            {key:"status",label:"狀態",type:"select",options:[{label:"已入賬",value:"confirmed"},{label:"待入賬",value:"pending"}]},
            {key:"project",label:"項目",type:"text",placeholder:"項目名"},
          ]} values={ifilters} onChange={(k,v)=>{setIncomePage(1);setIfilters(p=>({...p,[k]:v}));}} onReset={()=>{setIncomePage(1);setIfilters({});}} onSearch={()=>{}} />

          <DataTable columns={incomeCols} data={pagedIncome} total={filteredIncome.length} page={incomePage} pageSize={TABLE_PAGE_SIZE} onPageChange={setIncomePage} emptyText="暫無收入記錄" />
        </div>
      )}

      {/* ═══════ 支出 ═══════ */}
      {activeTab==="expense" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="本月支出" value={`HK$ ${expenseData.reduce((s,r)=>s+r.amount,0).toLocaleString()}`} icon={DollarSign} trend="8.3%" color="text-[#23675f]" />
            <StatsCard label="待審批" value={expenseData.filter(r=>r.status==="pending").length} icon={Clock} color="text-[#936a00]" />
            <StatsCard label="已審批" value={expenseData.filter(r=>r.status==="approved").length} icon={CheckCircle} color="text-[#027a48]" />
            <StatsCard label="單據數" value={expenseData.length} icon={FileText} color="text-[#155eef]" />
          </div>

          <FilterBar fields={[
            {key:"status",label:"狀態",type:"select",options:[{label:"已通過",value:"approved"},{label:"待審批",value:"pending"},{label:"已拒絕",value:"rejected"}]},
            {key:"supplier",label:"供應商",type:"text",placeholder:"供應商名"},
          ]} values={efilters} onChange={(k,v)=>{setExpensePage(1);setEfilters(p=>({...p,[k]:v}));}} onReset={()=>{setExpensePage(1);setEfilters({});}} onSearch={()=>{}} />

          <DataTable columns={expenseCols} data={pagedExpense} total={filteredExpense.length} page={expensePage} pageSize={TABLE_PAGE_SIZE} onPageChange={setExpensePage} emptyText="暫無支出記錄" />
        </div>
      )}

      {/* ═══════ 報價單 ═══════ */}
      {activeTab==="quotations" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg border text-sm" style={{background:"#eef4ff", borderColor:"#bfdbfe", color:"#155eef"}}>
            <Search size={16} className="mt-0.5 shrink-0"/>
            <div>
              <p className="font-bold">自動分析説明</p>
              <ul className="mt-1 space-y-0.5 text-xs opacity-80">
                <li>🟡 <strong>黃色高亮</strong>：該項目僅有一家報價，建議增加比價</li>
                <li>🔴 <strong>紅色高亮</strong>：未採納最低報價，需在備註中説明原因</li>
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
                      <colgroup>
                        <col style={{width:"24%"}}/>
                        <col style={{width:"22%"}}/>
                        <col style={{width:"18%"}}/>
                        <col style={{width:"14%"}}/>
                        <col style={{width:"22%"}}/>
                      </colgroup>
                      <thead>
                        <tr className="border-b border-[#d8dee6] bg-[#f8fafc]">
                          {["項目名","報價單位","報價金額","是否最低","備註"].map(h=>(
                            <th key={h} className="px-[8px] py-[8px] text-left text-[12px] font-bold text-[#344054]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(row=>(
                          <tr key={row.id} onClick={()=>router.push(`/dashboard/apple/finance/quotations/${row.id}`)}
                            className={`border-b border-[#d8dee6] last:border-0 text-[13px] cursor-pointer hover:bg-[#f1f5f8] transition-colors ${qRowClass(row, quotationData)}`}>
                            <td className="px-[8px] py-[8px] text-[#1d2939] underline">{row.projectName}</td>
                            <td className="px-[8px] py-[8px] text-[#1d2939]">{row.vendor}</td>
                            <td className="px-[8px] py-[8px] font-bold text-[#1d2939]">HK$ {row.amount.toLocaleString()}</td>
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
      <ExpenseCreateDialog open={expenseOpen} onClose={()=>setExpenseOpen(false)} onSuccess={()=>loadFromAPI()} />
      <QuotationCreateDialog open={quotationOpen} onClose={()=>setQuotationOpen(false)} onSuccess={()=>{setQuotationOpen(false);loadFromAPI();}} />
    </div>
  );
}
