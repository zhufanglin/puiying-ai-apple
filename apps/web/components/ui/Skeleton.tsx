"use client";

/**
 * 骨架屏组件集合
 */

interface SkeletonProps {
  className?: string;
}

/** 通用矩形骨架 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className}`}
      aria-hidden="true"
    />
  );
}

/** 文本行骨架 */
export function SkeletonLine({ className = "" }: SkeletonProps) {
  return <Skeleton className={`h-4 w-full ${className}`} />;
}

/** 标题骨架（比正文稍高） */
export function SkeletonTitle({ className = "" }: SkeletonProps) {
  return <Skeleton className={`h-5 w-1/3 ${className}`} />;
}

/** 表格骨架屏 */
export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="space-y-3">
      {/* 表头 */}
      <div className="flex gap-4 rounded-lg bg-gray-100 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* 数据行 */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 rounded-lg border border-gray-100 bg-white px-4 py-3"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={`${rowIdx}-${colIdx}`}
              className="h-4 flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 卡片骨架屏 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-gray-200 bg-white p-5"
        >
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** 详情页骨架屏 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-gray-200 bg-white p-5"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* 详情区块 */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* 日志表格 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <Skeleton className="mb-4 h-5 w-24" />
        <TableSkeleton rows={4} cols={5} />
      </div>
    </div>
  );
}
