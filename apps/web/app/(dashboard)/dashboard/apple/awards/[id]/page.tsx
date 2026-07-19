"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Calculator, CheckCircle, AlertCircle, ChevronRight, Trash2, XCircle, Edit3 } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import ReadingScriptPopup from "@/components/ui/ReadingScriptPopup";
import AwardsScriptDialog from "@/components/modules/apple/AwardsScriptDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { awardApi } from "@/lib/services/awards";
import type { Award, AwardRecipient, CalculateResult } from "@/lib/types/awards";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "草稿", cls: "bg-gray-100 text-gray-600" },
    calculated: { label: "已核算", cls: "bg-blue-100 text-blue-700" },
    confirmed: { label: "已確認", cls: "bg-green-100 text-green-700" },
    cancelled: { label: "已取消", cls: "bg-red-100 text-red-600" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function AwardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [award, setAward] = useState<Award | null>(null);
  const [loading, setLoading] = useState(true);
  const [scriptPopup, setScriptPopup] = useState<{
    studentName: string;
    studentClass: string;
  } | null>(null);
  const [calcResult, setCalcResult] = useState<CalculateResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [rulesText, setRulesText] = useState("");
  const [calcError, setCalcError] = useState<string | null>(null);
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editIssuer, setEditIssuer] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editRemark, setEditRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAward = async () => {
    const id = Number(params.id);
    if (!id) return;
    try {
      const res = await awardApi.getAward(id);
      setAward(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAward(); }, [params.id]);

  // 自動將 amount 預填入核算規則的默認值
  useEffect(() => {
    if (award?.amount && !rulesText) {
      setRulesText(`默認, ${award.amount}`);
    }
  }, [award?.amount]);

  // 根據後端狀態初始化核算步驟
  useEffect(() => {
    if (award?.status === "confirmed") {
      setCurrentStep(3);
    } else if (award?.status === "calculated") {
      setCurrentStep(2);
    }
  }, [award?.status]);

  const handleDelete = async () => {
    if (!award) return;
    setActionLoading(true);
    try {
      await awardApi.deleteAward(award.id);
      router.push("/dashboard/apple/awards");
    } catch (e: any) {
      alert("刪除失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setActionLoading(false);
      setDeleteTarget(false);
    }
  };

  const handleCancel = async () => {
    if (!award) return;
    setActionLoading(true);
    try {
      await awardApi.cancelAward(award.id);
      loadAward();
    } catch (e: any) {
      alert("取消失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setActionLoading(false);
      setCancelTarget(false);
    }
  };

  const startEdit = () => {
    if (!award) return;
    setEditTitle(award.title);
    setEditIssuer(award.issuer || "");
    setEditIssueDate(award.issue_date || "");
    setEditRemark(award.remark || "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!award) return;
    setSaving(true);
    try {
      const payload: any = {};
      if (editTitle.trim()) payload.title = editTitle.trim();
      payload.issuer = editIssuer.trim() || null;
      if (editIssueDate) payload.issue_date = editIssueDate;
      payload.remark = editRemark.trim() || null;
      await awardApi.updateAward(award.id, payload);
      setEditing(false);
      loadAward();
    } catch (e: any) {
      alert("保存失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">載入中...</div>;
  }

  if (!award) {
    return <div className="text-center py-12 text-gray-400">獎狀不存在</div>;
  }

  const columns: Column<AwardRecipient>[] = [
    { key: "student_name", header: "姓名" },
    { key: "student_class", header: "班級" },
    { key: "student_grade", header: "年級" },
    { key: "rank", header: "獲獎等級" },
    {
      key: "scholarship_amount",
      header: "獎學金",
      width: "100px",
      align: "right",
      render: (row) => (row.scholarship_amount != null ? `HK$${Number(row.scholarship_amount).toLocaleString()}` : "-"),
    },
    { key: "reason", header: "獲獎原因" },
    {
      key: "actions",
      header: "操作",
      width: "15%",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() =>
              setScriptPopup({
                studentName: row.student_name,
                studentClass: row.student_class,
              })
            }
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-primary-600"
            title="讀稿"
          >
            <FileText size={15} />
          </button>
          <button
            onClick={async () => {
              try {
                await awardApi.downloadRecipientCertificate(award.id, row.id);
              } catch (e) {
                console.error("下載失敗", e);
              }
            }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600"
            title="下載 PDF 證書"
          >
            <Download size={15} />
          </button>
        </div>
      ),
    },
  ];

  // 獎學金核算：解析規則行，支援「等級, 金額」「等級：金額」「等級，金額」等格式
  const parseRules = (text: string): Record<string, number> => {
    const rules: Record<string, number> = {};
    text.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      // 用第一個分隔符（逗號/冒號/空格）分割爲等級和金額
      const match = trimmed.match(/^(.+?)[,，:：\s]+(.+)$/);
      if (!match) return;
      const key = match[1].trim();
      // 從金額部分移除 HK$、HKD、逗號、空格、以及中文后缀
      const rawValue = match[2].replace(/HK\$|HKD|HKD\s|元|港元|圓|港幣|hkd|[,\s，\s]/gi, "").trim();
      const value = Number(rawValue);
      if (!isNaN(value) && value > 0 && key) {
        rules[key] = value;
      }
    });
    return rules;
  };

  const handleCalculate = async () => {
    setCalcError(null);
    setCalculating(true);
    try {
      const rules = rulesText.trim() ? parseRules(rulesText) : undefined;
      const res = await awardApi.calculateScholarship(award!.id, rules);
      setCalcResult(res.data);
      setCurrentStep(2);
      const updated = await awardApi.getAward(award!.id);
      setAward(updated.data);
    } catch (e: any) {
      setCalcError(e?.message || "核算失敗，請檢查規則格式或稍後重試");
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await awardApi.confirmScholarship(award!.id);
      setCurrentStep(3);
      const updated = await awardApi.getAward(award!.id);
      setAward(updated.data);
    } catch (e: any) {
      alert("確認失敗：" + (e?.message || "未知錯誤"));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={award.title}
        subtitle={`範本：${award.template?.name || "-"} | 狀態：${award.status}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <ArrowLeft size={16} /> 返回
            </button>
            <button
              onClick={() => setScriptDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <FileText size={16} /> 批量讀稿
            </button>
            {(award.status === "draft" || award.status === "calculated") && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                <Edit3 size={16} /> 編輯
              </button>
            )}
            {award.status !== "cancelled" && award.status !== "confirmed" && (
              <button
                onClick={() => setCancelTarget(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <XCircle size={16} /> 取消獎狀
              </button>
            )}
            <button
              onClick={() => setDeleteTarget(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={16} /> 刪除
            </button>
          </div>
        }
      />

      {/* 基本資訊 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
          基本資訊
        </h3>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">獎狀標題</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">頒發部門</label>
              <input
                type="text"
                value={editIssuer}
                onChange={(e) => setEditIssuer(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">頒發日期</label>
              <input
                type="date"
                value={editIssueDate}
                onChange={(e) => setEditIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
              <input
                type="text"
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存修改"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">獎狀標題</span>
              <p className="font-medium text-gray-800 mt-0.5">{award.title}</p>
            </div>
            <div>
              <span className="text-gray-500">獎狀範本</span>
              <p className="font-medium text-gray-800 mt-0.5">{award.template?.name || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">頒發日期</span>
              <p className="font-medium text-gray-800 mt-0.5">{award.issue_date}</p>
            </div>
            <div>
              <span className="text-gray-500">頒發部門</span>
              <p className="font-medium text-gray-800 mt-0.5">{award.issuer || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">狀態</span>
              <div className="mt-0.5"><StatusBadge status={award.status} /></div>
            </div>
            <div>
              <span className="text-gray-500">獲獎人數</span>
              <p className="font-medium text-gray-800 mt-0.5">{award.total_recipients} 人</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">備註</span>
              <p className="font-medium text-gray-800 mt-0.5">{award.remark || "-"}</p>
            </div>
          </div>
        )}
      </div>

      {/* 雙欄佈局：學生列表 / 獎學金核算與確認 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* 左欄：獲獎學生列表 */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
            獲獎名單（{award.recipients?.length || 0} 人）
          </h3>
          <DataTable
            columns={columns}
            data={award.recipients || []}
            pageSize={100}
          />
        </div>

        {/* 右欄：獎學金核算與確認 */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
            獎學金核算與確認
          </h3>

          {/* 步驟指示器 */}
          <div className="flex gap-0 mb-5">
            {[
              { n: 1, label: "設置金額" },
              { n: 2, label: "核算結果" },
              { n: 3, label: "確認完成" },
            ].map((s) => {
              const isActive = currentStep === s.n;
              const isDone = currentStep > s.n;
              return (
                <div
                  key={s.n}
                  className={`flex-1 flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive ? "bg-blue-50 text-blue-600" :
                    isDone ? "bg-green-50 text-green-600" :
                    "text-gray-400"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                    isActive ? "bg-blue-600 text-white" :
                    isDone ? "bg-green-600 text-white" :
                    "bg-gray-100 text-gray-400"
                  }`}>{s.n}</span>
                  {s.label}
                </div>
              );
            })}
          </div>

          {/* Step 1：設置規則 */}
          {currentStep === 1 && (
            <>
              {calcError && (
                <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" /> {calcError}
                </div>
              )}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  自定義金額（每行一條：等級, 金額）
                </label>
                <textarea
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  rows={4}
                  placeholder={"一等獎, 1000\n二等獎, 500\n默認, 200"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary-400 font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">如不填寫將使用默認規則（一等獎$1000 / 二等獎$500 / 三等獎$300 / 優秀獎$100）</p>
              </div>
              <button
                onClick={handleCalculate}
                disabled={calculating}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                <Calculator size={15} />
                {calculating ? "核算中..." : "開始核算"}
              </button>
            </>
          )}

          {/* Step 2：檢視與調整 */}
          {currentStep === 2 && calcResult && (
            <>
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-800">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>
                  核算規則：
                  {rulesText.trim()
                    ? rulesText.split("\n").filter((l) => l.trim()).map((l) => l.trim()).join("，")
                    : "默認規則（一等獎$1000 / 二等獎$500 / 三等獎$300 / 優秀獎$100）"}
                </span>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden mb-3 max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">學生</th>
                      <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">等級</th>
                      <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">金額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {calcResult.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-2.5 py-1.5 font-medium">{item.student_name}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{item.rank || "-"}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono">HK$ {Number(item.final_amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-sm font-semibold text-gray-900 mb-3">
                <span>合計</span>
                <span>HK$ {Number(calcResult.total_amount).toLocaleString()}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setCurrentStep(1); setCalcError(null); }}
                  className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  ← 返回修改規則
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle size={15} />
                  {confirming ? "確認中..." : "確認核算結果"}
                </button>
              </div>
            </>
          )}

          {/* Step 3：已確認 */}
          {currentStep === 3 && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <p className="text-base font-semibold text-green-700 mb-1">核算結果已確認</p>
              {calcResult ? (
                <p className="text-sm text-gray-500 mb-6">
                  已為 {calcResult.items.length} 名學生核算獎學金，合計 HK$ {Number(calcResult.total_amount).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm text-gray-500 mb-6">
                  獎學金核算已完成並確認
                </p>
              )}

              <button
                onClick={async () => {
                  try {
                    await awardApi.batchExportAwards([award!.id]);
                  } catch (e) {
                    alert("導出證書失敗");
                  }
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600"
              >
                <Download size={15} />
                導出全部證書
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 批量讀稿彈窗 */}
      <AwardsScriptDialog
        open={scriptDialogOpen}
        awardId={award.id}
        awardTitle={award.title}
        awardYear={award.issue_date?.slice(0, 4) || ""}
        onClose={() => setScriptDialogOpen(false)}
      />

      {/* 讀稿彈窗 */}
      <ReadingScriptPopup
        open={scriptPopup !== null}
        awardId={award.id}
        studentName={scriptPopup?.studentName || ""}
        studentClass={scriptPopup?.studentClass || ""}
        onClose={() => setScriptPopup(null)}
      />

      {/* 刪除確認 */}
      <ConfirmDialog
        open={deleteTarget}
        title="確認刪除"
        message={`確定要刪除獎狀「${award.title}」嗎？此操作不可撤銷，獲獎學生資料也將一併刪除。`}
        variant="danger"
        confirmText="確認刪除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(false)}
        loading={actionLoading}
      />

      {/* 取消確認 */}
      <ConfirmDialog
        open={cancelTarget}
        title="確認取消"
        message={`確定要取消獎狀「${award.title}」嗎？取消後將不可恢復。`}
        variant="danger"
        confirmText="確認取消"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(false)}
        loading={actionLoading}
      />
    </div>
  );
}
