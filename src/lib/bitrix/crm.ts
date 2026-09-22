import type { PortalInstallation } from '@prisma/client';
import { callBitrix } from './client';
import { ENTITY_TYPE_ID, type BitrixCrmType, type CrmItem } from './types';

/** Custom Smart Process types start at 1000; below that are Bitrix24's own built-in entities. */
const SMART_PROCESS_ENTITY_TYPE_FLOOR = 1000;

/** Every Smart Process defined on the portal (crm.type.list), for the "add a source" picker. */
export async function listSmartProcessTypes(portal: PortalInstallation): Promise<BitrixCrmType[]> {
  const res = await callBitrix<{ types: BitrixCrmType[] }>(portal, 'crm.type.list');
  return (res?.types ?? []).filter((t) => t.entityTypeId >= SMART_PROCESS_ENTITY_TYPE_FLOOR);
}

export interface NormalizedCrmItem {
  id: string;
  title: string;
  clientName: string | null;
  url: string;
  entityTypeId: number;
}

function itemUrl(domain: string, entityTypeId: number, id: string): string {
  const path =
    entityTypeId === ENTITY_TYPE_ID.DEAL
      ? `crm/deal/details/${id}/`
      : entityTypeId === ENTITY_TYPE_ID.COMPANY
        ? `crm/company/details/${id}/`
        : `crm/type/${entityTypeId}/details/${id}/`;
  return `https://${domain}/${path}`;
}

/** crm.item.list for Deal (2) or Company (4). Optional title search. */
export async function listCrmItems(
  portal: PortalInstallation,
  entityTypeId: number,
  opts: { q?: string; start?: number } = {},
): Promise<NormalizedCrmItem[]> {
  const filter: Record<string, unknown> = {};
  if (opts.q) filter['%title'] = opts.q;

  const res = await callBitrix<{ items: CrmItem[] }>(portal, 'crm.item.list', {
    entityTypeId,
    filter,
    select: ['id', 'title', 'companyId'],
    order: { id: 'DESC' },
    start: opts.start ?? 0,
  });

  const items = res?.items ?? [];
  return items.map((it) => ({
    id: String(it.id),
    title: it.title ?? `#${it.id}`,
    clientName: null,
    url: itemUrl(portal.domain, entityTypeId, String(it.id)),
    entityTypeId,
  }));
}

/** crm.item.get for one entity, with the client name resolved when unambiguous. */
export async function getCrmItem(
  portal: PortalInstallation,
  entityTypeId: number,
  id: string,
): Promise<NormalizedCrmItem> {
  const res = await callBitrix<{ item: CrmItem }>(portal, 'crm.item.get', { entityTypeId, id });
  const item = res.item;

  let clientName: string | null = null;
  if (entityTypeId === ENTITY_TYPE_ID.COMPANY) {
    clientName = item.title ?? null;
  } else if (entityTypeId !== ENTITY_TYPE_ID.COMPANY && item.companyId) {
    // Deals always carry companyId; a Smart Process only does when the portal linked it —
    // both are handled the same way once the field is present (real example: "Заявки BK").
    try {
      const company = await callBitrix<{ item: CrmItem }>(portal, 'crm.item.get', {
        entityTypeId: ENTITY_TYPE_ID.COMPANY,
        id: item.companyId,
      });
      clientName = company.item.title ?? null;
    } catch {
      clientName = null;
    }
  }

  return {
    id: String(item.id),
    title: item.title ?? `#${item.id}`,
    clientName,
    url: itemUrl(portal.domain, entityTypeId, String(item.id)),
    entityTypeId,
  };
}
