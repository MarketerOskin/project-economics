import { PageHeader } from '@/components/layout/app-shell';
import { requirePageSession } from '@/server/page-session';
import { ImplementationRequest } from '@/components/billing/implementation-request';

export const dynamic = 'force-dynamic';

export default async function ImplementationPage() {
  await requirePageSession();

  return (
    <>
      <PageHeader title="Внедрение" subtitle="Настроим приложение под то, как вы работаете в Битрикс24" />
      <div className="px-4 py-6 sm:px-8">
        <ImplementationRequest />
      </div>
    </>
  );
}
