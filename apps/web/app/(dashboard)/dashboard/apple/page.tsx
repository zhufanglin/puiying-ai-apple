import {
  Award,
  Receipt,
  Package,
  GraduationCap,
  TrendingUp,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

const stats = [
  { label: "獎狀模板", value: 12, icon: Award, color: "text-blue-600", bg: "bg-blue-50" },
  { label: "本月收支", value: "¥156,800", icon: Receipt, color: "text-green-600", bg: "bg-green-50" },
  { label: "資產總數", value: 2340, icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
  { label: "在校學生", value: 1856, icon: GraduationCap, color: "text-orange-600", bg: "bg-orange-50" },
];

const logs = [
  { action: "審批通過", target: "三好學生獎狀 #A023", time: "2 分鐘前", status: "success" },
  { action: "提交審批", target: "優秀班幹部獎狀 #A024", time: "15 分鐘前", status: "pending" },
  { action: "上傳票據", target: "春季運動會採購發票", time: "1 小時前", status: "info" },
  { action: "資產報廢", target: "投影儀 PM-2019-032", time: "2 小時前", status: "warning" },
];

export default function AppleOverviewPage() {
  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{s.value}</p>
              </div>
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon size={20} className={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 快捷入口 + 最近動態 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 快捷入口 */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">快捷操作</h2>
          <div className="space-y-2">
            {[
              { label: "生成獎狀", href: "/dashboard/apple/awards/generate", icon: Award },
              { label: "上傳票據", href: "/dashboard/apple/finance", icon: Receipt },
              { label: "資產盤點", href: "/dashboard/apple/assets", icon: Package },
              { label: "學生查詢", href: "/dashboard/apple/students", icon: GraduationCap },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <item.icon size={18} className="text-primary-500" />
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* 最近動態 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">最近動態</h2>
          <div className="space-y-3">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                {log.status === "success" && <CheckCircle size={16} className="text-green-500" />}
                {log.status === "pending" && <ClipboardList size={16} className="text-yellow-500" />}
                {log.status === "warning" && <AlertTriangle size={16} className="text-orange-500" />}
                {log.status === "info" && <TrendingUp size={16} className="text-blue-500" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800">{log.action}</span>
                  <span className="text-sm text-gray-400 ml-2">{log.target}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
