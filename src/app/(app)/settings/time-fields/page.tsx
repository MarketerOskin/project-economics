import { redirect } from 'next/navigation';
import { CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/layout/app-shell';
import { TimeFieldsManager } from '@/components/settings/time-fields-manager';
import { requirePageSession } from '@/server/page-session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function Way({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-surface flex gap-3 border p-4">
      <span className="text-accent mt-0.5">{icon}</span>
      <div>
        <div className="text-fg font-medium">{title}</div>
        <div className="text-fg-secondary mt-1 text-sm">{children}</div>
      </div>
    </div>
  );
}

export default async function TimeFieldsPage() {
  const { session } = await requirePageSession();
  if (!can.manageSettings(session.actor)) redirect('/');

  return (
    <>
      <PageHeader title="Учёт времени" subtitle="Откуда берутся часы по проектам" />
      <div className="flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Way
            icon={<CheckCircle2 className="size-5" />}
            title="Учёт времени в задачах — автоматически"
          >
            Если сотрудники запускают таймер или вносят время в задачах Битрикс24, часы
            подтягиваются сами: задачи проекта, задачи связанных сделок и заявок, встречи из
            календаря. Настраивать ничего не нужно.
          </Way>
          <Way icon={<SlidersHorizontal className="size-5" />} title="Свои поля — укажите ниже">
            Если время пишут не в задачах, а в пользовательские поля сделки или смарт-процесса
            (например, «Часы» и «Минуты»), добавьте раздел и выберите эти поля. Время из полей
            запишется на ответственного за элемент.
          </Way>
        </div>
        <section className="flex flex-col gap-3">
          <h2 className="tx-mark text-fg text-[15px]">
            Разделы с пользовательскими полями времени
          </h2>
          <TimeFieldsManager />
        </section>
      </div>
    </>
  );
}
