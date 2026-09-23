import type { PortalInstallation } from '@prisma/client';
import { batchBitrix, callBitrix } from './client';
import { ENTITY_TYPE_ID, type CrmItem } from './types';

export interface DealCategory {
  id: number;
  name: string;
}

/** Deal pipelines ("воронки") — e.g. "Первичные продажи" vs "Абонентское обслуживание". */
export async function listDealCategories(portal: PortalInstallation): Promise<DealCategory[]> {
  const res = await callBitrix<{ categories: Array<{ id: number | string; name: string }> }>(
    portal,
    'crm.category.list',
    { entityTypeId: ENTITY_TYPE_ID.DEAL },
  );
  return (res?.categories ?? []).map((c) => ({ id: Number(c.id), name: c.name }));
}

export interface DealSnapshotRow {
  categoryId: number;
  stageId: string;
  opportunity: string;
}

const PAGE_SIZE = 50;
/** Bitrix24's own cap on sub-commands per `batch` call. */
const PAGES_PER_BATCH = 50;
/** Safety ceiling: 400 batches x 50 pages x 50 items = 1,000,000 deals. A portal past this
 *  needs a smarter sync (by date range, incremental), not a full pull every night — flagged
 *  via `truncated`, never a silently incomplete number. */
const MAX_BATCHES = 400;

function toRow(it: CrmItem): DealSnapshotRow {
  return {
    categoryId: Number(it.categoryId ?? 0),
    stageId: String(it.stageId ?? ''),
    opportunity: it.opportunity ?? '0',
  };
}

/**
 * Every non-deleted deal. `crm.item.list` has no usable total/next through `callBitrix` (it
 * discards them — see ADR-029), so pagination stops on a short page, the standard Bitrix REST
 * convention. Pages are fetched PAGES_PER_BATCH at a time via Bitrix's `batch` method (up to 50
 * sub-calls per HTTP round trip) — a portal with several thousand deals would otherwise need
 * one HTTP call per 50 deals, which is slow enough to risk timing out a nightly job.
 */
export async function fetchAllDeals(portal: PortalInstallation): Promise<{ rows: DealSnapshotRow[]; truncated: boolean }> {
  const rows: DealSnapshotRow[] = [];
  let start = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const calls: Record<string, { method: string; params: Record<string, unknown> }> = {};
    for (let i = 0; i < PAGES_PER_BATCH; i++) {
      calls[`p${i}`] = {
        method: 'crm.item.list',
        params: {
          entityTypeId: ENTITY_TYPE_ID.DEAL,
          select: ['id', 'categoryId', 'stageId', 'opportunity'],
          order: { id: 'ASC' },
          start: start + i * PAGE_SIZE,
        },
      };
    }

    const result = await batchBitrix(portal, calls);
    let sawShortPage = false;
    for (let i = 0; i < PAGES_PER_BATCH; i++) {
      const page = result[`p${i}`] as { items?: CrmItem[] } | undefined;
      const items = page?.items ?? [];
      for (const it of items) rows.push(toRow(it));
      if (items.length < PAGE_SIZE) {
        sawShortPage = true;
        break; // a short page is always the last one Bitrix has (see ADR-029)
      }
    }
    if (sawShortPage) return { rows, truncated: false };
    start += PAGE_SIZE * PAGES_PER_BATCH;
  }

  return { rows, truncated: true };
}

/**
 * Bitrix24 stage-id convention: the default pipeline uses bare "WON"/"LOSE"; any other
 * pipeline prefixes its stages with "C{categoryId}:" (e.g. "C5:WON"). A custom-renamed stage
 * keeps this code even if its displayed title changes, so this is a reliable classification —
 * documented as a convention, not guaranteed by the API contract (ADR-029).
 */
export function classifyDealStage(stageId: string): 'WON' | 'LOST' | 'IN_PROGRESS' {
  const code = stageId.includes(':') ? stageId.split(':')[1] : stageId;
  if (code === 'WON') return 'WON';
  if (code === 'LOSE') return 'LOST';
  return 'IN_PROGRESS';
}
