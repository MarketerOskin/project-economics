import type { CrmRole, PortalInstallation } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import { ENTITY_TYPE_ID } from '@/lib/bitrix/types';
import { listSmartProcessTypes } from '@/lib/bitrix/crm';
import { badRequest, notFound } from '@/lib/errors';
import type { ResolvedSession } from '@/lib/auth/resolve';
import { savedRoles } from './portal-setup';

const ROLE_ORDER: CrmRole[] = ['PROJECTS', 'SUPPORT', 'SALES', 'TRAFFIC', 'IGNORE'];

/** The two entity types every portal can import from, with no setup (ТЗ default). */
const BUILTIN_SOURCES = [
  { entityTypeId: ENTITY_TYPE_ID.DEAL, label: 'Сделки' },
  { entityTypeId: ENTITY_TYPE_ID.COMPANY, label: 'Компании' },
] as const;
const BUILTIN_IDS = new Set<number>(BUILTIN_SOURCES.map((s) => s.entityTypeId));

export interface CrmImportSourceOption {
  entityTypeId: number;
  label: string;
  /** Built-ins (Deal/Company) can't be removed — only Smart Process sources an admin added. */
  removable: boolean;
  id: string | null;
}

/** Deal + Company, plus whatever Smart Processes this portal's admin has added (ADR-026). */
export async function listImportSources(scope: PortalScope): Promise<CrmImportSourceOption[]> {
  const custom = await scope.crmImportSource.findMany();
  return [
    ...BUILTIN_SOURCES.map((s) => ({ ...s, removable: false, id: null })),
    ...custom.map((c) => ({
      entityTypeId: c.entityTypeId,
      label: c.label,
      removable: true,
      id: c.id,
    })),
  ];
}

/**
 * What a project can be picked from right now: Deal + Company plus every Smart Process the
 * portal has, read live from crm.type.list (ADR-036) — nobody has to add them in Settings
 * first. Sources an admin added by hand stay too, so a failed crm.type.list call (or the
 * demo portal) still offers them.
 */
export async function listAvailableSources(
  session: ResolvedSession,
  scope: PortalScope,
): Promise<Array<{ entityTypeId: number; label: string }>> {
  const configured = await listImportSources(scope);
  if (session.demo) return configured;
  const [live, roles] = await Promise.all([
    listSmartProcessTypes(session.portal).catch(() => []),
    savedRoles(scope),
  ]);
  const seen = new Set(configured.map((s) => s.entityTypeId));
  const all = [
    ...configured.map(({ entityTypeId, label }) => ({ entityTypeId, label })),
    ...live
      .filter((t) => !seen.has(t.entityTypeId))
      .map((t) => ({ entityTypeId: t.entityTypeId, label: t.title })),
  ];
  // «Настройка под портал» (ADR-041): sections marked «Не использовать» leave the picker, and
  // the ones that hold projects come first. Deals and companies always stay.
  const rank = (id: number) => ROLE_ORDER.indexOf(roles.get(id) ?? 'PROJECTS');
  const builtIn = all.filter((s) => BUILTIN_IDS.has(s.entityTypeId));
  const rest = all
    .filter((s) => !BUILTIN_IDS.has(s.entityTypeId) && roles.get(s.entityTypeId) !== 'IGNORE')
    .sort((x, y) => rank(x.entityTypeId) - rank(y.entityTypeId));
  return [...builtIn, ...rest];
}

/**
 * Throws unless a project may be picked from this entityTypeId: Deal/Company, an added
 * source, or one of the portal's real Smart Processes. Bitrix24 is asked only for the last
 * case, so browsing deals costs no extra crm.type.list call.
 */
export async function assertImportableSource(
  session: ResolvedSession,
  scope: PortalScope,
  entityTypeId: number,
) {
  const configured = await listImportSources(scope);
  if (configured.some((s) => s.entityTypeId === entityTypeId)) return;
  if (!session.demo) {
    const live = await listSmartProcessTypes(session.portal).catch(() => []);
    if (live.some((t) => t.entityTypeId === entityTypeId)) return;
  }
  throw badRequest('Такого источника нет в Битрикс24');
}

/** Smart Processes not already added, for the "add a source" picker in Settings. */
export async function listAddableSmartProcesses(portal: PortalInstallation, scope: PortalScope) {
  const [types, existing] = await Promise.all([
    listSmartProcessTypes(portal),
    scope.crmImportSource.findMany(),
  ]);
  const added = new Set(existing.map((s) => s.entityTypeId));
  return types
    .filter((t) => !added.has(t.entityTypeId))
    .map((t) => ({ entityTypeId: t.entityTypeId, title: t.title }));
}

/** Adds one Smart Process as an import source, verifying it's real (not a guessed id). */
export async function addImportSource(
  portal: PortalInstallation,
  scope: PortalScope,
  entityTypeId: number,
) {
  const types = await listSmartProcessTypes(portal);
  const type = types.find((t) => t.entityTypeId === entityTypeId);
  if (!type) throw badRequest('Такого смарт-процесса нет на этом портале');

  return scope.crmImportSource.create({ entityTypeId, label: type.title });
}

export async function removeImportSource(scope: PortalScope, id: string): Promise<void> {
  const { count } = await scope.crmImportSource.remove(id);
  if (count === 0) throw notFound('Источник не найден');
}
