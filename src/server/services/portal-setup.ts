import type { CrmRole, PortalInstallation } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import { db } from '@/lib/db/client';
import { listSmartProcessTypes } from '@/lib/bitrix/crm';
import { ENTITY_TYPE_ID } from '@/lib/bitrix/types';
import { badRequest } from '@/lib/errors';
import type { SaveSetupInput } from '@/server/dto/setup';

/**
 * «Настройка под портал» (ADR-041): what each CRM section is for and which app sections the
 * portal uses. Every portal is wired differently — leads may be all traffic, deals first
 * sales, a smart process client support — so the app asks once instead of guessing.
 */

export const LEAD_ENTITY_TYPE_ID = 1;

export interface CrmSection {
  entityTypeId: number;
  title: string;
  role: CrmRole;
  /** No role saved yet: `role` is the default. */
  isDefault: boolean;
}

export function defaultRole(entityTypeId: number): CrmRole {
  if (entityTypeId === LEAD_ENTITY_TYPE_ID) return 'TRAFFIC';
  if (entityTypeId === ENTITY_TYPE_ID.DEAL) return 'SALES';
  return 'PROJECTS';
}

/** Leads, deals and every smart process, with the portal's role for each. */
export async function listCrmSections(
  portal: PortalInstallation,
  scope: PortalScope,
): Promise<CrmSection[]> {
  const [smart, saved] = await Promise.all([
    listSmartProcessTypes(portal),
    scope.crmSectionRole.findMany(),
  ]);
  const byType = new Map(saved.map((r) => [r.entityTypeId, r.role]));
  return [
    { entityTypeId: LEAD_ENTITY_TYPE_ID, title: 'Лиды' },
    { entityTypeId: ENTITY_TYPE_ID.DEAL, title: 'Сделки' },
    ...smart.map((t) => ({ entityTypeId: t.entityTypeId, title: t.title })),
  ].map((s) => ({
    ...s,
    role: byType.get(s.entityTypeId) ?? defaultRole(s.entityTypeId),
    isDefault: !byType.has(s.entityTypeId),
  }));
}

/** Saved roles only, by entityTypeId — for places that must not call Bitrix24 just to sort. */
export async function savedRoles(scope: PortalScope): Promise<Map<number, CrmRole>> {
  return new Map((await scope.crmSectionRole.findMany()).map((r) => [r.entityTypeId, r.role]));
}

export async function getSetup(portal: PortalInstallation, scope: PortalScope, demo: boolean) {
  let sections: CrmSection[] = [];
  let error: string | null = null;
  if (!demo) {
    try {
      sections = await listCrmSections(portal, scope);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  return {
    sections,
    disabledSections: portal.disabledSections,
    completedAt: portal.setupCompletedAt?.toISOString() ?? null,
    error,
  };
}

export async function saveSetup(
  portal: PortalInstallation,
  scope: PortalScope,
  demo: boolean,
  input: SaveSetupInput,
) {
  if (input.roles.length > 0 && !demo) {
    const sections = await listCrmSections(portal, scope);
    const titles = new Map(sections.map((s) => [s.entityTypeId, s.title]));
    for (const r of input.roles) {
      const label = titles.get(r.entityTypeId);
      if (!label) throw badRequest('Такого раздела нет в Битрикс24');
      await scope.crmSectionRole.upsert(r.entityTypeId, { label, role: r.role });
    }
  }
  await db.portalInstallation.update({
    where: { id: portal.id },
    data: { disabledSections: [...new Set(input.disabledSections)], setupCompletedAt: new Date() },
  });
}
