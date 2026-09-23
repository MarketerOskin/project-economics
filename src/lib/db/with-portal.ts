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
  | 'project'
  | 'financialEntry'
  | 'financeCategory'
  | 'projectMember'
  | 'appUser'
  | 'auditLog'
  | 'proLead'
  | 'crmImportSource'
  | 'taskTimeDraft'
  | 'crmIncomeDraft'
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

    crmImportSource: {
      findMany: (args?: Omit<Prisma.CrmImportSourceFindManyArgs, 'where'>) =>
        client.crmImportSource.findMany({ ...args, where: { portalId }, orderBy: { createdAt: 'asc' } }),

      create: (data: Omit<Prisma.CrmImportSourceUncheckedCreateInput, 'portalId'>) =>
        client.crmImportSource.create({ data: { ...data, portalId } }),

      /** Scoped delete: returns a count instead of throwing, so callers can 404 cleanly. */
      remove: (id: string) => client.crmImportSource.deleteMany({ where: { id, portalId } }),
    },

    timeDraft: {
      findMany<
        T extends Omit<Prisma.TaskTimeDraftFindManyArgs, 'where'> & {
          where?: Prisma.TaskTimeDraftWhereInput;
        },
      >(args?: T): Promise<Prisma.TaskTimeDraftGetPayload<T>[]> {
        return client.taskTimeDraft.findMany({
          ...args,
          where: { ...args?.where, portalId },
        } as Prisma.TaskTimeDraftFindManyArgs) as Promise<Prisma.TaskTimeDraftGetPayload<T>[]>;
      },

      async findByIdOrThrow(id: string) {
        const row = await client.taskTimeDraft.findFirst({ where: { id, portalId } });
        if (!row) throw notFound('Черновик не найден');
        return row;
      },

      upsert: (args: {
        where: Prisma.TaskTimeDraftWhereUniqueInput;
        create: Omit<Prisma.TaskTimeDraftUncheckedCreateInput, 'portalId'>;
        update: Prisma.TaskTimeDraftUncheckedUpdateInput;
      }) =>
        client.taskTimeDraft.upsert({
          where: args.where,
          create: { ...args.create, portalId },
          update: args.update,
        }),

      update: (id: string, data: Prisma.TaskTimeDraftUncheckedUpdateInput) =>
        client.taskTimeDraft.update({ where: { id }, data }),
    },

    incomeDraft: {
      findMany<
        T extends Omit<Prisma.CrmIncomeDraftFindManyArgs, 'where'> & {
          where?: Prisma.CrmIncomeDraftWhereInput;
        },
      >(args?: T): Promise<Prisma.CrmIncomeDraftGetPayload<T>[]> {
        return client.crmIncomeDraft.findMany({
          ...args,
          where: { ...args?.where, portalId },
        } as Prisma.CrmIncomeDraftFindManyArgs) as Promise<Prisma.CrmIncomeDraftGetPayload<T>[]>;
      },

      async findByIdOrThrow(id: string) {
        const row = await client.crmIncomeDraft.findFirst({ where: { id, portalId } });
        if (!row) throw notFound('Черновик не найден');
        return row;
      },

      upsert: (args: {
        where: Prisma.CrmIncomeDraftWhereUniqueInput;
        create: Omit<Prisma.CrmIncomeDraftUncheckedCreateInput, 'portalId'>;
        update: Prisma.CrmIncomeDraftUncheckedUpdateInput;
      }) =>
        client.crmIncomeDraft.upsert({
          where: args.where,
          create: { ...args.create, portalId },
          update: args.update,
        }),

      update: (id: string, data: Prisma.CrmIncomeDraftUncheckedUpdateInput) =>
        client.crmIncomeDraft.update({ where: { id }, data }),
    },

    member: {
      findMany: (where?: Prisma.ProjectMemberWhereInput) =>
        client.projectMember.findMany({ where: { ...where, portalId } }),

      count: (where?: Prisma.ProjectMemberWhereInput) =>
        client.projectMember.count({ where: { ...where, portalId } }),

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

      update: (id: string, data: Prisma.AppUserUncheckedUpdateInput) =>
        client.appUser.update({ where: { id }, data }),
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

    proLead: {
      create: (data: Omit<Prisma.ProLeadUncheckedCreateInput, 'portalId'>) =>
        client.proLead.create({ data: { ...data, portalId } }),

      findMany<T extends Omit<Prisma.ProLeadFindManyArgs, 'where'> & { where?: Prisma.ProLeadWhereInput }>(
        args?: T,
      ): Promise<Prisma.ProLeadGetPayload<T>[]> {
        return client.proLead.findMany({
          ...args,
          where: { ...args?.where, portalId },
        } as Prisma.ProLeadFindManyArgs) as Promise<Prisma.ProLeadGetPayload<T>[]>;
      },
    },
  };
}

export type PortalScope = ReturnType<typeof withPortal>;
