import type { ResolvedSession } from '@/lib/auth/resolve';
import { isDemoMode } from '@/lib/auth/demo';
import { listCrmItems, getCrmItem, type NormalizedCrmItem } from '@/lib/bitrix/crm';
import { ENTITY_TYPE_ID } from '@/lib/bitrix/types';

const DEMO_ITEMS: Record<number, NormalizedCrmItem[]> = {
  [ENTITY_TYPE_ID.DEAL]: [
    { id: '101', title: 'Внедрение Bitrix24 — «Ортис»', clientName: 'ООО «Ортис»', url: 'https://demo.bitrix24.ru/crm/deal/details/101/', entityTypeId: 2 },
    { id: '102', title: 'Миграция данных — «Гелион»', clientName: 'АО «Гелион»', url: 'https://demo.bitrix24.ru/crm/deal/details/102/', entityTypeId: 2 },
    { id: '103', title: 'Доработка отчётов — «Кампус»', clientName: 'ООО «Кампус»', url: 'https://demo.bitrix24.ru/crm/deal/details/103/', entityTypeId: 2 },
  ],
  [ENTITY_TYPE_ID.COMPANY]: [
    { id: '201', title: 'ООО «Ортис»', clientName: 'ООО «Ортис»', url: 'https://demo.bitrix24.ru/crm/company/details/201/', entityTypeId: 4 },
    { id: '202', title: 'АО «Гелион»', clientName: 'АО «Гелион»', url: 'https://demo.bitrix24.ru/crm/company/details/202/', entityTypeId: 4 },
  ],
};

export async function browseCrm(
  session: ResolvedSession,
  entityTypeId: number,
  q?: string,
): Promise<NormalizedCrmItem[]> {
  if (isDemoMode() || session.demo) {
    const items = DEMO_ITEMS[entityTypeId] ?? [];
    return q ? items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase())) : items;
  }
  return listCrmItems(session.portal, entityTypeId, { q });
}

export async function resolveCrmItem(
  session: ResolvedSession,
  entityTypeId: number,
  id: string,
): Promise<NormalizedCrmItem | null> {
  if (isDemoMode() || session.demo) {
    return (DEMO_ITEMS[entityTypeId] ?? []).find((i) => i.id === id) ?? null;
  }
  return getCrmItem(session.portal, entityTypeId, id).catch(() => null);
}

