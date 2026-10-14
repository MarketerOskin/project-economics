import { describe, expect, it } from 'vitest';
import { m } from '@/domain/finance/money';
import {
  adjustSpend,
  averageCycleDays,
  channelReport,
  isQualified,
  planFact,
  reversePlan,
  salesBreakdown,
  type CrmElement,
} from '@/domain/finance/marketing';
import { firstStages } from '@/lib/bitrix/marketing';
import { tableToCsv } from '@/server/services/marketing-export';

let seq = 0;
function el(p: Partial<CrmElement>): CrmElement {
  return {
    entityTypeId: 2,
    id: String(++seq),
    sourceId: 'WEB',
    assignedById: '1',
    stageId: 'NEW',
    semantic: 'process',
    opportunity: '0',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    closedAt: null,
    ...p,
  };
}

describe('channelReport (ADR-048)', () => {
  it('counts CPL, CPL-2 and CAC from spent budget only, not top-ups', () => {
    const { rows, total } = channelReport({
      sourceNames: { WEB: 'Сайт', UC_Y: 'Яндекс' },
      leads: [
        { ...el({ sourceId: 'UC_Y' }), qualified: true },
        { ...el({ sourceId: 'UC_Y' }), qualified: false },
        { ...el({ sourceId: 'UC_Y' }), qualified: true },
        { ...el({ sourceId: 'UC_Y' }), qualified: false },
        { ...el({ sourceId: null }), qualified: false },
      ],
      won: [el({ sourceId: 'UC_Y', semantic: 'success', opportunity: '50000' })],
      spends: [
        { sourceId: 'UC_Y', kind: 'SPENT', amount: m('10000') },
        { sourceId: 'UC_Y', kind: 'PAID', amount: m('30000') },
      ],
    });
    const y = rows.find((r) => r.sourceId === 'UC_Y')!;
    expect(y.name).toBe('Яндекс');
    expect(y.cpl!.toString()).toBe('2500');
    expect(y.cpl2!.toString()).toBe('5000');
    expect(y.cac!.toString()).toBe('10000');
    expect(y.paid.toString()).toBe('30000');
    expect(y.leadToQualified!.toString()).toBe('50');
    expect(y.romi!.toString()).toBe('400');
    expect(rows[0]!.sourceId).toBe('UC_Y');
    const none = rows.find((r) => r.sourceId === '')!;
    expect(none.name).toBe('Без источника');
    expect(none.cpl).toBeNull();
    expect(total.leads).toBe(5);
    expect(total.cpl!.toString()).toBe('2000');
  });

  it('has no ratios at all when nothing happened', () => {
    const { rows, total } = channelReport({ sourceNames: {}, leads: [], won: [], spends: [] });
    expect(rows).toEqual([]);
    expect([total.cpl, total.cac, total.romi, total.leadToSale]).toEqual([null, null, null, null]);
  });
});

describe('isQualified', () => {
  const first = new Set(['NEW']);
  it('by default: past the first stage or converted, never failed', () => {
    expect(isQualified({ stageId: 'NEW', semantic: 'process' }, new Set(), first)).toBe(false);
    expect(isQualified({ stageId: 'IN_PROCESS', semantic: 'process' }, new Set(), first)).toBe(
      true,
    );
    expect(isQualified({ stageId: 'CONVERTED', semantic: 'success' }, new Set(), first)).toBe(true);
    expect(isQualified({ stageId: 'JUNK', semantic: 'fail' }, new Set(), first)).toBe(false);
  });
  it('picked stages win over the default', () => {
    const picked = new Set(['JUNK']);
    expect(isQualified({ stageId: 'JUNK', semantic: 'fail' }, picked, first)).toBe(true);
    expect(isQualified({ stageId: 'CONVERTED', semantic: 'success' }, picked, first)).toBe(false);
  });
  it('first stages are the lowest in-work stage per funnel', () => {
    const s = firstStages({
      NEW: { id: 'NEW', name: 'Новый', semantic: 'process', sort: 10, funnel: 'STATUS' },
      IN: { id: 'IN', name: 'В работе', semantic: 'process', sort: 20, funnel: 'STATUS' },
      C1: { id: 'C1:NEW', name: 'Новая', semantic: 'process', sort: 5, funnel: 'DEAL_STAGE_1' },
      F: { id: 'F', name: 'Провал', semantic: 'fail', sort: 1, funnel: 'STATUS' },
    });
    expect([...s].sort()).toEqual(['C1:NEW', 'NEW']);
  });
});

describe('planFact and reversePlan', () => {
  it('forecasts the month at the current pace', () => {
    const rows = planFact(
      { budget: m('300000'), leads: 300, qualified: null, sales: 30 },
      { spent: m('100000'), leads: 90, qualified: 40, sales: 12 },
      10,
      30,
    );
    expect(
      rows.map((r) => [
        r.key,
        r.plan?.toString() ?? null,
        r.fact.toString(),
        r.done?.toFixed(1) ?? null,
        r.forecast.toString(),
      ]),
    ).toEqual([
      ['budget', '300000', '100000', '33.3', '300000'],
      ['leads', '300', '90', '30.0', '270'],
      ['qualified', null, '40', null, '120'],
      ['sales', '30', '12', '40.0', '36'],
    ]);
  });
  it('a finished month forecasts its fact; a future one zero', () => {
    const fact = { spent: m('5'), leads: 5, qualified: 2, sales: 1 };
    const plan = { budget: null, leads: null, qualified: null, sales: null };
    expect(planFact(plan, fact, 31, 31)[1]!.forecast.toString()).toBe('5');
    expect(planFact(plan, fact, 0, 31)[1]!.forecast.toString()).toBe('0');
  });
  it('reverse plan goes from sales back to leads and budget, rounding up', () => {
    const r = reversePlan(10, {
      qualifiedToSale: m('30'),
      leadToQualified: m('40'),
      cpl: m('1000'),
    });
    expect(r).toEqual({ qualified: 34, leads: 85, budget: m('85000') });
    expect(
      reversePlan(10, { qualifiedToSale: null, leadToQualified: m('40'), cpl: m('1') }),
    ).toEqual({
      qualified: null,
      leads: null,
      budget: null,
    });
  });
});

describe('salesBreakdown', () => {
  it('cohort outcomes from created, sales and revenue from won in the period', () => {
    const created = [
      el({ sourceId: 'A', semantic: 'success', opportunity: '100' }),
      el({ sourceId: 'A', semantic: 'fail' }),
      el({ sourceId: 'A' }),
      el({ sourceId: 'B' }),
    ];
    const won = [
      el({ sourceId: 'A', semantic: 'success', opportunity: '300' }),
      el({ sourceId: 'A', semantic: 'success', opportunity: '100' }),
    ];
    const rows = salesBreakdown(
      created,
      won,
      (e) => e.sourceId,
      (k) => `src ${k}`,
    );
    expect(rows[0]).toMatchObject({
      key: 'A',
      name: 'src A',
      created: 3,
      inWork: 1,
      won: 1,
      lost: 1,
      sales: 2,
    });
    expect(rows[0]!.conversion!.toFixed(1)).toBe('33.3');
    expect(rows[0]!.revenue.toString()).toBe('400');
    expect(rows[0]!.avgCheck!.toString()).toBe('200');
    expect(rows[1]).toMatchObject({ key: 'B', created: 1, sales: 0, avgCheck: null });
  });
  it('average cycle in days', () => {
    expect(
      averageCycleDays([
        el({
          createdAt: new Date('2026-10-01T00:00:00Z'),
          closedAt: new Date('2026-10-05T00:00:00Z'),
        }),
        el({
          createdAt: new Date('2026-10-01T00:00:00Z'),
          closedAt: new Date('2026-10-02T00:00:00Z'),
        }),
        el({ closedAt: null }),
      ]),
    ).toBe(2.5);
    expect(averageCycleDays([])).toBeNull();
  });
});

describe('CSV export', () => {
  it('semicolons, decimal comma, BOM, quoting', () => {
    const csv = tableToCsv({
      name: 't',
      columns: [
        { header: 'Канал', width: 1 },
        { header: 'Сумма', width: 1 },
      ],
      rows: [
        ['Сайт; лендинг', 1500.5],
        ['Без суммы', null],
      ],
    });
    expect(csv).toBe('﻿Канал;Сумма\r\n"Сайт; лендинг";1500,5\r\nБез суммы;\r\n');
  });
});

describe('adjustSpend (ADR-060)', () => {
  it('adds, takes off, and refuses to go below zero', () => {
    expect(adjustSpend(m('0'), m('500'), false)?.toFixed(2)).toBe('500.00');
    expect(adjustSpend(m('1000'), m('300.5'), true)?.toFixed(2)).toBe('699.50');
    expect(adjustSpend(m('1000'), m('1000'), true)?.toFixed(2)).toBe('0.00');
    expect(adjustSpend(m('1000'), m('1000.01'), true)).toBeNull();
  });
});
