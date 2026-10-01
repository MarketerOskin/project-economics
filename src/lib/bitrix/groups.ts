import type { PortalInstallation } from '@prisma/client';
import { callBitrix } from './client';

export interface NormalizedBitrixGroup {
  id: string;
  title: string;
  url: string;
}

interface BitrixGroupRaw {
  ID: string | number;
  NAME: string;
}

function groupUrl(domain: string, id: string): string {
  return `https://${domain}/workgroups/group/${id}/`;
}

/**
 * Bitrix24's native "Проекты" module (sonet_group with PROJECT=Y) — a separate REST domain
 * from crm.item.*, no entityTypeId involved (ADR-031). Only active projects, not plain
 * workgroups (PROJECT=N).
 */
export async function listBitrixProjectGroups(
  portal: PortalInstallation,
  opts: { q?: string } = {},
): Promise<NormalizedBitrixGroup[]> {
  const filter: Record<string, unknown> = { PROJECT: 'Y', ACTIVE: 'Y' };
  if (opts.q) filter['%NAME'] = opts.q;

  const res = await callBitrix<BitrixGroupRaw[]>(portal, 'sonet_group.get', {
    FILTER: filter,
    SELECT: ['ID', 'NAME'],
    ORDER: { ID: 'DESC' },
  });

  return (res ?? []).map((g) => ({
    id: String(g.ID),
    title: g.NAME,
    url: groupUrl(portal.domain, String(g.ID)),
  }));
}

/** One group by id, for snapshotting onto a Project at creation time. */
export async function getBitrixProjectGroup(
  portal: PortalInstallation,
  id: string,
): Promise<NormalizedBitrixGroup | null> {
  const res = await callBitrix<BitrixGroupRaw[]>(portal, 'sonet_group.get', {
    FILTER: { ID: id },
    SELECT: ['ID', 'NAME'],
  });
  const group = res?.[0];
  if (!group) return null;
  return { id: String(group.ID), title: group.NAME, url: groupUrl(portal.domain, String(group.ID)) };
}
