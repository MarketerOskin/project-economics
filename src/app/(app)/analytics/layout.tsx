import { AnalyticsTabs } from '@/components/analytics/analytics-tabs';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="sr-only">Аналитика</h1>
      <AnalyticsTabs />
      {children}
    </>
  );
}
