import { SectionTabs } from '@/components/layout/section-tabs';

const TABS = [
  { href: '/marketing', label: 'Маркетинг' },
  { href: '/marketing/sales', label: 'Продажи' },
  { href: '/marketing/funnels', label: 'Продажи и обращения' },
];

/** «Маркетинг и продажи» (ADR-049): channels, sales by source, funnels and requests. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="sr-only">Маркетинг и продажи</h1>
      <SectionTabs tabs={TABS} />
      {children}
    </>
  );
}
