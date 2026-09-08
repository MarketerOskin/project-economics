'use client';

import { FilterMenu, type FilterGroup } from '@/components/common/filter-menu';
import { useFilterOptions } from '@/lib/client/filter-options';

const STATUS_OPTS = [
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'COMPLETED', label: 'Завершённые' },
  { value: 'ARCHIVED', label: 'Архив' },
  { value: 'ALL', label: 'Все' },
];

export function DashboardFilters() {
  const { projects, users, categories } = useFilterOptions();

  const groups: FilterGroup[] = [
    { key: 'status', label: 'Статус проекта', allLabel: 'Активные и завершённые', options: STATUS_OPTS },
    { key: 'projectId', label: 'Проект', allLabel: 'Все проекты', options: projects },
    { key: 'employeeId', label: 'Сотрудник', allLabel: 'Все сотрудники', options: users },
    { key: 'categoryId', label: 'Статья', allLabel: 'Все статьи', options: categories },
  ];

  return <FilterMenu basePath="/" groups={groups} />;
}
