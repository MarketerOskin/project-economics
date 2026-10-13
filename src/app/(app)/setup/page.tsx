import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { SetupWizard } from '@/components/settings/setup-wizard';
import { requirePageSession } from '@/server/page-session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const { session } = await requirePageSession();
  if (!can.manageSettings(session.actor)) redirect('/');

  return (
    <>
      <PageHeader
        title="Настройка под портал"
        subtitle="Расскажите, как устроен ваш Битрикс24, и приложение покажет только нужное"
      />
      <div className="max-w-3xl px-4 py-6 sm:px-8">
        <SetupWizard />
      </div>
    </>
  );
}
