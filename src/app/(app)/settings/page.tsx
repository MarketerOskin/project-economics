import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
import { TeamRates } from '@/components/settings/team-rates';
import { requirePageSession } from '@/server/page-session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function SettingsPage() {
  const { session, scope } = await requirePageSession();
  if (!can.manageSettings(session.actor)) redirect('/');

  const { portal, plan } = session;
  const [projects, entries, categories, auditEntries, users] = await Promise.all([
    scope.project.count(),
    scope.entry.count(),
    scope.category.count(),
    scope.audit.count(),
    scope.user.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  const bitrixConnected = Boolean(portal.authTokenEnc);
  const roleLabel: Record<string, string> = { ADMIN: 'Администратор', MANAGER: 'Менеджер', EMPLOYEE: 'Сотрудник' };

  const rows: Array<[string, React.ReactNode]> = [
    ['Портал Bitrix24', portal.isDemo ? 'Демо-портал' : portal.domain],
    ['member_id', <code key="m" className="text-xs">{portal.memberId}</code>],
    ['Приложение установлено', fmtDate(portal.installedAt)],
    ['Статус установки', portal.isActive ? 'Активно' : 'Отключено'],
    [
      'OAuth-подключение',
      portal.isDemo
        ? 'Не требуется (демо-режим)'
        : bitrixConnected
          ? `Подключено · токен действует до ${fmtDate(portal.tokenExpiresAt)}`
          : 'Не подключено — переустановите приложение на портале',
    ],
    ['REST endpoint', <code key="r" className="text-xs">{portal.restEndpoint ?? '—'}</code>],
    ['Режим демо-данных', portal.isDemo ? 'Включён' : 'Выключен'],
  ];

  return (
    <>
      <PageHeader title="Настройки" subtitle="Интеграция с Bitrix24, данные портала и команда" />

      <div className="flex flex-col gap-8 px-4 sm:px-8 py-6">
        <section className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold text-fg">Тариф</h2>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <div>
              <span className={plan === 'PRO' ? 'font-medium text-accent' : 'font-medium text-fg'}>
                {plan === 'PRO' ? 'Pro' : 'Free'}
              </span>
              {portal.planExpiresAt ? (
                <span className="ml-2 text-fg-tertiary">
                  до {new Date(portal.planExpiresAt).toLocaleDateString('ru-RU')}
                </span>
              ) : null}
              {plan === 'FREE' ? (
                <p className="mt-1 text-xs text-fg-tertiary">
                  До 3 активных проектов, без графиков и импорта из CRM Битрикс24
                </p>
              ) : null}
            </div>
            <Link href="/pricing" className="shrink-0 text-sm text-accent underline underline-offset-2">
              {plan === 'PRO' ? 'Тарифы' : 'Оформить Pro'}
            </Link>
          </div>
        </section>

        <section className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold text-fg">Интеграция и портал</h2>
          <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-6 px-4 py-3 text-sm">
                <dt className="text-fg-secondary">{label}</dt>
                <dd className="text-right text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold text-fg">Данные портала</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Проекты', projects],
              ['Операции', entries],
              ['Статьи', categories],
              ['Записей в истории', auditEntries],
            ].map(([label, n]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-2xl font-semibold tabular-nums">{n}</div>
                <div className="mt-0.5 text-xs text-fg-secondary">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-fg-secondary">
            Статьи доходов и расходов настраиваются на{' '}
            <Link href="/settings/categories" className="text-accent underline underline-offset-2">
              отдельной странице
            </Link>
            .
          </p>
        </section>

        <section className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold text-fg">Импорт проектов из CRM</h2>
          <p className="text-sm text-fg-secondary">
            У кого-то проекты — это сделки, у кого-то смарт-процессы. Настройте, откуда их
            можно импортировать, на{' '}
            <Link href="/settings/crm-sources" className="text-accent underline underline-offset-2">
              отдельной странице
            </Link>
            .
          </p>
        </section>

        <section className="max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold text-fg">Команда ({users.length})</h2>
          <TeamRates
            users={users.map((u) => ({
              id: u.id,
              fullName: `${u.firstName} ${u.lastName}`.trim() || u.bitrixUserId,
              position: u.position,
              roleLabel: roleLabel[u.role] ?? u.role,
              hourlyRate: u.hourlyRate?.toString() ?? null,
            }))}
          />
          <p className="mt-3 text-sm text-fg-secondary">
            Роли назначаются в Bitrix24: администратор портала получает роль «Администратор»
            автоматически. Права проверяются на сервере при каждом запросе. Часовая ставка
            используется для автоматического расчёта расхода по отработанным часам — см.{' '}
            <Link href="/time-drafts" className="text-accent underline underline-offset-2">
              «Часы к подтверждению»
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
