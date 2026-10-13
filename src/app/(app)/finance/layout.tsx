import { SectionTabs } from '@/components/layout/section-tabs';

const TABS = [
  { href: '/finance/overview', label: 'Обзор' },
  { href: '/finance', label: 'Операции' },
];

/** «Финансы»: the money overview (the former main screen, ADR-049) and the operations list. */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={TABS} />
      {children}
    </>
  );
}
