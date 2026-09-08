import { TableSkeleton } from '@/components/common/skeleton';

export default function Loading() {
  return (
    <div className="px-4 sm:px-8 py-6">
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
