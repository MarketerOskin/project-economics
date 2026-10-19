import Link from 'next/link';
import { UpsellNotice } from '@/components/ui/upsell-notice';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export function AnalyticsUpsell() {
  return (
    <div className="px-4 py-6 sm:px-8">
      <UpsellNotice feature="Аналитика задач, часов и встреч" />
    </div>
  );
}

export function NoBitrixProjects({ unlinked }: { unlinked: Array<{ id: string; name: string }> }) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        title="Нет проектов, связанных с Битрикс24"
        description={
          unlinked.length
            ? 'Аналитика считается по задачам и встречам Битрикс24, а ваши проекты созданы вручную. Откройте проект ниже и на вкладке «Аналитика» свяжите его с проектом, сделкой или компанией в Битрикс24.'
            : 'Аналитика считается по задачам и встречам проектов из Битрикс24. Создайте проект через «Выбрать из Битрикс24».'
        }
        actions={
          unlinked.length ? undefined : (
            <Button asChild>
              <Link href="/projects/new">Новый проект</Link>
            </Button>
          )
        }
      />
      {unlinked.length ? <UnlinkedProjects items={unlinked} /> : null}
    </div>
  );
}

/** Projects made by hand: listed so they can be linked to Bitrix24 from their «Аналитика» tab. */
export function UnlinkedProjects({
  items,
  compact = false,
}: {
  items: Array<{ id: string; name: string }>;
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="border-border border border-dashed px-4 py-3 text-sm">
      {compact ? (
        <p className="text-fg-secondary mb-2">
          Не связаны с Битрикс24 и в аналитику не попадают ({items.length}). Свяжите их на вкладке
          «Аналитика» проекта:
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/projects/${p.id}/analytics`} className="text-accent hover:underline">
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Toolbar row under the tabs: period on the left, filters / export on the right. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>;
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="tx-mark text-fg text-[15px]">{title}</h2>
        {hint ? <p className="text-fg-tertiary mt-1 text-xs">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
