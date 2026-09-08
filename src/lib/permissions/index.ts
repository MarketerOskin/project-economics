import type { AppRole } from '@prisma/client';
import { forbidden } from '@/lib/errors';

export interface Actor {
  role: AppRole;
  appUserId: string;
}

export interface ProjectContext {
  /** AppUser ids of the project's members. */
  memberUserIds: string[];
}

const isManagerOrAdmin = (a: Actor) => a.role === 'ADMIN' || a.role === 'MANAGER';

/**
 * Server-side capability checks (ТЗ §7). Every mutating route calls these before touching
 * the database. The frontend may mirror them for affordances, but is never the gate (ТЗ §7).
 */
export const can = {
  /** See the full project list / every project's numbers. EMPLOYEE is member-scoped instead. */
  viewAllProjects: (a: Actor): boolean => isManagerOrAdmin(a),

  /** See one project. EMPLOYEE only when a member of it (ТЗ §7, §66). */
  viewProject: (a: Actor, ctx: ProjectContext): boolean =>
    isManagerOrAdmin(a) || ctx.memberUserIds.includes(a.appUserId),

  mutateProject: (a: Actor): boolean => isManagerOrAdmin(a),
  archiveProject: (a: Actor): boolean => isManagerOrAdmin(a),
  mutateFinance: (a: Actor): boolean => isManagerOrAdmin(a),
  manageMembers: (a: Actor): boolean => isManagerOrAdmin(a),
  manageCategories: (a: Actor): boolean => isManagerOrAdmin(a),
  viewHistory: (a: Actor): boolean => isManagerOrAdmin(a),

  /** Only ADMIN: assign MANAGER/EMPLOYEE, and change integration/install settings (ТЗ §7). */
  assignRole: (a: Actor): boolean => a.role === 'ADMIN',
  manageSettings: (a: Actor): boolean => a.role === 'ADMIN',
} as const;

export type Capability = keyof typeof can;

/** Throw a 403 when `allowed` is false. Use right after a `can.*` check in a handler. */
export function requirePermission(allowed: boolean, message?: string): void {
  if (!allowed) throw forbidden(message);
}
