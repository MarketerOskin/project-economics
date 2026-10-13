import type { PortalInstallation } from '@prisma/client';
import type { CrmElement, StageSemantic } from '@/domain/finance/marketing';
import { batchBitrix, callBitrix } from './client';
import { semanticOf, stageEntityId } from './related';

/**
 * CRM reads for marketing and sales by channel (ADR-048): sources (crm.status.list SOURCE),
 * elements of a section with their source, manager and stage, and the stages' meaning and
 * order, so «qualified» can mean «past the first stage» on any funnel.
 */

const PAGE = 50;
/** Per section and query; beyond it the numbers say «+». */
export const MAX_ELEMENTS = 5000;

export interface StageInfo {
  id: string;
  name: string;
  semantic: StageSemantic;
  sort: number;
  /** crm.status.list ENTITY_ID: one funnel of one section. */
  funnel: string;
}

interface RawItem {
  id: number | string;
  stageId?: string | null;
  categoryId?: number | string | null;
  sourceId?: string | null;
  assignedById?: number | string | null;
  opportunity?: number | string | null;
  createdTime?: string | null;
  closedate?: string | null;
}

interface RawStatus {
  STATUS_ID: string;
  NAME: string;
  SORT?: string | number;
  SEMANTICS?: string | null;
}

/** Channel names by SOURCE_ID. */
export async function fetchSources(portal: PortalInstallation): Promise<Record<string, string>> {
  const rows = await callBitrix<RawStatus[]>(portal, 'crm.status.list', {
    filter: { ENTITY_ID: 'SOURCE' },
    order: { SORT: 'ASC' },
  });
  return Object.fromEntries((rows ?? []).map((r) => [r.STATUS_ID, r.NAME]));
}

/**
 * Elements of one section matching `filter` (crm.item.list), up to MAX_ELEMENTS, with the
 * stages they sit in. `closedate` is only meaningful for deals and smart processes.
 */
export async function fetchElements(
  portal: PortalInstallation,
  entityTypeId: number,
  filter: Record<string, unknown>,
): Promise<{ items: CrmElement[]; stages: Record<string, StageInfo>; truncated: boolean }> {
  const raw: RawItem[] = [];
  let truncated = false;
  const select = [
    'id',
    'stageId',
    'categoryId',
    'sourceId',
    'assignedById',
    'opportunity',
    'createdTime',
  ];
  if (entityTypeId !== 1) select.push('closedate');
  for (let start = 0; ; start += PAGE) {
    const res = await callBitrix<{ items?: RawItem[] }>(portal, 'crm.item.list', {
      entityTypeId,
      filter,
      select,
      order: { id: 'asc' },
      start,
    });
    const page = res?.items ?? [];
    raw.push(...page);
    if (page.length < PAGE) break;
    if (raw.length >= MAX_ELEMENTS) {
      truncated = true;
      break;
    }
  }

  const funnels = new Set<string>();
  const funnelOf = (i: RawItem) =>
    stageEntityId(
      entityTypeId,
      i.categoryId != null && i.categoryId !== '' ? Number(i.categoryId) : null,
    );
  for (const i of raw) if (i.stageId) funnels.add(funnelOf(i));
  const stages = await fetchStages(portal, [...funnels]);

  const items = raw.map((i): CrmElement => {
    const stageId = i.stageId ?? null;
    return {
      entityTypeId,
      id: String(i.id),
      sourceId: i.sourceId ? String(i.sourceId) : null,
      assignedById: i.assignedById != null && i.assignedById !== '' ? String(i.assignedById) : null,
      stageId,
      semantic: stageId ? (stages[stageId]?.semantic ?? semanticOf(null, stageId)) : 'process',
      opportunity: i.opportunity != null && i.opportunity !== '' ? String(i.opportunity) : '0',
      createdAt: new Date(i.createdTime ?? 0),
      closedAt: i.closedate ? new Date(i.closedate) : null,
    };
  });
  return { items, stages, truncated };
}

/** Stages of the given funnels (crm.status.list ENTITY_ID), by STATUS_ID. */
export async function fetchStages(
  portal: PortalInstallation,
  funnels: string[],
): Promise<Record<string, StageInfo>> {
  const out: Record<string, StageInfo> = {};
  for (let i = 0; i < funnels.length; i += PAGE) {
    const chunk = funnels.slice(i, i + PAGE);
    const res = await batchBitrix(
      portal,
      Object.fromEntries(
        chunk.map((e, n) => [
          `s${n}`,
          { method: 'crm.status.list', params: { filter: { ENTITY_ID: e } } },
        ]),
      ),
    ).catch(() => ({}) as Record<string, unknown>);
    chunk.forEach((funnel, n) => {
      const v = (res ?? {})[`s${n}`];
      for (const st of Array.isArray(v) ? (v as RawStatus[]) : []) {
        out[st.STATUS_ID] = {
          id: st.STATUS_ID,
          name: st.NAME,
          semantic: semanticOf(st.SEMANTICS, st.STATUS_ID),
          sort: Number(st.SORT ?? 0),
          funnel,
        };
      }
    });
  }
  return out;
}

/** The first in-work stage of every funnel: an element still there is not qualified yet. */
export function firstStages(stages: Record<string, StageInfo>): Set<string> {
  const first = new Map<string, StageInfo>();
  for (const s of Object.values(stages)) {
    if (s.semantic !== 'process') continue;
    const cur = first.get(s.funnel);
    if (!cur || s.sort < cur.sort) first.set(s.funnel, s);
  }
  return new Set([...first.values()].map((s) => s.id));
}
