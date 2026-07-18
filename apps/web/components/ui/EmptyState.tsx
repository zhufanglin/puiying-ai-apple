import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title = "暫無數據",
  description = "當前沒有可顯示的內容",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={48} className="text-gray-300 mb-4" />
      <h3 className="text-base font-medium text-gray-500">{title}</h3>
      <p className="text-sm text-gray-400 mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
