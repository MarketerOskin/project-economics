import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Calculator, Clock, Database, ListChecks, Palette, SlidersHorizontal, Tags } from 'lucide-react';
import { PageHeader } from '@/components/layout/app-shell';
import { TeamRates } from '@/components/settings/team-rates';
import { requirePageSession } from '@/server/page-session';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
}

interface SettingsLink {
  href: string;
  title: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}

function SettingsLinks({ links }: { links: SettingsLink[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="group flex gap-3 border border-border bg-surface p-4 transition-colors hover:border-accent"
        >
          <l.icon className="mt-0.5 size-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 font-medium text-fg group-hover:text-accent">
              {l.title}
              <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="mt-1 block text-sm text-fg-secondary">{l.text}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default async function SettingsPage() {
  const { session, scope } = await requirePageSession();
  const admin = can.manageSettings(session.actor);
  if (!admin && !can.mutateFinance(session.actor)) redirect('/');

  const links: SettingsLink[] = [
    ...(session.portal.disabledSections.includes('automation')
      ? []
      : [
          {
            href: '/settings/auto-finance',
            title: 'Авторасчёт финансов',
            text: 'Доход и расход поддержки по часам, расходы по задачам и доход из сделок, без ручного ввода',
            icon: Calculator,
          },
        ]),
    { href: '/settings/categories', title: 'Статьи доходов и расходов', text: 'Справочник статей для операций', icon: Tags },
    ...(admin
      ? [
          {
            href: '/setup',
            title: 'Настройка под портал',
            text: 'Для чего у вас лиды, сделки и смарт-процессы, какие разделы показывать',
            icon: SlidersHorizontal,
          },
          {
            href: '/settings/crm-sources',
            title: 'Импорт проектов из CRM',
            text: 'Из каких разделов Битрикс24 можно создавать проекты',
            icon: Database,
          },
          {
            href: '/settings/stages',
            title: 'Стадии CRM',
            text: 'Какие стадии смарт-процессов и сделок считать в работе, закрытыми, успешными и отменёнными',
            icon: ListChecks,
          },
          {
            href: '/settings/brand',
            title: 'Бренд для отчётов',
            text: 'Логотип, цвет и реквизиты вашей компании в отчётах для клиентов',
            icon: Palette,
          },
          {
            href: '/settings/time-fields',
            title: 'Учёт времени',
            text: 'Поля CRM, из которых брать часы и минуты, если время пишут не в задачах',
            icon: Clock,
          },
        ]
      : []),
  ];

  if (!admin) {
    return (
      <>
        <PageHeader title="Настройки" subtitle="Расчёты и справочники" />
        <div className="px-4 py-6 sm:px-8">
          <SettingsLinks links={links} />
        </div>
      </>
    );
  }

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
        <SettingsLinks links={links} />

        <section className="max-w-2xl">
          <h2 className="tx-mark mb-3 text-accent">Тариф</h2>
          <div className="flex items-center justify-between border border-border bg-surface px-4 py-3 text-sm">
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
          <h2 className="tx-mark mb-3 text-accent">Интеграция и портал</h2>
          <dl className="divide-y divide-border border border-border bg-surface">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-6 px-4 py-3 text-sm">
                <dt className="text-fg-secondary">{label}</dt>
                <dd className="text-right text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="max-w-2xl">
          <h2 className="tx-mark mb-3 text-accent">Данные портала</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Проекты', projects],
              ['Операции', entries],
              ['Статьи', categories],
              ['Записей в истории', auditEntries],
            ].map(([label, n]) => (
              <div key={String(label)} className="border border-border bg-surface px-4 py-3">
                <div className="text-2xl font-semibold tabular-nums">{n}</div>
                <div className="mt-0.5 text-xs text-fg-secondary">{label}</div>
              </div>
            ))}
          </div>
        </section>




        <section id="team" className="max-w-2xl scroll-mt-4">
          <h2 className="tx-mark mb-3 text-accent">Команда ({users.length})</h2>
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
            используется для расчёта расхода по отработанным часам — см.{' '}
            <Link href="/settings/auto-finance" className="text-accent underline underline-offset-2">
              «Авторасчёт финансов»
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
