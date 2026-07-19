"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, CheckCircle, XCircle, Clock } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import { awardApi } from "@/lib/services/awards";
import type { ScholarshipApplication } from "@/lib/types/awards";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "待審核", cls: "bg-yellow-100 text-yellow-700" },
  approved: { label: "已通過", cls: "bg-green-100 text-green-700" },
  rejected: { label: "已駁回", cls: "bg-red-100 text-red-600" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

const TYPE_LABEL: Record<string, string> = {
  "學業優秀": "學業優秀",
  "品德風尚": "品德風尚",
  "科技競賽": "科技競賽",
  "體藝特長": "體藝特長",
  "助學金": "助學金",
};

export default function ScholarshipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = Number(params.id);

  const [app, setApp] = useState<ScholarshipApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId) return;
    awardApi.getScholarship(appId)
      .then((res) => setApp(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [appId]);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">載入中...</div>;
  }

  if (!app) {
    return <div className="text-center py-12 text-gray-400">申請不存在</div>;
  }

  return (
    <div>
      <PageHeader
        title={app.student_name}
        subtitle={`${app.scholarship_type} — ${app.academic_year} 學年第${app.semester}學期`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <ArrowLeft size={16} /> 返回
            </button>
            {app.status === "approved" && (
              <button
                onClick={async () => {
                  try {
                    await awardApi.downloadScholarshipCertificate(app.id);
                  } catch (e) {
                    console.error("下載失敗", e);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-primary-500 rounded-lg hover:bg-primary-600"
              >
                <Download size={16} /> 下載證書
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 基本資訊 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
            申請資訊
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">學生姓名</span>
              <p className="font-medium text-gray-800 mt-0.5">{app.student_name}</p>
            </div>
            <div>
              <span className="text-gray-500">班級</span>
              <p className="font-medium text-gray-800 mt-0.5">{app.student_class}</p>
            </div>
            <div>
              <span className="text-gray-500">年級</span>
              <p className="font-medium text-gray-800 mt-0.5">{app.student_grade || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">獎學金類型</span>
              <p className="font-medium text-gray-800 mt-0.5">{TYPE_LABEL[app.scholarship_type] || app.scholarship_type}</p>
            </div>
            <div>
              <span className="text-gray-500">學年</span>
              <p className="font-medium text-gray-800 mt-0.5">{app.academic_year}</p>
            </div>
            <div>
              <span className="text-gray-500">學期</span>
              <p className="font-medium text-gray-800 mt-0.5">第{app.semester}學期</p>
            </div>
            <div>
              <span className="text-gray-500">申請金額</span>
              <p className="font-medium text-gray-800 mt-0.5">HK$ {Number(app.amount).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-500">申請日期</span>
              <p className="font-medium text-gray-800 mt-0.5">{app.application_date}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">申請理由</span>
              <p className="font-medium text-gray-800 mt-0.5">{app.reason || "-"}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">備註</span>
              <p className="font-medium text-gray-800 mt-0.5">{app.remark || "-"}</p>
            </div>
          </div>
        </div>

        {/* 審核資訊 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
            審核狀態
          </h3>

          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{
                backgroundColor:
                  app.status === "approved" ? "#e8f5e9" :
                  app.status === "rejected" ? "#fce4ec" : "#fff8e1",
              }}
            >
              {app.status === "approved" ? (
                <CheckCircle size={28} className="text-green-600" />
              ) : app.status === "rejected" ? (
                <XCircle size={28} className="text-red-500" />
              ) : (
                <Clock size={28} className="text-yellow-600" />
              )}
            </div>
            <p className="text-lg font-bold text-gray-900 mb-1">
              <StatusBadge status={app.status} />
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {app.status === "pending" && "等待審核中"}
              {app.status === "approved" && "已通過審核，可下載證書"}
              {app.status === "rejected" && "申請已被駁回"}
            </p>
          </div>

          {app.status !== "pending" && (
            <div className="border-t border-gray-100 pt-3 mt-2 space-y-2 text-sm">
              <div>
                <span className="text-gray-500">審核意見</span>
                <p className="font-medium text-gray-800 mt-0.5">{app.review_comment || "-"}</p>
              </div>
              {app.review_date && (
                <div>
                  <span className="text-gray-500">審核日期</span>
                  <p className="font-medium text-gray-800 mt-0.5">
                    {new Date(app.review_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
