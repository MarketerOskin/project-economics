import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { StageRulesManager } from '@/components/settings/stage-rules-manager';
import { requirePageSession } from '@/server/page-session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** How CRM stages count: in progress, closed, won or cancelled (ADR-051). */
export default async function StagesPage() {
  const { session } = await requirePageSession();
  if (!can.manageSettings(session.actor)) redirect('/');

  return (
    <>
      <PageHeader
        title="Стадии CRM"
        subtitle="Какие стадии считать в работе, закрытыми, успешными и отменёнными"
      />
      <div className="flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-8">
        <p className="text-fg-secondary max-w-3xl text-sm">
          В смарт-процессах стадия часто называется «в работе», хотя работа по ней уже закончена.
          Отметьте, что значит каждая стадия: от этого зависят «в работе» и «выполнено» в аналитике
          проектов, выигранные и проигранные сделки в продажах. Стадии, которые вы не меняли,
          считаются так, как задано в Битрикс24.
        </p>
        <StageRulesManager />
      </div>
    </>
  );
}
