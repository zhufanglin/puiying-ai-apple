import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: string;
}

export default function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  color = "text-primary-600",
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
          {trend && (
            <p className={`text-xs mt-2 ${trendUp ? "text-green-600" : "text-red-500"}`}>
              {trendUp ? "↑" : "↓"} {trend} 较上月
            </p>
          )}
        </div>
        <div className={`w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}
