import type { CrmElement, StageSemantic } from '@/domain/finance/marketing';
import type { StageInfo } from '@/lib/bitrix/marketing';

/**
 * Demo-portal leads and deals for «Маркетинг» and «Продажи» (ADR-048): the same numbers on
 * every load for a given day, so screenshots and walkthroughs stay stable.
 */

export const DEMO_SOURCES: Record<string, string> = {
  CALL: 'Звонок',
  WEB: 'Веб-сайт',
  ADVERTISING: 'Реклама',
  RECOMMENDATION: 'По рекомендации',
  UC_YANDEX: 'Яндекс Директ',
  UC_VK: 'VK Реклама',
  UC_AVITO: 'Авито',
};

/** Daily leads, qualification and sale odds, average check per channel. */
const PROFILE: Record<string, { leads: number; qual: number; sale: number; check: number }> = {
  UC_YANDEX: { leads: 3.2, qual: 0.42, sale: 0.3, check: 180_000 },
  UC_VK: { leads: 2.1, qual: 0.3, sale: 0.22, check: 140_000 },
  UC_AVITO: { leads: 1.6, qual: 0.35, sale: 0.25, check: 90_000 },
  WEB: { leads: 1.2, qual: 0.5, sale: 0.35, check: 210_000 },
  RECOMMENDATION: { leads: 0.5, qual: 0.8, sale: 0.55, check: 260_000 },
  CALL: { leads: 0.8, qual: 0.45, sale: 0.3, check: 120_000 },
};

export const DEMO_STAGES: Record<string, StageInfo> = Object.fromEntries(
  (
    [
      ['NEW', 'Новый', 'process', 10, 'STATUS'],
      ['IN_PROCESS', 'В работе', 'process', 20, 'STATUS'],
      ['PROCESSED', 'Квалифицирован', 'process', 30, 'STATUS'],
      ['CONVERTED', 'Сделка', 'success', 40, 'STATUS'],
      ['JUNK', 'Некачественный', 'fail', 50, 'STATUS'],
      ['NEW_D', 'Новая', 'process', 10, 'DEAL_STAGE'],
      ['PREPARATION', 'КП отправлено', 'process', 20, 'DEAL_STAGE'],
      ['WON', 'Сделка успешна', 'success', 60, 'DEAL_STAGE'],
      ['LOSE', 'Сделка провалена', 'fail', 70, 'DEAL_STAGE'],
    ] as Array<[string, string, StageSemantic, number, string]>
  ).map(([id, name, semantic, sort, funnel]) => [id, { id, name, semantic, sort, funnel }]),
);

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const DAY = 86_400_000;

/** Leads created and deals created in [start, end), never past `now`. */
export function demoElements(
  start: Date,
  end: Date,
  now: Date,
  managers: string[],
): { leads: CrmElement[]; deals: CrmElement[] } {
  const leads: CrmElement[] = [];
  const deals: CrmElement[] = [];
  const stop = Math.min(end.getTime(), now.getTime());
  const people = managers.length ? managers : ['1'];
  for (let t = Math.floor(start.getTime() / DAY) * DAY; t < stop; t += DAY) {
    const day = Math.floor(t / DAY);
    for (const [sourceId, p] of Object.entries(PROFILE)) {
      const r = rng(day * 131 + sourceId.length * 7919 + sourceId.charCodeAt(sourceId.length - 1));
      const count = Math.floor(p.leads + r() * 1.6 - 0.4);
      for (let n = 0; n < count; n++) {
        const createdAt = new Date(t + Math.floor(r() * DAY * 0.6) + DAY * 0.3);
        if (createdAt.getTime() < start.getTime() || createdAt.getTime() >= stop) continue;
        const age = (now.getTime() - createdAt.getTime()) / DAY;
        const qualified = r() < p.qual;
        const assignedById = people[Math.floor(r() * people.length)]!;
        const sold = qualified && r() < (p.sale / p.qual) * 0.6;
        const lostDeal = qualified && !sold && r() < 0.6;
        const id = `${day}-${sourceId}-${n}`;
        const leadStage = qualified
          ? 'CONVERTED'
          : age < 2
            ? 'NEW'
            : r() < 0.6
              ? 'JUNK'
              : 'IN_PROCESS';
        leads.push({
          entityTypeId: 1,
          id: `L${id}`,
          sourceId,
          assignedById,
          stageId: leadStage,
          semantic: DEMO_STAGES[leadStage]!.semantic,
          opportunity: '0',
          createdAt,
          closedAt: null,
        });
        if (!qualified) continue;
        const cycle = 3 + Math.floor(r() * 18);
        const closed = (sold || lostDeal) && age > cycle;
        const stageId = closed ? (sold ? 'WON' : 'LOSE') : age > 3 ? 'PREPARATION' : 'NEW_D';
        const check = Math.round((p.check * (0.6 + r() * 0.8)) / 1000) * 1000;
        deals.push({
          entityTypeId: 2,
          id: `D${id}`,
          sourceId,
          assignedById,
          stageId,
          semantic: DEMO_STAGES[stageId]!.semantic,
          opportunity: String(check),
          createdAt: new Date(createdAt.getTime() + DAY * 0.2),
          closedAt: closed ? new Date(createdAt.getTime() + cycle * DAY) : null,
        });
      }
    }
  }
  return { leads, deals };
}

/** Demo spend for a month: a steady daily budget per paid channel. */
export const DEMO_DAILY_BUDGET: Record<string, number> = {
  UC_YANDEX: 9_500,
  UC_VK: 5_200,
  UC_AVITO: 3_100,
  ADVERTISING: 0,
};
