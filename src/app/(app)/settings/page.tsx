import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/app-shell';
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

  const { portal } = session;
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

      <div className="flex flex-col gap-8 px-8 py-6">
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
          <h2 className="mb-3 text-sm font-semibold text-fg">Команда ({users.length})</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-fg">
                  {`${u.firstName} ${u.lastName}`.trim() || u.bitrixUserId}
                  {u.position ? <span className="ml-2 text-xs text-fg-secondary">{u.position}</span> : null}
                </span>
                <span className="text-xs text-fg-secondary">{roleLabel[u.role] ?? u.role}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-fg-secondary">
            Роли назначаются в Bitrix24: администратор портала получает роль «Администратор»
            автоматически. Права проверяются на сервере при каждом запросе.
          </p>
        </section>
      </div>
    </>
  );
}
