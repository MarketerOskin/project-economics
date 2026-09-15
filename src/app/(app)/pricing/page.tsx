import { PageHeader } from '@/components/layout/app-shell';
import { requirePageSession } from '@/server/page-session';
import { PricingPlans } from '@/components/billing/pricing-plans';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const { session } = await requirePageSession();

  return (
    <>
      <PageHeader title="Тарифы" subtitle="Free — чтобы начать, Pro — когда экономика проектов станет частью процесса" />
      <div className="px-4 py-6 sm:px-8">
        <PricingPlans currentPlan={session.plan} isDemo={session.demo} />
      </div>
    </>
  );
}
