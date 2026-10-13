import type { Project } from '@prisma/client';
import type { ResolvedSession } from '@/lib/auth/resolve';
import type { PortalScope } from '@/lib/db/with-portal';
import { fetchRelatedItems, fetchUserNames, type RelatedGroup } from '@/lib/bitrix/related';
import { timeFieldMaps } from './analytics';

/**
 * Elements of other CRM types linked to a project's Bitrix24 entity (ADR-039), for the
 * project's «Аналитика» tab. Read live and kept for a few minutes, like the rest of analytics.
 * Items of a type with time fields mapped carry that time (ADR-040).
 */

const TTL_MS = 5 * 60_000;
const globalForCache = globalThis as unknown as {
  __relatedCache?: Map<
    string,
    { at: number; groups: RelatedGroup[]; names: Record<string, string> }
  >;
};
const cache = (globalForCache.__relatedCache ??= new Map());

export function invalidateRelated(portalId: string): void {
  for (const key of cache.keys()) if (key.startsWith(`${portalId}:`)) cache.delete(key);
}

export interface RelatedResult {
  groups: RelatedGroup[];
  /** Names of responsibles and workers the portal staff list doesn't have (fired people too). */
  names: Record<string, string>;
  error: string | null;
}

export async function loadRelated(
  session: ResolvedSession,
  scope: PortalScope,
  project: Project,
  known: Record<string, string>,
  opts: { refresh?: boolean } = {},
): Promise<RelatedResult> {
  if (
    session.demo ||
    project.sourceType !== 'BITRIX_CRM' ||
    !project.crmEntityTypeId ||
    !project.crmEntityId
  ) {
    return { groups: [], names: {}, error: null };
  }
  const key = `${session.portal.id}:${project.id}`;
  const hit = cache.get(key);
  if (!opts.refresh && hit && Date.now() - hit.at < TTL_MS)
    return { groups: hit.groups, names: hit.names, error: null };
  try {
    const timeFields = await timeFieldMaps(scope);
    const groups = await fetchRelatedItems(
      session.portal,
      project.crmEntityTypeId,
      project.crmEntityId,
      { timeFields },
    );
    const unknown = new Set<string>();
    for (const g of groups) {
      for (const i of g.items) {
        for (const uid of [i.assignedById, i.workerId]) if (uid && !known[uid]) unknown.add(uid);
      }
    }
    const names = unknown.size
      ? await fetchUserNames(session.portal, [...unknown]).catch(() => ({}))
      : {};
    cache.set(key, { at: Date.now(), groups, names });
    return { groups, names, error: null };
  } catch (err) {
    return {
      groups: hit?.groups ?? [],
      names: hit?.names ?? {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
