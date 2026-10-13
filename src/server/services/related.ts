import type { Project } from '@prisma/client';
import type { ResolvedSession } from '@/lib/auth/resolve';
import { fetchRelatedItems, type RelatedGroup } from '@/lib/bitrix/related';

/**
 * Elements of other CRM types linked to a project's Bitrix24 entity (ADR-039), for the
 * project's «Аналитика» tab. Read live and kept for a few minutes, like the rest of analytics.
 */

const TTL_MS = 5 * 60_000;
const globalForCache = globalThis as unknown as {
  __relatedCache?: Map<string, { at: number; groups: RelatedGroup[] }>;
};
const cache = (globalForCache.__relatedCache ??= new Map());

export interface RelatedResult {
  groups: RelatedGroup[];
  error: string | null;
}

export async function loadRelated(
  session: ResolvedSession,
  project: Project,
  opts: { refresh?: boolean } = {},
): Promise<RelatedResult> {
  if (session.demo || project.sourceType !== 'BITRIX_CRM' || !project.crmEntityTypeId || !project.crmEntityId) {
    return { groups: [], error: null };
  }
  const key = `${session.portal.id}:${project.id}`;
  const hit = cache.get(key);
  if (!opts.refresh && hit && Date.now() - hit.at < TTL_MS) return { groups: hit.groups, error: null };
  try {
    const groups = await fetchRelatedItems(session.portal, project.crmEntityTypeId, project.crmEntityId);
    cache.set(key, { at: Date.now(), groups });
    return { groups, error: null };
  } catch (err) {
    return { groups: hit?.groups ?? [], error: err instanceof Error ? err.message : String(err) };
  }
}
