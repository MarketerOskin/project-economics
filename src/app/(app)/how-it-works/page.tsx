import { PageHeader } from '@/components/layout/app-shell';
import { requirePageSession } from '@/server/page-session';
import { HowItWorksSections } from '@/components/how-it-works/sections';

export const dynamic = 'force-dynamic';

export default async function HowItWorksPage() {
  await requirePageSession();

  return (
    <>
      <PageHeader
        title="Как это работает"
        subtitle="Откуда берутся цифры на дашборде и как устроены расчёты"
      />
      <HowItWorksSections />
    </>
  );
}
