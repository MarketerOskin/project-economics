import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { BrandForm } from '@/components/settings/brand-form';
import { requirePageSession } from '@/server/page-session';
import { getBrand } from '@/server/services/brand';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** The installing company's look for client-facing reports (ADR-054). */
export default async function BrandPage() {
  const { session, scope } = await requirePageSession();
  if (!can.manageSettings(session.actor)) redirect('/');
  const brand = await getBrand(scope);

  return (
    <>
      <PageHeader
        title="Бренд для отчётов"
        subtitle="Как выглядят отчёты, которые вы отправляете клиентам"
      />
      <div className="flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-8">
        <p className="text-fg-secondary max-w-3xl text-sm">
          Отчёт о выполненных работах выходит от имени вашей компании: с вашим логотипом, цветом,
          контактами, реквизитами и подписью. Данные можно подтянуть из «Моей компании» в CRM
          Битрикс24 и поправить перед сохранением.
        </p>
        <BrandForm initial={brand} />
      </div>
    </>
  );
}
