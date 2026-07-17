"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Calculator, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import ReadingScriptPopup from "@/components/ui/ReadingScriptPopup";
import AwardsScriptDialog from "@/components/modules/apple/AwardsScriptDialog";
import { awardApi } from "@/lib/services/awards";
import { parseChineseNumber } from "@/lib/utils/chinese-number";
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
  const [currentStep, setCurrentStep] = useState(1); // 1=设置规则, 2=检视结果, 3=已确认
  const [rulesText, setRulesText] = useState("");
  const [calcError, setCalcError] = useState<string | null>(null);
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false);

  useEffect(() => {
    const id = Number(params.id);
    if (!id) return;
    awardApi.getAward(id)
      .then((res) => setAward(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  // 自动将 amount 预填入核算规则的默认值（免去再次填写）
  useEffect(() => {
    if (award?.amount && !rulesText) {
      setRulesText(`默認, ${award.amount}`);
    }
  }, [award?.amount]);

  // 根据后端状态初始化核算步骤（避免刷新后 step 归零）
  useEffect(() => {
    if (award?.status === "confirmed") {
      setCurrentStep(3);
    } else if (award?.status === "calculated") {
      setCurrentStep(2);
    }
  }, [award?.status]);

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

  // 奖学金核算
  const handleCalculate = async () => {
    setCalcError(null);
    setCalculating(true);
    try {
      let rules: Record<string, number> | undefined;
      if (rulesText.trim()) {
        rules = {};
        rulesText.split("\n").forEach((line) => {
          const parts = line.split(/[,，:：\s]+/).filter(Boolean);
          if (parts.length >= 2) {
            const value = parseChineseNumber(parts[1]);
            if (!isNaN(value) && value > 0) {
              rules![parts[0]] = value;
            }
          }
        });
      }
      const res = await awardApi.calculateScholarship(award!.id, rules);
      setCalcResult(res.data);
      setCurrentStep(2); // 进入检视与调整
      // 刷新奖状数据以更新状态
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
      setCurrentStep(3); // 已确认
      // 刷新奖状数据以更新状态
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
          </div>
        }
      />

      {/* 基本資訊 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
          基本資訊
        </h3>
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
      </div>

      {/* 双栏布局：学生列表 / 奖学金核算与确认 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* 左栏：获奖学生列表（不变） */}
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

        {/* 右栏：奖学金核算与确认（渐进式三步） */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
            獎學金核算與確認
          </h3>

          {/* 步骤指示器 */}
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

          {/* Step 1：设置规则 */}
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
                <p className="text-[11px] text-gray-400 mt-1">支援中文數字：五百、壹佰、一千二百</p>
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

          {/* Step 2：检视与调整 */}
          {currentStep === 2 && calcResult && (
            <>
              {/* 规则摘要 */}
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-800">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>
                  核算規則：
                  {rulesText.trim()
                    ? rulesText.split("\n").filter((l) => l.trim()).map((l) => l.trim()).join("，")
                    : "默認規則（一等獎$1000 / 二等獎$500 / 三等獎$300 / 優秀獎$100）"}
                </span>
              </div>

              {/* 结果表格 */}
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

              {/* 合计 */}
              <div className="flex items-center justify-between text-sm font-semibold text-gray-900 mb-3">
                <span>合計</span>
                <span>HK$ {Number(calcResult.total_amount).toLocaleString()}</span>
              </div>

              {/* 操作按钮 */}
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

          {/* Step 3：已确认 */}
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

              <Link
                href="/dashboard/apple/awards/batch"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600"
              >
                <FileText size={15} />
                前往批量生成證書
                <ChevronRight size={15} />
              </Link>

              <div className="mt-4">
                <button
                  onClick={() => { setCurrentStep(1); setCalcResult(null); setRulesText(""); setCalcError(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  🔄 重新核算
                </button>
              </div>
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
    </div>
  );
}
