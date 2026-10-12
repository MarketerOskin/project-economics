'use client';

import { usePathname } from 'next/navigation';
import { FilterMenu, type FilterGroup } from '@/components/common/filter-menu';

export function AnalyticsFilters({
  projects,
  people,
}: {
  projects?: Array<{ value: string; label: string }>;
  people: Array<{ value: string; label: string }>;
}) {
  const pathname = usePathname();
  const groups: FilterGroup[] = [
    ...(projects ? [{ key: 'projectId', label: 'Проект', allLabel: 'Все проекты', options: projects }] : []),
    { key: 'employeeId', label: 'Сотрудник', allLabel: 'Все сотрудники', options: people },
  ];
  return <FilterMenu basePath={pathname} groups={groups} />;
}
