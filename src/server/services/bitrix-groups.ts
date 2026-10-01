import type { ResolvedSession } from '@/lib/auth/resolve';
import { isDemoMode } from '@/lib/auth/demo';
import { listBitrixProjectGroups, getBitrixProjectGroup, type NormalizedBitrixGroup } from '@/lib/bitrix/groups';

const DEMO_GROUPS: NormalizedBitrixGroup[] = [
  { id: '11', title: 'Запуск нового склада — Пермь', url: 'https://demo.bitrix24.ru/workgroups/group/11/' },
  { id: '12', title: 'Редизайн сайта «Гелион»', url: 'https://demo.bitrix24.ru/workgroups/group/12/' },
];

export async function browseBitrixProjectGroups(session: ResolvedSession, q?: string): Promise<NormalizedBitrixGroup[]> {
  if (isDemoMode() || session.demo) {
    return q ? DEMO_GROUPS.filter((g) => g.title.toLowerCase().includes(q.toLowerCase())) : DEMO_GROUPS;
  }
  return listBitrixProjectGroups(session.portal, { q });
}

export async function resolveBitrixProjectGroup(session: ResolvedSession, id: string): Promise<NormalizedBitrixGroup | null> {
  if (isDemoMode() || session.demo) {
    return DEMO_GROUPS.find((g) => g.id === id) ?? null;
  }
  return getBitrixProjectGroup(session.portal, id).catch(() => null);
}
