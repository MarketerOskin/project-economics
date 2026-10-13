import type { PortalInstallation } from '@prisma/client';
import { batchBitrix, callBitrix } from './client';
import { listSmartProcessTypes } from './crm';
import { ENTITY_TYPE_ID } from './types';

/**
 * Elements of other CRM types that point at a project's own Bitrix24 entity (ADR-039): a
 * «Заявки BK» item whose «Проект» field holds item 89 of «Отчет по проектам BK», a deal whose
 * company is the project's company, and so on. Nothing is configured per portal — the links
 * are found from each type's field definitions (crm.item.fields):
 *
 *  - `parentId<A>` (type crm_entity, parentEntityTypeId A): Bitrix24's own «связь» between
 *    two smart processes; the value is the parent's id.
 *  - a user field of type `crm` that allows entity type A: the value is the bare id when A is
 *    the only allowed type, otherwise A's prefix + id ("D_5", "CO_7", "T418_89").
 *  - `companyId` when the project is a company.
 */

export interface RelationField {
  entityTypeId: number;
  typeTitle: string;
  field: string;
  fieldTitle: string;
  /** The value to filter by for project entity `id`. */
  valueFor: (id: string) => string;
}

export interface RelatedItem {
  id: string;
  title: string;
  stageId: string | null;
  categoryId: number | null;
  assignedById: string | null;
  createdAt: Date | null;
  movedAt: Date | null;
  url: string;
}

export interface RelatedGroup {
  entityTypeId: number;
  title: string;
  /** Field titles the items were found by, e.g. ["Проект"]. */
  via: string[];
  items: RelatedItem[];
  /** Stage id -> { name, semantic } for the stages these items are in. */
  stages: Record<string, { name: string; semantic: 'success' | 'fail' | 'process' }>;
  truncated: boolean;
}

interface RawField {
  type?: string;
  title?: string;
  formLabel?: string;
  settings?: Record<string, unknown> | null;
}

const MAX_ITEMS_PER_FIELD = 200;
const PAGE = 50;

/** The prefix Bitrix24 writes before an id in a multi-type `crm` field. */
export function crmFieldPrefix(entityTypeId: number): string {
  if (entityTypeId === ENTITY_TYPE_ID.DEAL) return 'D';
  if (entityTypeId === ENTITY_TYPE_ID.COMPANY) return 'CO';
  if (entityTypeId === 3) return 'C';
  if (entityTypeId === 1) return 'L';
  return `T${entityTypeId.toString(16)}`;
}

/** The settings key a `crm` field uses to allow entity type A. */
function crmFieldKey(entityTypeId: number): string {
  if (entityTypeId === ENTITY_TYPE_ID.DEAL) return 'DEAL';
  if (entityTypeId === ENTITY_TYPE_ID.COMPANY) return 'COMPANY';
  if (entityTypeId === 3) return 'CONTACT';
  if (entityTypeId === 1) return 'LEAD';
  return `DYNAMIC_${entityTypeId}`;
}

/** Which fields of one CRM type point at entity type `target`. Pure — exported for tests. */
export function relationFieldsOf(
  entityTypeId: number,
  typeTitle: string,
  fields: Record<string, RawField>,
  target: number,
): RelationField[] {
  const out: RelationField[] = [];
  const key = crmFieldKey(target);
  for (const [name, f] of Object.entries(fields)) {
    const title = f.title || f.formLabel || name;
    if (name === `parentId${target}`) {
      out.push({ entityTypeId, typeTitle, field: name, fieldTitle: title, valueFor: (id) => id });
    } else if (name === 'companyId' && target === ENTITY_TYPE_ID.COMPANY) {
      out.push({ entityTypeId, typeTitle, field: name, fieldTitle: title, valueFor: (id) => id });
    } else if (f.type === 'crm' && f.settings && f.settings[key] === 'Y') {
      const allowed = Object.values(f.settings).filter((v) => v === 'Y').length;
      const prefix = crmFieldPrefix(target);
      out.push({
        entityTypeId,
        typeTitle,
        field: name,
        fieldTitle: title,
        valueFor: allowed === 1 ? (id) => id : (id) => `${prefix}_${id}`,
      });
    }
  }
  return out;
}

const FIELDS_TTL_MS = 60 * 60_000;
const globalForFields = globalThis as unknown as {
  __relationFields?: Map<string, { at: number; fields: RelationField[] }>;
};
const fieldsCache = (globalForFields.__relationFields ??= new Map());

/** Every field on the portal (deals + smart processes) that points at entity type `target`. */
export async function findRelationFields(portal: PortalInstallation, target: number): Promise<RelationField[]> {
  const cacheKey = `${portal.id}:${target}`;
  const hit = fieldsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < FIELDS_TTL_MS) return hit.fields;

  const types = [
    { entityTypeId: ENTITY_TYPE_ID.DEAL, title: 'Сделки' },
    ...(await listSmartProcessTypes(portal)).map((t) => ({ entityTypeId: t.entityTypeId, title: t.title })),
  ].filter((t) => t.entityTypeId !== target);

  const out: RelationField[] = [];
  for (let i = 0; i < types.length; i += PAGE) {
    const chunk = types.slice(i, i + PAGE);
    const res = await batchBitrix(
      portal,
      Object.fromEntries(chunk.map((t) => [`f${t.entityTypeId}`, { method: 'crm.item.fields', params: { entityTypeId: t.entityTypeId } }])),
    );
    for (const t of chunk) {
      const raw = (res?.[`f${t.entityTypeId}`] as { fields?: Record<string, RawField> } | undefined)?.fields;
      if (raw) out.push(...relationFieldsOf(t.entityTypeId, t.title, raw, target));
    }
  }
  fieldsCache.set(cacheKey, { at: Date.now(), fields: out });
  return out;
}

interface RawItem {
  id: number | string;
  title?: string | null;
  stageId?: string | null;
  categoryId?: number | string | null;
  assignedById?: number | string | null;
  createdTime?: string | null;
  movedTime?: string | null;
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function itemUrl(portal: PortalInstallation, entityTypeId: number, id: string): string {
  return entityTypeId === ENTITY_TYPE_ID.DEAL
    ? `https://${portal.domain}/crm/deal/details/${id}/`
    : `https://${portal.domain}/crm/type/${entityTypeId}/details/${id}/`;
}

/** Stage semantics from crm.status.list: "S" success, "F" fail, anything else in progress. */
function semanticOf(raw: string | null | undefined, statusId: string): 'success' | 'fail' | 'process' {
  if (raw === 'S' || /:SUCCESS$|^WON$/.test(statusId)) return 'success';
  if (raw === 'F' || /:FAIL$|^LOSE$/.test(statusId)) return 'fail';
  return 'process';
}

function stageEntityId(entityTypeId: number, categoryId: number | null): string {
  if (entityTypeId === ENTITY_TYPE_ID.DEAL) return categoryId ? `DEAL_STAGE_${categoryId}` : 'DEAL_STAGE';
  return `DYNAMIC_${entityTypeId}_STAGE_${categoryId ?? 0}`;
}

/** All elements that point at CRM entity `target`/`id`, grouped by their CRM type. */
export async function fetchRelatedItems(portal: PortalInstallation, target: number, id: string): Promise<RelatedGroup[]> {
  const relations = await findRelationFields(portal, target);
  const byType = new Map<number, RelatedGroup>();

  for (const rel of relations) {
    const group =
      byType.get(rel.entityTypeId) ??
      ({ entityTypeId: rel.entityTypeId, title: rel.typeTitle, via: [], items: [], stages: {}, truncated: false } as RelatedGroup);
    const seen = new Set(group.items.map((i) => i.id));
    let found = 0;
    for (let start = 0; start < MAX_ITEMS_PER_FIELD; start += PAGE) {
      const res = await callBitrix<{ items?: RawItem[] }>(portal, 'crm.item.list', {
        entityTypeId: rel.entityTypeId,
        filter: { [rel.field]: rel.valueFor(id) },
        select: ['id', 'title', 'stageId', 'categoryId', 'assignedById', 'createdTime', 'movedTime'],
        order: { id: 'desc' },
        start,
      });
      const page = res?.items ?? [];
      for (const raw of page) {
        const itemId = String(raw.id);
        found++;
        if (seen.has(itemId)) continue;
        seen.add(itemId);
        group.items.push({
          id: itemId,
          title: raw.title || `#${itemId}`,
          stageId: raw.stageId ?? null,
          categoryId: raw.categoryId != null && raw.categoryId !== '' ? Number(raw.categoryId) : null,
          assignedById: raw.assignedById != null ? String(raw.assignedById) : null,
          createdAt: toDate(raw.createdTime),
          movedAt: toDate(raw.movedTime),
          url: itemUrl(portal, rel.entityTypeId, itemId),
        });
      }
      if (page.length < PAGE) break;
      if (start + PAGE >= MAX_ITEMS_PER_FIELD) group.truncated = true;
    }
    if (found > 0) {
      if (!group.via.includes(rel.fieldTitle)) group.via.push(rel.fieldTitle);
      byType.set(rel.entityTypeId, group);
    }
  }

  const groups = [...byType.values()].filter((g) => g.items.length > 0);
  await attachStageNames(portal, groups);
  for (const g of groups) g.items.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  return groups;
}

async function attachStageNames(portal: PortalInstallation, groups: RelatedGroup[]): Promise<void> {
  const entityIds = new Set<string>();
  for (const g of groups) for (const i of g.items) if (i.stageId) entityIds.add(stageEntityId(g.entityTypeId, i.categoryId));
  if (entityIds.size === 0) return;

  const list = [...entityIds];
  const names: Record<string, { name: string; semantic: 'success' | 'fail' | 'process' }> = {};
  for (let i = 0; i < list.length; i += PAGE) {
    const chunk = list.slice(i, i + PAGE);
    const res = await batchBitrix(
      portal,
      Object.fromEntries(chunk.map((e, n) => [`s${n}`, { method: 'crm.status.list', params: { filter: { ENTITY_ID: e } } }])),
    ).catch(() => ({}) as Record<string, unknown>);
    for (const v of Object.values(res ?? {})) {
      for (const s of Array.isArray(v) ? (v as Array<{ STATUS_ID: string; NAME: string; SEMANTICS?: string | null }>) : []) {
        names[s.STATUS_ID] = { name: s.NAME, semantic: semanticOf(s.SEMANTICS, s.STATUS_ID) };
      }
    }
  }
  for (const g of groups) {
    for (const i of g.items) {
      if (i.stageId) g.stages[i.stageId] = names[i.stageId] ?? { name: i.stageId, semantic: semanticOf(null, i.stageId) };
    }
  }
}
