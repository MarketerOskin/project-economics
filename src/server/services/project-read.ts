import { Prisma } from '@prisma/client';
import type { PortalScope } from '@/lib/db/with-portal';
import type { Actor } from '@/lib/permissions';
import { can, requirePermission } from '@/lib/permissions';
import { loadProjectEconomics } from '@/server/economics';
import { economicsToJson, type EconomicsJson } from '@/server/serialize';
import type { ListProjectsQuery } from '@/server/dto/project';

export interface ProjectListRow {
  id: string;
  name: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  clientName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  members: { id: string; fullName: string; photoUrl: string | null; position: string | null }[];
  crm: { type: string | null; id: string; title: string | null; url: string | null } | null;
  economics: EconomicsJson;
}

const include = {
  members: { include: { user: true } },
} satisfies Prisma.ProjectInclude;

function memberDto(m: { user: { id: string; firstName: string; lastName: string; photoUrl: string | null; position: string | null } }) {
  return {
    id: m.user.id,
    fullName: `${m.user.firstName} ${m.user.lastName}`.trim(),
    photoUrl: m.user.photoUrl,
    position: m.user.position,
  };
}

function crmDto(p: {
  sourceType: string;
  crmEntityType: string | null;
  crmEntityId: string | null;
  crmEntityTitle: string | null;
  crmEntityUrl: string | null;
}) {
  if (p.sourceType !== 'BITRIX_CRM' || !p.crmEntityId) return null;
  return { type: p.crmEntityType, id: p.crmEntityId, title: p.crmEntityTitle, url: p.crmEntityUrl };
}

const SORT_KEY = {
  income: 'factIncome',
  expense: 'factExpense',
  profit: 'factProfit',
  margin: 'factMargin',
} as const;

/** Project list scoped to the actor (EMPLOYEE -> member projects only), with period economics. */
export async function queryProjects(
  scope: PortalScope,
  actor: Actor,
  query: ListProjectsQuery,
): Promise<ProjectListRow[]> {
  const where: Prisma.ProjectWhereInput = {};
  if (query.status !== 'ALL') where.status = query.status;
  if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
  if (query.memberId) where.members = { some: { userId: query.memberId } };
  if (!can.viewAllProjects(actor)) where.members = { some: { userId: actor.appUserId } };

  const projects = await scope.project.findMany({ where, include });
  const economics = await loadProjectEconomics(scope, projects.map((p) => p.id), {
    from: query.from,
    to: query.to,
  });

  const rows: ProjectListRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    clientName: p.clientName,
    startDate: p.startDate,
    endDate: p.endDate,
    members: p.members.map(memberDto),
    crm: crmDto(p),
    economics: economicsToJson(economics.get(p.id)!),
  }));

  const dir = query.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (query.sort === 'name') return a.name.localeCompare(b.name, 'ru') * dir;
    const key = SORT_KEY[query.sort];
    const av = a.economics[key];
    const bv = b.economics[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (Number(av) - Number(bv)) * dir;
  });

  return rows;
}

export interface ProjectDetail extends Omit<ProjectListRow, never> {
  description: string | null;
  internalComment: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  canEdit: boolean;
  canManageMembers: boolean;
}

/** One project with a permission check: non-member EMPLOYEE -> 403 (ТЗ §66). */
export async function getProjectDetail(
  scope: PortalScope,
  actor: Actor,
  id: string,
): Promise<ProjectDetail> {
  const project = await scope.project.findByIdOrThrow(id, {
    include: { members: { include: { user: true } }, createdBy: true },
  });
  const memberUserIds = project.members.map((m) => m.userId);
  requirePermission(can.viewProject(actor, { memberUserIds }));

  const economics = await loadProjectEconomics(scope, [project.id]);

  return {
    id: project.id,
    name: project.name,
    status: project.status,
    clientName: project.clientName,
    startDate: project.startDate,
    endDate: project.endDate,
    members: project.members.map(memberDto),
    crm: crmDto(project),
    economics: economicsToJson(economics.get(project.id)!),
    description: project.description,
    internalComment: can.viewAllProjects(actor) ? project.internalComment : null,
    createdBy: project.createdBy ? `${project.createdBy.firstName} ${project.createdBy.lastName}`.trim() : null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    canEdit: can.mutateProject(actor),
    canManageMembers: can.manageMembers(actor),
  };
}
