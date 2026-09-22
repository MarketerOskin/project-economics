import type { PortalInstallation } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import { ENTITY_TYPE_ID } from '@/lib/bitrix/types';
import { listSmartProcessTypes } from '@/lib/bitrix/crm';
import { badRequest, notFound } from '@/lib/errors';

/** The two entity types every portal can import from, with no setup (ТЗ default). */
const BUILTIN_SOURCES = [
  { entityTypeId: ENTITY_TYPE_ID.DEAL, label: 'Сделки' },
  { entityTypeId: ENTITY_TYPE_ID.COMPANY, label: 'Компании' },
] as const;

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
    ...custom.map((c) => ({ entityTypeId: c.entityTypeId, label: c.label, removable: true, id: c.id })),
  ];
}

/** Smart Processes not already added, for the "add a source" picker in Settings. */
export async function listAddableSmartProcesses(portal: PortalInstallation, scope: PortalScope) {
  const [types, existing] = await Promise.all([listSmartProcessTypes(portal), scope.crmImportSource.findMany()]);
  const added = new Set(existing.map((s) => s.entityTypeId));
  return types
    .filter((t) => !added.has(t.entityTypeId))
    .map((t) => ({ entityTypeId: t.entityTypeId, title: t.title }));
}

/** Adds one Smart Process as an import source, verifying it's real (not a guessed id). */
export async function addImportSource(portal: PortalInstallation, scope: PortalScope, entityTypeId: number) {
  const types = await listSmartProcessTypes(portal);
  const type = types.find((t) => t.entityTypeId === entityTypeId);
  if (!type) throw badRequest('Такого смарт-процесса нет на этом портале');

  return scope.crmImportSource.create({ entityTypeId, label: type.title });
}

export async function removeImportSource(scope: PortalScope, id: string): Promise<void> {
  const { count } = await scope.crmImportSource.remove(id);
  if (count === 0) throw notFound('Источник не найден');
}
