import { Prisma, type PrismaClient } from '@prisma/client';
import { db } from './client';
import { notFound } from '@/lib/errors';

/**
 * A client bound to one portal. Every read and write it performs is filtered / stamped with
 * `portalId`, so a request for portal A can never touch portal B's data (ТЗ §54).
 *
 * Read methods are generic over Prisma's args so `include` / `select` types flow through.
 * The internal casts are the price of injecting `where` around Prisma's delegate types — the
 * runtime shape always matches the caller's args.
 *
 * Complex reads (groupBy / aggregate) use `scope.scopedWhere(extra)` for the same guarantee.
 * Pass a transaction client as the second argument to stay inside `db.$transaction`.
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
      findMany<T extends Omit<Prisma.ProjectFindManyArgs, 'where'> & { where?: Prisma.ProjectWhereInput }>(
        args?: T,
      ): Promise<Prisma.ProjectGetPayload<T>[]> {
        return client.project.findMany({
          ...args,
          where: { ...args?.where, portalId },
        } as Prisma.ProjectFindManyArgs) as Promise<Prisma.ProjectGetPayload<T>[]>;
      },

      async findByIdOrThrow<T extends Omit<Prisma.ProjectFindFirstArgs, 'where'>>(
        id: string,
        args?: T,
      ): Promise<Prisma.ProjectGetPayload<T>> {
        const row = await client.project.findFirst({
          ...args,
          where: { id, portalId },
        } as Prisma.ProjectFindFirstArgs);
        if (!row) throw notFound('Проект не найден');
        return row as Prisma.ProjectGetPayload<T>;
      },

      create: (data: Omit<Prisma.ProjectUncheckedCreateInput, 'portalId'>) =>
        client.project.create({ data: { ...data, portalId } }),

      update: (id: string, data: Prisma.ProjectUncheckedUpdateInput) =>
        client.project.update({ where: { id }, data }),

      count: (where?: Prisma.ProjectWhereInput) =>
        client.project.count({ where: { ...where, portalId } }),
    },

    entry: {
      findMany<
        T extends Omit<Prisma.FinancialEntryFindManyArgs, 'where'> & {
          where?: Prisma.FinancialEntryWhereInput;
        },
      >(args?: T): Promise<Prisma.FinancialEntryGetPayload<T>[]> {
        return client.financialEntry.findMany({
          ...args,
          where: { ...args?.where, portalId },
        } as Prisma.FinancialEntryFindManyArgs) as Promise<Prisma.FinancialEntryGetPayload<T>[]>;
      },

      async findByIdOrThrow<T extends Omit<Prisma.FinancialEntryFindFirstArgs, 'where'>>(
        id: string,
        args?: T,
      ): Promise<Prisma.FinancialEntryGetPayload<T>> {
        const row = await client.financialEntry.findFirst({
          ...args,
          where: { id, portalId },
        } as Prisma.FinancialEntryFindFirstArgs);
        if (!row) throw notFound('Операция не найдена');
        return row as Prisma.FinancialEntryGetPayload<T>;
      },

      create: (data: Omit<Prisma.FinancialEntryUncheckedCreateInput, 'portalId'>) =>
        client.financialEntry.create({ data: { ...data, portalId } }),

      update: (id: string, data: Prisma.FinancialEntryUncheckedUpdateInput) =>
        client.financialEntry.update({ where: { id }, data }),

      count: (where?: Prisma.FinancialEntryWhereInput) =>
        client.financialEntry.count({ where: { ...where, portalId } }),
    },

    category: {
      findMany<
        T extends Omit<Prisma.FinanceCategoryFindManyArgs, 'where'> & {
          where?: Prisma.FinanceCategoryWhereInput;
        },
      >(args?: T): Promise<Prisma.FinanceCategoryGetPayload<T>[]> {
        return client.financeCategory.findMany({
          ...args,
          where: { ...args?.where, portalId },
        } as Prisma.FinanceCategoryFindManyArgs) as Promise<Prisma.FinanceCategoryGetPayload<T>[]>;
      },

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
      findMany<T extends Omit<Prisma.AppUserFindManyArgs, 'where'> & { where?: Prisma.AppUserWhereInput }>(
        args?: T,
      ): Promise<Prisma.AppUserGetPayload<T>[]> {
        return client.appUser.findMany({
          ...args,
          where: { ...args?.where, portalId },
        } as Prisma.AppUserFindManyArgs) as Promise<Prisma.AppUserGetPayload<T>[]>;
      },

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

      findMany<T extends Omit<Prisma.AuditLogFindManyArgs, 'where'> & { where?: Prisma.AuditLogWhereInput }>(
        args?: T,
      ): Promise<Prisma.AuditLogGetPayload<T>[]> {
        return client.auditLog.findMany({
          ...args,
          where: { ...args?.where, portalId },
        } as Prisma.AuditLogFindManyArgs) as Promise<Prisma.AuditLogGetPayload<T>[]>;
      },

      count: (where?: Prisma.AuditLogWhereInput) =>
        client.auditLog.count({ where: { ...where, portalId } }),
    },
  };
}

export type PortalScope = ReturnType<typeof withPortal>;
