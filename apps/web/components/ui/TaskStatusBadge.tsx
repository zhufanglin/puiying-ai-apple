interface TaskStatusBadgeProps {
  status: string;
}

const statusMap: Record<string, { label: string; className: string }> = {
  pending: { label: "待处理", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  processing: { label: "处理中", className: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "已完成", className: "bg-green-50 text-green-700 border-green-200" },
  failed: { label: "失败", className: "bg-red-50 text-red-700 border-red-200" },
  approved: { label: "已通过", className: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "已拒绝", className: "bg-red-50 text-red-700 border-red-200" },
  // 财务模块
  confirmed: { label: "已入账", className: "bg-green-50 text-green-700 border-green-200" },
  // 资产模块
  active: { label: "正常", className: "bg-green-50 text-green-700 border-green-200" },
  moved: { label: "已搬移", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  written_off: { label: "已注销", className: "bg-gray-50 text-gray-600 border-gray-200" },
  missing: { label: "找不到", className: "bg-red-50 text-red-700 border-red-200" },
};

export default function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const config = statusMap[status] || { label: status, className: "bg-gray-50 text-gray-600 border-gray-200" };

  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${config.className}`}>
      {config.label}
    </span>
  );
}
