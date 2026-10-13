import type { PortalInstallation } from '@prisma/client';
import { batchBitrix, callBitrix } from './client';
import { semanticOf, stageEntityId } from './related';

/**
 * How many elements a CRM section got in a period and where they ended up (ADR-041): leads
 * as traffic, deals or a sales smart process as sales. Read live with crm.item.list; stage
 * meaning comes from crm.status.list, so custom stages count right.
 */

export interface SectionCounts {
  created: number;
  inWork: number;
  won: number;
  lost: number;
  /** Sum of `opportunity` of won elements, as a decimal string. */
  wonAmount: string;
  /** More than MAX_ITEMS elements: counts cover the first MAX_ITEMS. */
  truncated: boolean;
}

const PAGE = 50;
const MAX_ITEMS = 2000;

interface RawItem {
  id: number | string;
  stageId?: string | null;
  categoryId?: number | string | null;
  opportunity?: number | string | null;
}

/** Counts by stage meaning. Pure — exported for tests. Amounts are summed as strings by the caller. */
export function countBySemantic(
  items: Array<{ stageId: string | null; opportunity: string }>,
  semantics: Record<string, 'success' | 'fail' | 'process'>,
): { inWork: number; won: number; lost: number; wonAmounts: string[] } {
  const out = { inWork: 0, won: 0, lost: 0, wonAmounts: [] as string[] };
  for (const i of items) {
    const s = i.stageId ? (semantics[i.stageId] ?? semanticOf(null, i.stageId)) : 'process';
    if (s === 'success') {
      out.won++;
      out.wonAmounts.push(i.opportunity);
    } else if (s === 'fail') out.lost++;
    else out.inWork++;
  }
  return out;
}

export async function fetchSectionItems(
  portal: PortalInstallation,
  entityTypeId: number,
  from: Date,
  to: Date,
): Promise<{
  items: Array<{ stageId: string | null; opportunity: string }>;
  semantics: Record<string, 'success' | 'fail' | 'process'>;
  truncated: boolean;
}> {
  const raw: RawItem[] = [];
  let truncated = false;
  for (let start = 0; ; start += PAGE) {
    const res = await callBitrix<{ items?: RawItem[] }>(portal, 'crm.item.list', {
      entityTypeId,
      filter: { '>=createdTime': from.toISOString(), '<createdTime': to.toISOString() },
      select: ['id', 'stageId', 'categoryId', 'opportunity'],
      order: { id: 'asc' },
      start,
    });
    const page = res?.items ?? [];
    raw.push(...page);
    if (page.length < PAGE) break;
    if (raw.length >= MAX_ITEMS) {
      truncated = true;
      break;
    }
  }

  const entityIds = new Set<string>();
  for (const i of raw) {
    if (i.stageId)
      entityIds.add(
        stageEntityId(
          entityTypeId,
          i.categoryId != null && i.categoryId !== '' ? Number(i.categoryId) : null,
        ),
      );
  }
  const semantics: Record<string, 'success' | 'fail' | 'process'> = {};
  const list = [...entityIds];
  for (let i = 0; i < list.length; i += PAGE) {
    const chunk = list.slice(i, i + PAGE);
    const res = await batchBitrix(
      portal,
      Object.fromEntries(
        chunk.map((e, n) => [
          `s${n}`,
          { method: 'crm.status.list', params: { filter: { ENTITY_ID: e } } },
        ]),
      ),
    ).catch(() => ({}) as Record<string, unknown>);
    for (const v of Object.values(res ?? {})) {
      for (const st of Array.isArray(v)
        ? (v as Array<{ STATUS_ID: string; SEMANTICS?: string | null }>)
        : []) {
        semantics[st.STATUS_ID] = semanticOf(st.SEMANTICS, st.STATUS_ID);
      }
    }
  }

  return {
    items: raw.map((i) => ({
      stageId: i.stageId ?? null,
      opportunity: i.opportunity != null && i.opportunity !== '' ? String(i.opportunity) : '0',
    })),
    semantics,
    truncated,
  };
}
