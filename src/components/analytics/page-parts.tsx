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

export function NoBitrixProjects() {
  return (
    <EmptyState
      title="Нет проектов из Битрикс24"
      description="Аналитика считается по задачам и встречам проектов, импортированных из Битрикс24: из раздела «Проекты» или из CRM. Создайте проект через «Выбрать из Битрикс24»."
      actions={
        <Button asChild>
          <Link href="/projects/new">Новый проект</Link>
        </Button>
      }
    />
  );
}

/** Toolbar row under the tabs: period on the left, filters / export on the right. */
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>;
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="tx-mark text-accent">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-fg-tertiary">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
