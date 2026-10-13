import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PortalInstallation } from '@prisma/client';
import { fetchTasks } from '@/lib/bitrix/analytics';
import { encryptToken } from '@/lib/bitrix/crypto';

const portal = {
  id: 'p-paging',
  domain: 'x.bitrix24.ru',
  restEndpoint: 'https://x.bitrix24.ru/rest/',
  authTokenEnc: encryptToken('ACCESS'),
} as unknown as PortalInstallation;

const page = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: from + i,
    title: `t${from + i}`,
    status: '5',
    createdDate: '2026-09-01T10:00:00+03:00',
  }));

describe('fetchTasks paging (ADR-057)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the pages after the first in one batch request', async () => {
    const methods: string[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const method = String(input).split('/').pop()!.replace('.json', '');
      methods.push(method);
      const body =
        method === 'batch'
          ? {
              result: {
                result: {
                  p50: { tasks: page(51, 50) },
                  p100: { tasks: page(101, 7) },
                  p150: { tasks: [] },
                },
              },
            }
          : { result: { tasks: page(1, 50) } };
      return new Response(JSON.stringify(body), { status: 200 });
    });

    const tasks = await fetchTasks(portal, { kind: 'crm', bindings: ['D_1'] }, 'proj');
    expect(tasks).toHaveLength(107);
    expect(methods).toEqual(['tasks.task.list', 'batch']);
  });

  it('a small project needs one call', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ result: { tasks: page(1, 3) } }), { status: 200 }),
      );
    expect(await fetchTasks(portal, { kind: 'crm', bindings: ['D_1'] }, 'proj')).toHaveLength(3);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
