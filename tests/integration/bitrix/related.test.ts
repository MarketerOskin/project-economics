import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PortalInstallation } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { crmFieldPrefix, fetchRelatedItems, relationFieldsOf } from '@/lib/bitrix/related';
import { encryptToken } from '@/lib/bitrix/crypto';

process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');

const portal = {
  id: `p-${Math.random()}`,
  domain: 'it.bitrix24.ru',
  restEndpoint: 'https://it.bitrix24.ru/rest/',
  authTokenEnc: encryptToken('ACCESS'),
} as unknown as PortalInstallation;

// The shape of «Заявки BK» (1044) on a real portal: a parent link to 1048 and a `crm`
// user field «Проект» that allows only 1048, so it stores the bare id ("89").
const ZAYAVKI_FIELDS = {
  title: { type: 'string', title: 'Название' },
  parentId1048: { type: 'crm_entity', title: 'Отчет по проектам BK', settings: { parentEntityTypeId: 1048 } },
  companyId: { type: 'crm_company', title: 'Компания', settings: { parentEntityTypeId: 4 } },
  ufCrm33_1690796964: { type: 'crm', title: 'Проект', settings: { DYNAMIC_1048: 'Y', LEAD: null } },
  ufCrm1_multi: { type: 'crm', title: 'Связи', settings: { DEAL: 'Y', DYNAMIC_1048: 'Y' } },
};

describe('relationFieldsOf (ADR-039)', () => {
  it('finds the parent link and both crm fields that point at the project type', () => {
    const rels = relationFieldsOf(1044, 'Заявки BK', ZAYAVKI_FIELDS, 1048);
    expect(rels.map((r) => [r.field, r.valueFor('89')])).toEqual([
      ['parentId1048', '89'],
      ['ufCrm33_1690796964', '89'],
      ['ufCrm1_multi', 'T418_89'],
    ]);
  });

  it('a company project matches companyId and crm fields that allow companies', () => {
    const rels = relationFieldsOf(1044, 'Заявки BK', { ...ZAYAVKI_FIELDS, ufCo: { type: 'crm', title: 'Клиент', settings: { COMPANY: 'Y', CONTACT: 'Y' } } }, 4);
    expect(rels.map((r) => [r.field, r.valueFor('7')])).toEqual([
      ['companyId', '7'],
      ['ufCo', 'CO_7'],
    ]);
  });

  it('uses Bitrix24 prefixes, with smart processes in hex', () => {
    expect(crmFieldPrefix(2)).toBe('D');
    expect(crmFieldPrefix(4)).toBe('CO');
    expect(crmFieldPrefix(1048)).toBe('T418');
  });
});

describe('fetchRelatedItems (ADR-039)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists «Заявки BK» that point at project 89 with their stage names', async () => {
    const calls: Array<{ method: string; body: string }> = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const method = String(url).split('/').pop()!.replace('.json', '');
      const body = String((init as RequestInit).body ?? '');
      calls.push({ method, body });
      const ok = (result: unknown) => new Response(JSON.stringify({ result }), { status: 200 });
      if (method === 'crm.type.list') return ok({ types: [{ id: 45, title: 'Заявки BK', entityTypeId: 1044 }, { id: 47, title: 'Отчет по проектам BK', entityTypeId: 1048 }] });
      if (method === 'batch' && body.includes('crm.item.fields')) {
        return ok({ result: { f2: { fields: { title: { type: 'string' } } }, f1044: { fields: ZAYAVKI_FIELDS } } });
      }
      if (method === 'batch' && body.includes('crm.status.list')) {
        return ok({ result: { s0: [{ STATUS_ID: 'DT1044_55:CLIENT', NAME: 'У клиента', SEMANTICS: null }, { STATUS_ID: 'DT1044_55:SUCCESS', NAME: 'Готово', SEMANTICS: 'S' }] } });
      }
      if (method === 'crm.item.list') {
        const byProjectField = decodeURIComponent(body).includes('filter[ufCrm33_1690796964]=89');
        return ok({
          items: byProjectField
            ? [
                { id: 3097, title: 'Доработки по Дашборду', stageId: 'DT1044_55:CLIENT', categoryId: 55, assignedById: 7981, createdTime: '2026-10-12T06:45:36+03:00' },
                { id: 3001, title: 'Старая заявка', stageId: 'DT1044_55:SUCCESS', categoryId: 55, assignedById: 7981, createdTime: '2026-10-01T10:00:00+03:00' },
              ]
            : [],
        });
      }
      return ok(null);
    });

    const groups = await fetchRelatedItems(portal, 1048, '89');
    expect(groups).toHaveLength(1);
    const g = groups[0]!;
    expect(g.title).toBe('Заявки BK');
    expect(g.via).toEqual(['Проект']);
    expect(g.items.map((i) => i.id)).toEqual(['3097', '3001']);
    expect(g.items[0]!.url).toBe('https://it.bitrix24.ru/crm/type/1044/details/3097/');
    expect(g.stages['DT1044_55:CLIENT']).toEqual({ name: 'У клиента', semantic: 'process' });
    expect(g.stages['DT1044_55:SUCCESS']!.semantic).toBe('success');
    // The project's own type is never searched for links to itself.
    expect(calls.some((c) => c.method === 'batch' && c.body.includes('1048'))).toBe(false);
  });
});
