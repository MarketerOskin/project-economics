import { describe, it, expect } from 'vitest';
import { can, requirePermission, type Actor } from '@/lib/permissions';
import { AppError } from '@/lib/errors';

const admin: Actor = { role: 'ADMIN', appUserId: 'a' };
const manager: Actor = { role: 'MANAGER', appUserId: 'm' };
const employee: Actor = { role: 'EMPLOYEE', appUserId: 'e' };

const memberCtx = { memberUserIds: ['e'] };
const foreignCtx = { memberUserIds: ['someone-else'] };

describe('capability matrix (ТЗ §7)', () => {
  const rows: Array<[keyof typeof can, Actor, boolean]> = [
    ['mutateProject', admin, true],
    ['mutateProject', manager, true],
    ['mutateProject', employee, false],
    ['archiveProject', admin, true],
    ['archiveProject', manager, true],
    ['archiveProject', employee, false],
    ['mutateFinance', admin, true],
    ['mutateFinance', manager, true],
    ['mutateFinance', employee, false],
    ['manageMembers', admin, true],
    ['manageMembers', manager, true],
    ['manageMembers', employee, false],
    ['manageCategories', admin, true],
    ['manageCategories', manager, true],
    ['manageCategories', employee, false],
    ['viewHistory', admin, true],
    ['viewHistory', manager, true],
    ['viewHistory', employee, false],
    ['assignRole', admin, true],
    ['assignRole', manager, false],
    ['assignRole', employee, false],
    ['manageSettings', admin, true],
    ['manageSettings', manager, false],
    ['manageSettings', employee, false],
    ['viewAllProjects', admin, true],
    ['viewAllProjects', manager, true],
    ['viewAllProjects', employee, false],
  ];

  for (const [cap, actor, expected] of rows) {
    it(`${cap} / ${actor.role} => ${expected}`, () => {
      const fn = can[cap] as (a: Actor) => boolean;
      expect(fn(actor)).toBe(expected);
    });
  }
});

describe('viewProject (ТЗ §7, §66)', () => {
  it('admin and manager see any project', () => {
    expect(can.viewProject(admin, foreignCtx)).toBe(true);
    expect(can.viewProject(manager, foreignCtx)).toBe(true);
  });

  it('employee sees a project only if a member', () => {
    expect(can.viewProject(employee, memberCtx)).toBe(true);
    expect(can.viewProject(employee, foreignCtx)).toBe(false);
  });
});

describe('requirePermission', () => {
  it('throws AppError(403) when not allowed', () => {
    expect(() => requirePermission(false)).toThrow(AppError);
    try {
      requirePermission(false);
    } catch (e) {
      expect((e as AppError).httpStatus).toBe(403);
    }
  });

  it('is a no-op when allowed', () => {
    expect(() => requirePermission(true)).not.toThrow();
  });
});
