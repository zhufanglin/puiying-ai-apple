interface AuditEntry {
  id: number;
  action: string;
  operator: string;
  time: string;
  detail?: string;
}

interface AuditTimelineProps {
  entries: AuditEntry[];
}

export default function AuditTimeline({ entries }: AuditTimelineProps) {
  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex gap-3">
          {/* 時間線 */}
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-400 mt-1.5" />
            {i < entries.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
          </div>
          {/* 內容 */}
          <div className={`pb-4 ${i === entries.length - 1 ? "" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">{entry.action}</span>
              <span className="text-xs text-gray-400">— {entry.operator}</span>
            </div>
            {entry.detail && (
              <p className="text-xs text-gray-500 mt-0.5">{entry.detail}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{entry.time}</p>
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">暫無審計記錄</p>
      )}
    </div>
  );
}
