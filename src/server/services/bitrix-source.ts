import { badRequest } from '@/lib/errors';
import { ENTITY_TYPE_ID } from '@/lib/bitrix/types';
import type { ResolvedSession } from '@/lib/auth/resolve';
import type { PortalScope } from '@/lib/db/with-portal';
import { assertImportableSource } from '@/server/services/crm-sources';
import { resolveBitrixProjectGroup } from '@/server/services/bitrix-groups';

/** What a project stores about the Bitrix24 entity it comes from. */
export interface BitrixSourceSnapshot {
  crmEntityType: 'DEAL' | 'COMPANY' | 'SMART_PROCESS' | null;
  crmEntityId: string;
  crmEntityTitle: string | null;
  crmEntityUrl: string | null;
  clientName: string | null;
}

export type BitrixSourceInput =
  | { source: 'BITRIX_CRM'; crmEntityTypeId: number; crmEntityId: string }
  | { source: 'BITRIX_PROJECT'; bitrixGroupId: string };

/**
 * Look the chosen deal / company / smart-process item or «Проекты» group up in Bitrix24 and
 * return its snapshot. Shared by creating a project from Bitrix24 and linking an existing one.
 */
export async function resolveBitrixSource(
  session: ResolvedSession,
  scope: PortalScope,
  input: BitrixSourceInput,
): Promise<BitrixSourceSnapshot> {
  if (input.source === 'BITRIX_CRM') {
    // Only Deal/Company or one of the portal's real Smart Processes (ADR-036) — never an
    // arbitrary entityTypeId the client happens to send.
    await assertImportableSource(session, scope, input.crmEntityTypeId);
    const { resolveCrmItem } = await import('@/server/services/crm');
    const item = await resolveCrmItem(session, input.crmEntityTypeId, input.crmEntityId);
    if (!item) throw badRequest('CRM-сущность не найдена в Bitrix24');
    return {
      crmEntityType:
        input.crmEntityTypeId === ENTITY_TYPE_ID.COMPANY
          ? 'COMPANY'
          : input.crmEntityTypeId === ENTITY_TYPE_ID.DEAL
            ? 'DEAL'
            : 'SMART_PROCESS',
      crmEntityId: input.crmEntityId,
      crmEntityTitle: item.title,
      crmEntityUrl: item.url,
      clientName: item.clientName ?? null,
    };
  }

  const group = await resolveBitrixProjectGroup(session, input.bitrixGroupId);
  if (!group) throw badRequest('Проект не найден в разделе «Проекты» Битрикс24');
  return {
    crmEntityType: null,
    crmEntityId: group.id,
    crmEntityTitle: group.title,
    crmEntityUrl: group.url,
    clientName: null,
  };
}
