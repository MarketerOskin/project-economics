import { PageHeader } from '@/components/layout/app-shell';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Экономика проектов" subtitle="Доходы, расходы и рентабельность проектов" />
      <div className="px-8 py-6">
        <p className="text-sm text-fg-secondary">
          Дашборд появится на следующем этапе разработки.
        </p>
      </div>
    </>
  );
}
