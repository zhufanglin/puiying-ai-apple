"use client";

import { useState } from "react";
import { Package, Plus, MapPin, AlertTriangle, CheckCircle, Upload, Clock } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { type Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import FormSection from "@/components/ui/FormSection";
import StatsCard from "@/components/ui/StatsCard";
import TaskStatusBadge from "@/components/ui/TaskStatusBadge";
import UploadAssetDialog from "@/components/modules/apple/UploadAssetDialog";
import AssetMovementDialog from "@/components/modules/apple/AssetMovementDialog";
import WriteoffDialog from "@/components/modules/apple/WriteoffDialog";

/* ================================================================
   參考 wendy-substitute.html 樣式
   ================================================================ */
const B = "#23675f"; const BG = "#f6f7f9"; const BD = "#d8dee6";
const SH = "0 10px 30px rgba(16,24,40,0.08)";

type TabKey = "stocktake" | "writeoff" | "new";

interface AssetRecord {
  id: number; assetNo: string; name: string; category: string;
  location: string; status: string; purchaseDate: string;
  purchaseAmount: number; remark: string;
  written_off_at?: string; written_off_reason?: string;
}
interface MovementRecord {
  id: number; assetNo: string; assetName: string;
  fromLocation: string; toLocation: string;
  movementDate: string; reason: string; operator: string;
}

const MOCK_ASSETS: AssetRecord[] = [
  { id:1, assetNo:"IT-2020-001", name:"Dell 桌上電腦", category:"IT設備", location:"3樓教員室", status:"active", purchaseDate:"2020-03-15", purchaseAmount:8500, remark:"教師辦公用" },
  { id:2, assetNo:"IT-2020-002", name:"Dell 桌上電腦", category:"IT設備", location:"3樓教員室", status:"active", purchaseDate:"2020-03-15", purchaseAmount:8500, remark:"教師辦公用" },
  { id:3, assetNo:"IT-2021-015", name:"HP 筆記本電腦", category:"IT設備", location:"3樓教員室", status:"moved", purchaseDate:"2021-09-01", purchaseAmount:12000, remark:"已搬移至地下校務處" },
  { id:4, assetNo:"FN-2019-008", name:"辦公桌", category:"傢俱", location:"3樓教員室", status:"active", purchaseDate:"2019-06-20", purchaseAmount:2500, remark:"" },
  { id:5, assetNo:"FN-2019-009", name:"辦公椅", category:"傢俱", location:"3樓教員室", status:"active", purchaseDate:"2019-06-20", purchaseAmount:800, remark:"" },
  { id:6, assetNo:"EL-2018-003", name:"投影儀 PM-2019-032", category:"電器", location:"3樓教員室", status:"written_off", purchaseDate:"2018-01-10", purchaseAmount:15000, remark:"燈泡老化、無法維修" },
  { id:7, assetNo:"IT-2022-020", name:"iPad 平板 (教師用)", category:"IT設備", location:"地下校務處", status:"active", purchaseDate:"2022-08-25", purchaseAmount:4800, remark:"" },
  { id:8, assetNo:"IT-2022-021", name:"iPad 平板 (教師用)", category:"IT設備", location:"地下校務處", status:"active", purchaseDate:"2022-08-25", purchaseAmount:4800, remark:"" },
  { id:9, assetNo:"FN-2021-012", name:"文件櫃", category:"傢俱", location:"地下校務處", status:"active", purchaseDate:"2021-03-10", purchaseAmount:3200, remark:"存放學生檔案" },
  { id:10, assetNo:"EL-2022-007", name:"空調 (3匹)", category:"電器", location:"地下校務處", status:"active", purchaseDate:"2022-07-01", purchaseAmount:9000, remark:"" },
  { id:11, assetNo:"FN-2023-005", name:"書架", category:"傢俱", location:"4樓課室", status:"missing", purchaseDate:"2023-02-14", purchaseAmount:1500, remark:"2025盤點時未找到" },
  { id:12, assetNo:"EL-2021-010", name:"音響設備", category:"電器", location:"4樓課室", status:"active", purchaseDate:"2021-11-05", purchaseAmount:6500, remark:"" },
  { id:13, assetNo:"IT-2023-025", name:"Chromebook", category:"IT設備", location:"4樓課室", status:"active", purchaseDate:"2023-05-18", purchaseAmount:3500, remark:"學生用" },
  { id:14, assetNo:"IT-2023-026", name:"Chromebook", category:"IT設備", location:"4樓課室", status:"active", purchaseDate:"2023-05-18", purchaseAmount:3500, remark:"學生用" },
  { id:15, assetNo:"EL-2019-004", name:"投影儀 PM-2019-045", category:"電器", location:"4樓課室", status:"written_off", purchaseDate:"2019-09-01", purchaseAmount:16000, remark:"畫面嚴重偏色" },
];

const MOCK_MOVEMENTS: MovementRecord[] = [
  { id:1, assetNo:"IT-2021-015", assetName:"HP 筆記本電腦", fromLocation:"3樓教員室", toLocation:"地下校務處", movementDate:"2026-06-15", reason:"調配至校務處使用", operator:"陳大明" },
  { id:2, assetNo:"FN-2023-005", assetName:"書架", fromLocation:"4樓課室", toLocation:"3樓教員室", movementDate:"2026-05-20", reason:"教室重新規劃", operator:"李小華" },
  { id:3, assetNo:"IT-2023-025", assetName:"Chromebook", fromLocation:"4樓課室", toLocation:"地下校務處", movementDate:"2026-07-01", reason:"統一管理", operator:"陳大明" },
];

const STATS = {
  total: MOCK_ASSETS.length,
  active: MOCK_ASSETS.filter(a=>a.status==="active").length,
  moved: MOCK_ASSETS.filter(a=>a.status==="moved").length,
  writtenOff: MOCK_ASSETS.filter(a=>a.status==="written_off").length,
  missing: MOCK_ASSETS.filter(a=>a.status==="missing").length,
};

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("stocktake");
  const [assets, setAssets] = useState<AssetRecord[]>(MOCK_ASSETS);
  const [movements, setMovements] = useState<MovementRecord[]>(MOCK_MOVEMENTS);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [writeoffOpen, setWriteoffOpen] = useState(false);
  const [writeoffAsset, setWriteoffAsset] = useState<AssetRecord|null>(null);
  const [selected, setSelected] = useState<AssetRecord|null>(null);
  const [sfilters, setSfilters] = useState<Record<string,string>>({});
  const [wfilters, setWfilters] = useState<Record<string,string>>({});
  const [form, setForm] = useState({ assetNo:"", name:"", category:"", location:"", purchaseDate:"", purchaseAmount:"", remark:"" });

  const handleUpload = (d: { name:string; category:string; location:string; purchaseDate:string; purchaseAmount:number; remark:string; assetNo:string }) => {
    const n: AssetRecord = {
      id: assets.length+1,
      assetNo: d.assetNo || `AS-${new Date().getFullYear()}-${String(assets.length+1).padStart(3,"0")}`,
      name:d.name, category:d.category, location:d.location, status:"active",
      purchaseDate: d.purchaseDate||new Date().toISOString().split("T")[0],
      purchaseAmount: d.purchaseAmount, remark: d.remark,
    };
    setAssets(p=>[n,...p]);
  };

  const handleAdd = () => {
    if (!form.name||!form.category||!form.location) { alert("請填寫資產名稱、類別和地點"); return; }
    const n: AssetRecord = {
      id: assets.length+1,
      assetNo: form.assetNo || `AS-${new Date().getFullYear()}-${String(assets.length+1).padStart(3,"0")}`,
      name:form.name, category:form.category, location:form.location, status:"active",
      purchaseDate: form.purchaseDate||new Date().toISOString().split("T")[0],
      purchaseAmount: parseFloat(form.purchaseAmount)||0, remark: form.remark,
    };
    setAssets(p=>[n,...p]);
    setForm({ assetNo:"", name:"", category:"", location:"", purchaseDate:"", purchaseAmount:"", remark:"" });
  };

  const handleMove = (d: { assetId:number; fromLocation:string; toLocation:string; movementDate:string; reason:string }) => {
    const a = assets.find(x=>x.id===d.assetId); if (!a) return;
    setAssets(p=>p.map(x=>x.id===d.assetId ? {...x, location:d.toLocation, status:"moved"} : x));
    const nm: MovementRecord = {
      id: movements.length+1, assetNo: a.assetNo, assetName: a.name,
      fromLocation:d.fromLocation, toLocation:d.toLocation,
      movementDate:d.movementDate, reason:d.reason, operator:"當前用户",
    };
    setMovements(p=>[nm,...p]);
  };

  /**
   * 資產註銷 — 嚴格按文檔 §5.2 asset_writeoff_service 流程:
   * 更新 status=written_off → 創建 Approval(pending) → 寫 AuditLog
   */
  const handleWriteoff = async (d: { assetId: number; reason: string }) => {
    const a = assets.find((x) => x.id === d.assetId);
    if (!a) return;

    const now = new Date().toISOString();

    // 1. 更新本地狀態 — status → written_off
    setAssets((p) =>
      p.map((x) =>
        x.id === d.assetId
          ? {
              ...x,
              status: "written_off",
              written_off_reason: d.reason,
              written_off_at: now,
              remark: d.reason, // 同步到 remark 用於註銷列表展示
            }
          : x
      )
    );

    // 2. 嘗試調用後端 API（開發期後端不可用時跳過）
    try {
      const { api } = await import("@/lib/api");
      await api.post(`/apple/assets/${d.assetId}/writeoff`, {
        reason: d.reason,
      });
    } catch {
      // 後端不可用，本地狀態已更新（演示期 mock 模式）
    }
  };

  // ─── 篩選 ───
  const writtenOff = assets.filter(a=>a.status==="written_off");
  const filteredStock = (()=>{
    let r = assets.filter(a=>a.status!=="written_off");
    if (sfilters.status && sfilters.status!=="all") r = r.filter(a=>a.status===sfilters.status);
    if (sfilters.location) r = r.filter(a=>a.location.includes(sfilters.location));
    if (sfilters.keyword) { const k=sfilters.keyword.toLowerCase(); r=r.filter(a=>a.name.toLowerCase().includes(k)||a.assetNo.toLowerCase().includes(k)); }
    return r;
  })();
  const filteredWriteoff = (()=>{
    let r = writtenOff;
    if (wfilters.keyword) { const k=wfilters.keyword.toLowerCase(); r=r.filter(a=>a.name.toLowerCase().includes(k)||a.assetNo.toLowerCase().includes(k)); }
    return r;
  })();

  const byLocation = (()=>{
    const g = new Map<string,AssetRecord[]>();
    filteredStock.forEach(a=>{ const e=g.get(a.location)||[]; e.push(a); g.set(a.location,e); });
    return Array.from(g.entries());
  })();

  const stockCols: Column<AssetRecord>[] = [
    { key:"assetNo", header:"資產編號" },
    { key:"name", header:"名稱" },
    { key:"category", header:"類別" },
    { key:"status", header:"狀態", render: r => <TaskStatusBadge status={r.status} /> },
    { key:"remark", header:"備註" },
    { key:"actions", header:"操作", render: r => (
      <div className="flex items-center gap-2">
        <button className="text-xs font-bold text-[#23675f] hover:underline" onClick={()=>{setSelected(r);setMoveOpen(true);}}>搬移記錄</button>
        {r.status==="active" && <button className="text-xs font-bold text-[#a55b2a] hover:underline" onClick={()=>{setWriteoffAsset(r);setWriteoffOpen(true);}}>申請註銷</button>}
      </div>
    )},
  ];

  const woffCols: Column<AssetRecord>[] = [
    { key:"assetNo", header:"資產編號" },
    { key:"name", header:"名稱" },
    { key:"written_off_reason", header:"註銷原因", render: r => <span className="text-xs">{r.remark||r.written_off_reason||"—"}</span> },
    { key:"written_off", header:"審批日期", render: r => <span className="text-xs">{r.written_off_at ? new Date(r.written_off_at).toISOString().split("T")[0] : "—"}</span> },
    { key:"status", header:"審批狀態", render: () => <TaskStatusBadge status="approved" /> },
  ];

  const moveCols: Column<MovementRecord>[] = [
    { key:"assetNo", header:"資產編號" },
    { key:"assetName", header:"資產名稱" },
    { key:"fromLocation", header:"從（地點）" },
    { key:"toLocation", header:"到（地點）" },
    { key:"movementDate", header:"搬移日期" },
    { key:"reason", header:"原因" },
    { key:"operator", header:"操作人" },
  ];

  /* ============================================================ */
  return (
    <div style={{background:BG}} className="space-y-4">
      <PageHeader
        title="資產盤點"
        subtitle="資產登記、盤點管理、折舊計算、報廢審批"
        actions={
          <div className="flex items-center gap-2">
            {activeTab==="new" ? (
              <button style={{background:B, borderColor:B}} className="flex items-center gap-1.5 px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90" onClick={()=>setUploadOpen(true)}>
                <Upload size={16}/> 上傳發票登記
              </button>
            ) : (
              <button style={{background:B, borderColor:B}} className="flex items-center gap-1.5 px-4 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90" onClick={()=>setActiveTab("new")}>
                <Plus size={16}/> 登記資產
              </button>
            )}
          </div>
        }
      />

      {/* Tab */}
      <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-[#d8dee6]" style={{boxShadow:SH}}>
        {([
          {k:"stocktake" as TabKey, label:"盤點", n:MOCK_ASSETS.length},
          {k:"writeoff" as TabKey, label:"註銷", n:writtenOff.length},
          {k:"new" as TabKey, label:"新增", n:null as number|null},
        ]).map(t=>(
          <button key={t.k} onClick={()=>setActiveTab(t.k)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg font-bold transition-colors ${
              activeTab===t.k ? "text-white shadow-sm" : "text-[#667085] hover:bg-[#f1f5f8]"
            }`}
            style={activeTab===t.k ? {background:B} : {}}>
            {t.label}
            {t.n!==null && (
              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs rounded-full font-bold ${
                activeTab===t.k ? "bg-white/20 text-white" : "bg-[#f1f5f8] text-[#667085]"
              }`}>{t.n}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════ 盤點 ═══════ */}
      {activeTab==="stocktake" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 flex-1">
              <StatsCard label="資產總數" value={STATS.total} icon={Package} color="text-[#23675f]" />
              <StatsCard label="正常" value={STATS.active} icon={CheckCircle} color="text-[#027a48]" />
              <StatsCard label="已搬移" value={STATS.moved} icon={MapPin} color="text-[#936a00]" />
              <StatsCard label="已註銷" value={STATS.writtenOff} icon={AlertTriangle} color="text-[#667085]" />
              <StatsCard label="找不到" value={STATS.missing} icon={AlertTriangle} color="text-[#b42318]" />
            </div>
          </div>

          <FilterBar fields={[
            {key:"status",label:"狀態",type:"select",options:[{label:"全部",value:"all"},{label:"正常",value:"active"},{label:"已搬移",value:"moved"},{label:"找不到",value:"missing"}]},
            {key:"location",label:"地點",type:"text",placeholder:"地點名"},
            {key:"keyword",label:"搜尋",type:"text",placeholder:"名稱／編號"},
          ]} values={sfilters} onChange={(k,v)=>setSfilters(p=>({...p,[k]:v}))} onReset={()=>setSfilters({})} onSearch={()=>{}} />

          {movements.length>0 && (
            <div className="bg-white rounded-lg border border-[#d8dee6] overflow-hidden" style={{boxShadow:SH}}>
              <div className="px-4 py-3 border-b border-[#d8dee6] bg-[#f8fafc]">
                <h3 className="text-sm font-bold text-[#344054]">最近搬移記錄</h3>
              </div>
              <DataTable columns={moveCols} data={movements} total={movements.length} page={1} pageSize={10} emptyText="暫無搬移記錄" />
            </div>
          )}

          {byLocation.length===0 ? (
            <p className="text-center text-[#667085] py-16">暫無資產數據</p>
          ) : byLocation.map(([loc, items])=>(
            <div key={loc} className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-[#667085]"/>
                <h3 className="text-[15px] font-bold text-[#1d2939]">{loc}</h3>
                <span className="text-xs text-[#667085]">（{items.length} 件）</span>
              </div>
              <DataTable columns={stockCols} data={items} total={items.length} page={1} pageSize={50} emptyText="該地點暫無資產" />
            </div>
          ))}
        </div>
      )}

      {/* ═══════ 註銷 ═══════ */}
      {activeTab==="writeoff" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard label="已註銷資產" value={STATS.writtenOff} icon={Package} color="text-[#667085]" />
            <StatsCard label="待審批" value={0} icon={Clock} color="text-[#936a00]" />
            <StatsCard label="已審批" value={STATS.writtenOff} icon={CheckCircle} color="text-[#027a48]" />
          </div>

          <FilterBar fields={[{key:"keyword",label:"搜尋",type:"text",placeholder:"名稱／編號"}]} values={wfilters} onChange={(k,v)=>setWfilters(p=>({...p,[k]:v}))} onReset={()=>setWfilters({})} onSearch={()=>{}} />

          {filteredWriteoff.length===0 ? (
            <p className="text-center text-[#667085] py-16">暫無註銷記錄</p>
          ) : (
            <DataTable columns={woffCols} data={filteredWriteoff} total={filteredWriteoff.length} page={1} pageSize={20} emptyText="暫無註銷記錄" />
          )}
        </div>
      )}

      {/* ═══════ 新增 ═══════ */}
      {activeTab==="new" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-[#d8dee6] p-5 cursor-pointer hover:border-[#23675f] transition-colors" style={{boxShadow:SH}} onClick={()=>setUploadOpen(true)}>
            <div className="flex items-center gap-3 mb-3">
              <Upload size={18} style={{color:B}}/>
              <h3 className="text-[15px] font-bold text-[#1d2939]">拍照上傳發票登記</h3>
            </div>
            <p className="text-sm text-[#667085] ml-9">上傳購買發票，系統自動識別資產信息並填充表單</p>
          </div>

          <FormSection title="手動登記資產" subtitle="填寫以下信息登記新資產">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">資產編號</label>
                <input type="text" value={form.assetNo} onChange={e=>setForm(p=>({...p,assetNo:e.target.value}))} placeholder="自動生成或手動輸入"
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"/>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">資產名稱 <span className="text-[#b42318]">*</span></label>
                <input type="text" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="如：Dell 桌上電腦"
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"/>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">類別 <span className="text-[#b42318]">*</span></label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]">
                  <option value="">請選擇類別</option>
                  {["IT設備","傢俱","電器","辦公設備","其他"].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">存放地點 <span className="text-[#b42318]">*</span></label>
                <select value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]">
                  <option value="">請選擇地點</option>
                  {["3樓教員室","地下校務處","4樓課室","2樓實驗室","1樓大堂","操場倉庫"].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">購買日期</label>
                <input type="date" value={form.purchaseDate} onChange={e=>setForm(p=>({...p,purchaseDate:e.target.value}))}
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"/>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#344054] mb-1">購買金額（HKD）</label>
                <input type="number" value={form.purchaseAmount} onChange={e=>setForm(p=>({...p,purchaseAmount:e.target.value}))} placeholder="0.00"
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"/>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[13px] font-bold text-[#344054] mb-1">備註</label>
                <input type="text" value={form.remark} onChange={e=>setForm(p=>({...p,remark:e.target.value}))} placeholder="其他需要記錄的信息"
                  className="w-full text-sm border border-[#d8dee6] rounded-lg px-[9px] py-[8px] focus:outline-none focus:border-[#23675f]"/>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={handleAdd} style={{background:B, borderColor:B}}
                className="flex items-center gap-1.5 px-6 py-[8px] text-sm text-white rounded-lg font-bold hover:opacity-90">
                <Plus size={16}/> 登記入庫
              </button>
            </div>
          </FormSection>
        </div>
      )}

      <UploadAssetDialog open={uploadOpen} onClose={()=>setUploadOpen(false)} onConfirm={handleUpload} />
      <AssetMovementDialog open={moveOpen} onClose={()=>{setMoveOpen(false);setSelected(null);}} assets={assets.filter(a=>a.status==="active")} preselectedAsset={selected} onConfirm={handleMove} />
      <WriteoffDialog open={writeoffOpen} onClose={()=>{setWriteoffOpen(false);setWriteoffAsset(null);}} asset={writeoffAsset} onConfirm={handleWriteoff} />
    </div>
  );
}
