import { PageHeader } from '@/components/layout/app-shell';
import { AnalyticsTabs } from '@/components/analytics/analytics-tabs';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Аналитика" subtitle="Задачи, часы и встречи по проектам, маркетинг и продажи по каналам из Битрикс24" />
      <AnalyticsTabs />
      {children}
    </>
  );
}
