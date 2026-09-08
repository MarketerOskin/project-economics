import { TableSkeleton } from '@/components/common/skeleton';

export default function Loading() {
  return (
    <div className="px-4 sm:px-8 py-6">
      <div className="mb-6 h-8 w-64 animate-pulse rounded-[8px] bg-surface-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[16px] bg-surface-muted" />
        ))}
      </div>
      <div className="mt-6">
        <TableSkeleton rows={5} cols={6} />
      </div>
    </div>
  );
}
