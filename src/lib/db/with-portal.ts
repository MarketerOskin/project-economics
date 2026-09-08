import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from './client';
import { notFound } from '@/lib/errors';

/**
 * A client bound to one portal. Every read and write it performs is filtered / stamped with
 * `portalId`, so a request for portal A can never touch portal B's data (ТЗ §54).
 *
 * Complex reads (groupBy / aggregate) use `scope.scopedWhere(extra)` to guarantee the same.
 * Pass a transaction client as the second argument to keep the scope inside `db.$transaction`.
 */
export type ScopedClient = Pick<
  PrismaClient,
  'project' | 'financialEntry' | 'financeCategory' | 'projectMember' | 'appUser' | 'auditLog'
>;

export function withPortal(portalId: string, client: ScopedClient = db) {
  const scopedWhere = <T extends Record<string, unknown>>(extra?: T) => ({
    portalId,
    ...(extra ?? ({} as T)),
  });

  return {
    portalId,
    scopedWhere,

    project: {
      findMany: (args?: Omit<Prisma.ProjectFindManyArgs, 'where'> & { where?: Prisma.ProjectWhereInput }) =>
        client.project.findMany({ ...args, where: { ...args?.where, portalId } }),

      findFirst: (where: Prisma.ProjectWhereInput, args?: Omit<Prisma.ProjectFindFirstArgs, 'where'>) =>
        client.project.findFirst({ ...args, where: { ...where, portalId } }),

      async findByIdOrThrow(id: string, args?: Omit<Prisma.ProjectFindFirstArgs, 'where'>) {
        const row = await client.project.findFirst({ ...args, where: { id, portalId } });
        if (!row) throw notFound('Проект не найден');
        return row;
      },

      create: (data: Omit<Prisma.ProjectUncheckedCreateInput, 'portalId'>) =>
        client.project.create({ data: { ...data, portalId } }),

      update: (id: string, data: Prisma.ProjectUncheckedUpdateInput) =>
        client.project.update({ where: { id }, data }),

      count: (where?: Prisma.ProjectWhereInput) =>
        client.project.count({ where: { ...where, portalId } }),
    },

    entry: {
      findMany: (
        args?: Omit<Prisma.FinancialEntryFindManyArgs, 'where'> & {
          where?: Prisma.FinancialEntryWhereInput;
        },
      ) => client.financialEntry.findMany({ ...args, where: { ...args?.where, portalId } }),

      async findByIdOrThrow(id: string, args?: Omit<Prisma.FinancialEntryFindFirstArgs, 'where'>) {
        const row = await client.financialEntry.findFirst({ ...args, where: { id, portalId } });
        if (!row) throw notFound('Операция не найдена');
        return row;
      },

      create: (data: Omit<Prisma.FinancialEntryUncheckedCreateInput, 'portalId'>) =>
        client.financialEntry.create({ data: { ...data, portalId } }),

      update: (id: string, data: Prisma.FinancialEntryUncheckedUpdateInput) =>
        client.financialEntry.update({ where: { id }, data }),

      count: (where?: Prisma.FinancialEntryWhereInput) =>
        client.financialEntry.count({ where: { ...where, portalId } }),
    },

    category: {
      findMany: (
        args?: Omit<Prisma.FinanceCategoryFindManyArgs, 'where'> & {
          where?: Prisma.FinanceCategoryWhereInput;
        },
      ) => client.financeCategory.findMany({ ...args, where: { ...args?.where, portalId } }),

      async findByIdOrThrow(id: string) {
        const row = await client.financeCategory.findFirst({ where: { id, portalId } });
        if (!row) throw notFound('Статья не найдена');
        return row;
      },

      create: (data: Omit<Prisma.FinanceCategoryUncheckedCreateInput, 'portalId'>) =>
        client.financeCategory.create({ data: { ...data, portalId } }),

      update: (id: string, data: Prisma.FinanceCategoryUncheckedUpdateInput) =>
        client.financeCategory.update({ where: { id }, data }),

      count: (where?: Prisma.FinanceCategoryWhereInput) =>
        client.financeCategory.count({ where: { ...where, portalId } }),
    },

    member: {
      findMany: (where?: Prisma.ProjectMemberWhereInput) =>
        client.projectMember.findMany({ where: { ...where, portalId } }),

      createMany: (rows: Omit<Prisma.ProjectMemberUncheckedCreateInput, 'portalId'>[]) =>
        client.projectMember.createMany({
          data: rows.map((r) => ({ ...r, portalId })),
          skipDuplicates: true,
        }),

      deleteMany: (where: Prisma.ProjectMemberWhereInput) =>
        client.projectMember.deleteMany({ where: { ...where, portalId } }),
    },

    user: {
      findMany: (
        args?: Omit<Prisma.AppUserFindManyArgs, 'where'> & { where?: Prisma.AppUserWhereInput },
      ) => client.appUser.findMany({ ...args, where: { ...args?.where, portalId } }),

      async findByIdOrThrow(id: string) {
        const row = await client.appUser.findFirst({ where: { id, portalId } });
        if (!row) throw notFound('Сотрудник не найден');
        return row;
      },

      listByIds: (ids: string[]) =>
        client.appUser.findMany({ where: { id: { in: ids }, portalId } }),
    },

    audit: {
      create: (data: Omit<Prisma.AuditLogUncheckedCreateInput, 'portalId'>) =>
        client.auditLog.create({ data: { ...data, portalId } }),

      findMany: (
        args?: Omit<Prisma.AuditLogFindManyArgs, 'where'> & { where?: Prisma.AuditLogWhereInput },
      ) => client.auditLog.findMany({ ...args, where: { ...args?.where, portalId } }),

      count: (where?: Prisma.AuditLogWhereInput) =>
        client.auditLog.count({ where: { ...where, portalId } }),
    },
  };
}

export type PortalScope = ReturnType<typeof withPortal>;
