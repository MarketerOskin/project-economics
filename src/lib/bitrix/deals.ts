import type { PortalInstallation } from '@prisma/client';
import { callBitrix } from './client';
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

/** Safety cap: 100 pages x 50 = 5000 deals. A portal past this needs a smarter sync (paged
 *  by date range, incremental), not a full-portal pull every night — flagged, not silent. */
const MAX_PAGES = 100;
const PAGE_SIZE = 50;

/** Every non-deleted deal, paginated (crm.item.list has no usable total/next through callBitrix
 *  — see ADR-029 — so pagination stops on a short page, the standard Bitrix REST convention). */
export async function fetchAllDeals(portal: PortalInstallation): Promise<{ rows: DealSnapshotRow[]; truncated: boolean }> {
  const rows: DealSnapshotRow[] = [];
  let start = 0;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await callBitrix<{ items: CrmItem[] }>(portal, 'crm.item.list', {
      entityTypeId: ENTITY_TYPE_ID.DEAL,
      select: ['id', 'categoryId', 'stageId', 'opportunity'],
      order: { id: 'ASC' },
      start,
    });
    const items = res?.items ?? [];
    for (const it of items) {
      rows.push({
        categoryId: Number(it.categoryId ?? 0),
        stageId: String(it.stageId ?? ''),
        opportunity: it.opportunity ?? '0',
      });
    }
    if (items.length < PAGE_SIZE) {
      return { rows, truncated: false };
    }
    start += PAGE_SIZE;
  }

  truncated = true;
  return { rows, truncated };
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
