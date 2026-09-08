# «Экономика проектов» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real full-stack Bitrix24 iframe app for plan/fact project economics — CRUD, Bitrix OAuth + CRM import, server-enforced roles, Decimal finance engine, audit log, demo-mode, tests, Docker, docs.

**Architecture:** One Next.js (App Router, TS strict) app. PostgreSQL via Prisma is the financial system of record; Bitrix24 is identity + CRM reference only. Pure `src/domain/finance` calc engine (Decimal in → Decimal|null out) is the single source of formulas. Thin route handlers: zod → resolveSession → requirePermission → domain → `prisma.$transaction(mutation + audit)`. Every portal-owned query goes through `withPortal(portalId)`.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, React, PostgreSQL, Prisma, `decimal.js`/`Prisma.Decimal`, Tailwind, shadcn/ui, Lucide, Recharts, React Hook Form, Zod, `jose`, Vitest, Testing Library, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-08-project-economics-design.md` (+ `docs/REQUIREMENTS.md`, the 78-point ТЗ, source of truth).

## Global Constraints

- Financial correctness > data safety > security > features > UX > visuals. On any conflict, higher wins.
- Money is `Decimal` end-to-end. No `number` arithmetic in finance logic. `decimal.js`: 40 sig digits, `ROUND_HALF_UP`. DB columns `Decimal(18,2)` money, `Decimal(10,2)` hours/rate.
- PLAN and FACT are separate `FinancialEntry` rows. No `planAmount`/`factAmount` on one row.
- Financial deletes are soft (`deletedAt`, `deletedById`). Soft-deleted rows are excluded from every aggregate but remain in the audit log.
- `margin(income, profit)` returns `null` when `income == 0`. Never `Infinity`/`NaN`/`0%`. API serializes `null`; UI renders `—`.
- Margin deltas are percentage points: `"+4,2 п.п."`, not `"%"`.
- The string `"₽"` and `Intl.NumberFormat('ru-RU')` appear only in `src/lib/format/`.
- Every permission is re-checked server-side. `GET /api/projects/:id` for a non-member EMPLOYEE → `403`. Any finance mutation by EMPLOYEE → `403`.
- Every portal-owned Prisma query is scoped by `portalId` via `withPortal`. Portal A must never read portal B data by id.
- Every mutating handler wraps mutation + audit write in one `prisma.$transaction`.
- Bitrix `auth`/`refresh` tokens: never logged, never sent to the client, AES-256-GCM encrypted at rest (`APP_ENCRYPTION_KEY`).
- TypeScript strict. No `any` / `@ts-ignore` / `@ts-expect-error` to silence the compiler without an inline comment justifying it.
- Demo role switcher must be inert unless `DEMO_MODE=true`.
- Currency: RUB only. No multi-currency, VAT, invoicing, payroll, notifications, WebSockets, Excel export (ТЗ §75).
- Commit after each task with a working build. Never commit `.env`, `node_modules`, secrets.
- CRM API: `crm.item.list` / `crm.item.get` (Deal `entityTypeId=2`, Company `entityTypeId=4`). Never `crm.deal.*`.

---

## Phase 1 — Architecture + Prisma + infra skeleton

### Task 1.1: Next.js app scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.eslintrc` / `eslint.config.mjs`, `.prettierrc`, `postcss.config.mjs`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.env.example`, `.nvmrc`

**Interfaces:**
- Produces: `npm run dev|build|lint|typecheck`, Tailwind + design tokens available, `@/*` path alias → `src/*`.

- [ ] **Step 1:** `npx create-next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --no-turbopack` (accept into the non-empty dir; keep our `.gitignore`, `CLAUDE.md`, `docs/`). If Next 16 is not yet stable on npm, use latest 15.x and note the version in `docs/DECISIONS.md` ADR-005.
- [ ] **Step 2:** Add scripts to `package.json`: `"typecheck": "tsc --noEmit"`, `"db:migrate": "prisma migrate dev"`, `"db:migrate:deploy": "prisma migrate deploy"`, `"db:seed": "tsx prisma/seed.ts"`, `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:e2e": "playwright test"`, `"format": "prettier --write ."`.
- [ ] **Step 3:** Set `tsconfig.json` `"strict": true`, `"noUncheckedIndexedAccess": true`, `"forceConsistentCasingInFileNames": true`.
- [ ] **Step 4:** Write `.env.example` with every var from ТЗ §61 + `TEST_DATABASE_URL`, `NODE_ENV`. No real values.
- [ ] **Step 5:** Replace `src/app/page.tsx` with a placeholder that renders `Экономика проектов`. `src/app/globals.css`: design tokens from spec §34 as CSS variables (`--bg:#F5F5F7`, `--card:#FFF`, `--fg:#111`, `--muted`, `--border`, `--accent`, `--positive`, `--warning`, `--negative`, radii). System font stack (ТЗ §35).
- [ ] **Step 6:** Run `npm run lint && npm run typecheck && npm run build`. Expected: all pass.
- [ ] **Step 7:** Commit: `chore: scaffold Next.js app with TS strict, Tailwind, tooling`.

### Task 1.2: Docker + Postgres for dev and test

**Files:**
- Create: `docker-compose.yml` (app + `db`), `docker-compose.test.yml` (`db-test` only), `Dockerfile`, `.dockerignore`, `deploy/nginx.example.conf`, `deploy/README.md`

**Interfaces:**
- Produces: `docker compose up --build` serves the app on `APP_URL`; `db` has a healthcheck; `docker compose -f docker-compose.test.yml up -d` gives a test DB on `localhost:5433`.

- [ ] **Step 1:** `docker-compose.yml`: `db` (`postgres:17-alpine`, volume, `healthcheck: pg_isready`), `app` (build ., `depends_on: db healthy`, env from `.env`, command runs `prisma migrate deploy && node server.js` via an entrypoint script).
- [ ] **Step 2:** `Dockerfile`: multi-stage (deps → build with `output: "standalone"` → runner as non-root), `HEALTHCHECK` hitting `/api/health`.
- [ ] **Step 3:** `next.config.ts`: `output: "standalone"`.
- [ ] **Step 4:** `docker-compose.test.yml`: `db-test` on host port `5433`, tmpfs volume, healthcheck.
- [ ] **Step 5:** `deploy/nginx.example.conf`: reverse proxy `:443 → app:3000`, headers for iframe embedding (`X-Frame-Options` removed / CSP `frame-ancestors https://*.bitrix24.ru https://*.bitrix24.com`), TLS placeholders. `deploy/README.md`: VPS steps.
- [ ] **Step 6:** Create `src/app/api/health/route.ts` → `{ status: "ok" }` (200) after a `SELECT 1` via Prisma; `503` if DB down.
- [ ] **Step 7:** `docker compose -f docker-compose.test.yml up -d` then `pg_isready` — verify healthy. `docker compose up --build` — verify app responds (will fail health until Prisma exists; acceptable, revisit end of phase).
- [ ] **Step 8:** Commit: `chore: docker compose for dev + test postgres, standalone Dockerfile`.

### Task 1.3: Prisma schema + first migration

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db/client.ts`
- Modify: `package.json` (prisma seed config)

**Interfaces:**
- Produces: all enums + models from spec §5; `prisma` singleton exported as `db` from `@/lib/db/client`.

- [ ] **Step 1:** Write `schema.prisma` — datasource `postgresql`, generator `prisma-client-js`. Enums: `AppRole`, `ProjectStatus`, `ProjectSource`, `CrmEntityType`, `FinanceDirection`, `BudgetType`, `CalculationMode`, `CategoryKind`, `AuditAction` (full list ТЗ §30).
- [ ] **Step 2:** Models `PortalInstallation`, `AppUser`, `Project`, `ProjectMember`, `FinanceCategory`, `FinancialEntry`, `AuditLog` — fields per ТЗ §45–47 + spec §5. Money `@db.Decimal(18,2)`, hours/rate `@db.Decimal(10,2)`. Composite uniques with `portalId`. Indexes per ТЗ §48 + composite `(portalId, projectId, budgetType, direction, deletedAt)`, `(portalId, operationDate)`, `(portalId, entityType, entityId)` on audit.
- [ ] **Step 3:** `src/lib/db/client.ts`: standard Next.js Prisma singleton (global in dev).
- [ ] **Step 4:** Start test DB, `DATABASE_URL=<test> npx prisma migrate dev --name init`. Expected: migration created + applied, client generated.
- [ ] **Step 5:** `npm run typecheck`. Expected: pass.
- [ ] **Step 6:** Commit: `feat(db): prisma schema and initial migration`.

### Task 1.4: Vitest + Playwright config

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `tests/helpers/db.ts`, `tests/unit/.gitkeep`, `tests/integration/.gitkeep`, `tests/e2e/.gitkeep`

**Interfaces:**
- Produces: `npm run test` runs Vitest (node env for integration, jsdom for component); `resetDb()` + `seedPortal(overrides)` helpers; `npm run test:e2e` runs Playwright against `webServer` (demo-mode).

- [ ] **Step 1:** `vitest.config.ts` — projects: `unit` (environment `node`), `integration` (environment `node`, `setupFiles: ['tests/helpers/db.ts']`, `env: { DATABASE_URL: TEST_DATABASE_URL }`, `pool: 'forks'`, `singleThread`), `components` (`jsdom`).
- [ ] **Step 2:** `tests/helpers/db.ts` — `resetDb()` truncates all tables; `seedPortal()` inserts one `PortalInstallation` + default categories + returns ids. `beforeEach(resetDb)` for integration.
- [ ] **Step 3:** Add a trivial `tests/unit/sanity.test.ts` (`expect(1+1).toBe(2)`). Run `npm run test`. Expected: pass.
- [ ] **Step 4:** `playwright.config.ts` — `webServer: { command: 'npm run build && npm run start', env: { DEMO_MODE: 'true', DATABASE_URL: <test> } }`, `baseURL`, chromium only, `testDir: tests/e2e`.
- [ ] **Step 5:** Commit: `test: vitest (unit/integration/components) and playwright config`.

**Phase 1 checkpoint:** `lint`, `typecheck`, `test`, `build` all green. Commit any fixups.

---

## Phase 2 — Domain: finance engine (TDD, correctness-critical)

> This phase is pure functions. No DB. Write every test first. All ТЗ §65 cases are mandatory.

### Task 2.1: Money primitives + types

**Files:**
- Create: `src/domain/finance/types.ts`, `src/domain/finance/money.ts`, `tests/unit/finance/money.test.ts`

**Interfaces:**
- Produces:
  - `type Money = Prisma.Decimal` (re-export `Decimal` from `@prisma/client` / `decimal.js`)
  - `m(value: string | number | Decimal): Decimal` — constructor, configures rounding once
  - `ZERO: Decimal`
  - `type EntryInput = { direction: FinanceDirection; budgetType: BudgetType; amount: Decimal; categoryId: string; operationDate: Date; deletedAt: Date | null }`
  - `type ProjectEconomics = { factIncome: Decimal; factExpense: Decimal; factProfit: Decimal; factMargin: Decimal | null; planIncome: Decimal; planExpense: Decimal; planProfit: Decimal; planMargin: Decimal | null; incomeDeviation: Decimal; expenseDeviation: Decimal; profitDeviation: Decimal; marginDeltaPoints: Decimal | null }`

- [ ] **Step 1: failing test** `tests/unit/finance/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { m, ZERO } from '@/domain/finance/money';

describe('money', () => {
  it('adds without float error', () => {
    expect(m('0.1').plus(m('0.2')).toString()).toBe('0.3');
  });
  it('ZERO is 0', () => {
    expect(ZERO.isZero()).toBe(true);
  });
  it('accepts number, string, Decimal', () => {
    expect(m(1000).equals(m('1000'))).toBe(true);
  });
});
```

- [ ] **Step 2:** Run `npm run test -- money`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `money.ts`: `import { Prisma } from '@prisma/client'; export const Decimal = Prisma.Decimal; Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP }); export const m = (v) => new Decimal(v); export const ZERO = m(0);`. Write `types.ts` per Interfaces.
- [ ] **Step 4:** Run `npm run test -- money`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(finance): money primitives and domain types`.

### Task 2.2: calculations.ts — profit, margin, hours×rate, deviations

**Files:**
- Create: `src/domain/finance/calculations.ts`, `tests/unit/finance/calculations.test.ts`

**Interfaces:**
- Consumes: `m`, `ZERO`, `Money` from `./money`.
- Produces:
  - `profit(income: Decimal, expense: Decimal): Decimal`
  - `margin(income: Decimal, profit: Decimal): Decimal | null` — `null` iff `income.isZero()`; else `profit.div(income).mul(100)`
  - `hoursRateAmount(hours: Decimal, rate: Decimal): Decimal` — `hours.mul(rate)` rounded to 2dp (`.toDecimalPlaces(2)`)
  - `deviation(fact: Decimal, plan: Decimal): Decimal` — `fact.minus(plan)`
  - `marginDeltaPoints(factMargin: Decimal | null, planMargin: Decimal | null): Decimal | null` — `null` if either is `null`; else `factMargin.minus(planMargin)`

- [ ] **Step 1: failing test** — encode every ТЗ §65 case:

```ts
import { describe, it, expect } from 'vitest';
import { m } from '@/domain/finance/money';
import { profit, margin, hoursRateAmount, deviation, marginDeltaPoints } from '@/domain/finance/calculations';

describe('profit', () => {
  it('1_000_000 income - 700_000 expense = 300_000', () => {
    expect(profit(m(1_000_000), m(700_000)).toString()).toBe('300000');
  });
  it('loss: 500_000 - 700_000 = -200_000', () => {
    expect(profit(m(500_000), m(700_000)).toString()).toBe('-200000');
  });
});

describe('margin', () => {
  it('300_000 / 1_000_000 = 30', () => {
    expect(margin(m(1_000_000), m(300_000))!.toString()).toBe('30');
  });
  it('zero income => null', () => {
    expect(margin(m(0), m(-100_000))).toBeNull();
  });
  it('loss margin: -200_000 / 500_000 = -40', () => {
    expect(margin(m(500_000), m(-200_000))!.toString()).toBe('-40');
  });
});

describe('hoursRateAmount', () => {
  it('12.5 x 2000 = 25000', () => {
    expect(hoursRateAmount(m('12.5'), m(2000)).toString()).toBe('25000');
  });
  it('rounds to 2dp half-up', () => {
    expect(hoursRateAmount(m('1.005'), m(1)).toString()).toBe('1.01');
  });
});

describe('deviation', () => {
  it('fact - plan', () => {
    expect(deviation(m(900_000), m(1_000_000)).toString()).toBe('-100000');
  });
});

describe('marginDeltaPoints', () => {
  it('34.2 - 30 = 4.2 (points)', () => {
    expect(marginDeltaPoints(m('34.2'), m(30))!.toString()).toBe('4.2');
  });
  it('null when plan margin undefined', () => {
    expect(marginDeltaPoints(m(30), null)).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `npm run test -- calculations`. Expected: FAIL.
- [ ] **Step 3:** Implement `calculations.ts` per Interfaces.
- [ ] **Step 4:** Run `npm run test -- calculations`. Expected: PASS (all cases).
- [ ] **Step 5:** Commit: `feat(finance): profit, margin, hours×rate, deviations`.

### Task 2.3: aggregates.ts — project & company rollups, deleted exclusion, expense structure, time series

**Files:**
- Create: `src/domain/finance/aggregates.ts`, `src/domain/finance/index.ts`, `tests/unit/finance/aggregates.test.ts`

**Interfaces:**
- Consumes: everything from `./calculations`, `./money`, `./types`.
- Produces:
  - `aggregateProject(entries: EntryInput[]): ProjectEconomics` — filters `deletedAt != null` first; sums by (direction, budgetType); computes profit/margin/deviations/marginDeltaPoints.
  - `aggregateCompany(perProject: ProjectEconomics[]): ProjectEconomics` — element-wise sum of money fields, margins recomputed from summed income/profit.
  - `expenseStructure(entries: EntryInput[], budgetType: BudgetType): { categoryId: string; amount: Decimal }[]` — FACT/PLAN EXPENSE only, non-deleted, grouped, sorted desc.
  - `timeSeries(entries: EntryInput[], opts: { from: Date; to: Date; granularity: 'day'|'week'|'month' }): { bucket: string; factIncome: Decimal; factExpense: Decimal; planIncome: Decimal; planExpense: Decimal }[]`

- [ ] **Step 1: failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { m } from '@/domain/finance/money';
import { aggregateProject, expenseStructure } from '@/domain/finance/aggregates';

const e = (o: Partial<Parameters<typeof aggregateProject>[0][number]>) => ({
  direction: 'INCOME', budgetType: 'FACT', amount: m(0), categoryId: 'c1',
  operationDate: new Date('2026-01-01'), deletedAt: null, ...o,
}) as any;

describe('aggregateProject', () => {
  it('computes fact profit and 30% margin', () => {
    const r = aggregateProject([
      e({ direction: 'INCOME', budgetType: 'FACT', amount: m(1_000_000) }),
      e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(700_000) }),
    ]);
    expect(r.factProfit.toString()).toBe('300000');
    expect(r.factMargin!.toString()).toBe('30');
  });

  it('excludes soft-deleted entries', () => {
    const r = aggregateProject([
      e({ direction: 'INCOME', budgetType: 'FACT', amount: m(1_000_000) }),
      e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(500_000), deletedAt: new Date() }),
    ]);
    expect(r.factExpense.toString()).toBe('0');
    expect(r.factProfit.toString()).toBe('1000000');
  });

  it('keeps PLAN and FACT independent', () => {
    const r = aggregateProject([
      e({ budgetType: 'PLAN', direction: 'INCOME', amount: m(1_000_000) }),
      e({ budgetType: 'FACT', direction: 'INCOME', amount: m(900_000) }),
    ]);
    expect(r.planIncome.toString()).toBe('1000000');
    expect(r.factIncome.toString()).toBe('900000');
    expect(r.incomeDeviation.toString()).toBe('-100000');
  });

  it('zero fact income => factMargin null', () => {
    const r = aggregateProject([e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(100_000) })]);
    expect(r.factMargin).toBeNull();
  });
});

describe('expenseStructure', () => {
  it('groups fact expenses by category desc', () => {
    const r = expenseStructure([
      e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(100), categoryId: 'a' }),
      e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(300), categoryId: 'b' }),
      e({ direction: 'EXPENSE', budgetType: 'FACT', amount: m(50), categoryId: 'a', deletedAt: new Date() }),
    ], 'FACT');
    expect(r).toEqual([{ categoryId: 'b', amount: m(300) }, { categoryId: 'a', amount: m(100) }]);
  });
});
```

- [ ] **Step 2:** Run `npm run test -- aggregates`. Expected: FAIL.
- [ ] **Step 3:** Implement `aggregates.ts`. `index.ts` re-exports the public surface of `money`, `types`, `calculations`, `aggregates`.
- [ ] **Step 4:** Run `npm run test -- finance`. Expected: all finance tests PASS.
- [ ] **Step 5:** Add `timeSeries` test (day + month granularity, plan+fact separation) and implement.
- [ ] **Step 6:** Run `npm run test && npm run typecheck`. Expected: PASS.
- [ ] **Step 7:** Commit: `feat(finance): project/company aggregates, expense structure, time series`.

---

## Phase 3 — Formatting, errors, auth, permissions (foundation for handlers)

### Task 3.1: format module (the only home of ₽ and ru-RU)

**Files:**
- Create: `src/lib/format/money.ts`, `src/lib/format/number.ts`, `src/lib/format/percent.ts`, `src/lib/format/date.ts`, `src/lib/format/index.ts`, `tests/unit/format/format.test.ts`

**Interfaces:**
- Produces:
  - `formatRub(v: Decimal | null): string` — `null`/undefined → `"—"`; else `"1 250 000 ₽"` (non-breaking thin space, `Intl.NumberFormat('ru-RU')`, 0 fraction digits unless kopecks present).
  - `formatPercent(v: Decimal | null, opts?: { digits?: number }): string` — `null` → `"—"`; else `"30,0 %"`.
  - `formatPoints(v: Decimal | null): string` — `null` → `"—"`; else signed `"+4,2 п.п."` / `"−1,3 п.п."`.
  - `formatDate(d: Date): string` — `"8 сент. 2026"`. `formatDateTime(d)`.

- [ ] **Step 1: failing test** covering `—` for null, thin-space grouping, `п.п.` suffix, sign handling.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. `grep -rn '₽' src/` must return only `src/lib/format/`.
- [ ] **Step 4:** Run → PASS. Add an eslint `no-restricted-syntax` rule forbidding the `₽` literal outside `src/lib/format` (or a test that greps).
- [ ] **Step 5:** Commit: `feat(format): centralized ru-RU money/percent/points/date formatting`.

### Task 3.2: AppError + error mapping

**Files:**
- Create: `src/lib/errors.ts`, `tests/unit/errors.test.ts`

**Interfaces:**
- Produces:
  - `class AppError extends Error { code: string; httpStatus: number; userMessage: string }`
  - factory helpers: `notFound(msg)`, `forbidden(msg?)`, `badRequest(msg)`, `unauthorized(msg?)`, `upstream(msg)` (Bitrix), `conflict(msg)`
  - `toErrorResponse(err: unknown): { status: number; body: { error: { code: string; message: string } } }` — maps `AppError`, `ZodError` (→400 with field messages), Prisma `P2002`→409 / `P2025`→404, unknown→500 `"Что-то пошло не так"`. Never leaks Prisma codes in `message`.

- [ ] **Step 1: failing test:** ZodError → 400 human message; Prisma `P2002` → 409 `"Запись с такими данными уже существует"`; unknown → 500 generic; `AppError` passthrough.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(errors): AppError and safe error-response mapping`.

### Task 3.3: session cookie (jose)

**Files:**
- Create: `src/lib/auth/session.ts`, `tests/unit/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `type SessionPayload = { portalId: string; appUserId: string; role: AppRole; demo: boolean }`
  - `signSession(p: SessionPayload): Promise<string>` (HS256, `SESSION_SECRET`, 8h exp)
  - `verifySession(token: string): Promise<SessionPayload | null>` (null on invalid/expired)
  - `SESSION_COOKIE = 'pe_session'`, `cookieOptions(): { httpOnly; secure; sameSite: 'none'; path; maxAge }`

- [ ] **Step 1: failing test:** round-trip sign→verify; tampered token → null; expired (mock time) → null.
- [ ] **Step 2:** FAIL → `npm i jose` → implement → PASS.
- [ ] **Step 3:** Commit: `feat(auth): signed session cookie`.

### Task 3.4: permissions module

**Files:**
- Create: `src/lib/permissions/index.ts`, `src/lib/permissions/guard.ts`, `tests/unit/permissions/permissions.test.ts`

**Interfaces:**
- Consumes: `AppRole` from `@prisma/client`, `forbidden` from `@/lib/errors`.
- Produces:
  - `type Actor = { role: AppRole; appUserId: string }`
  - `type ProjectContext = { memberUserIds: string[] }`
  - `can = { viewProject(a, ctx), mutateProject(a), archiveProject(a), mutateFinance(a), manageMembers(a), manageCategories(a), viewHistory(a), assignRole(a), manageSettings(a) }` — each `→ boolean`
  - `requirePermission(ok: boolean, msg?: string): void` — throws `forbidden()` when `!ok`
- Rules: ADMIN → all true. MANAGER → all true except `assignRole`, `manageSettings`. EMPLOYEE → `viewProject` true only if `a.appUserId ∈ ctx.memberUserIds`; `viewHistory` false; every mutate false.

- [ ] **Step 1: failing test** — full 3×9 matrix asserted explicitly, plus EMPLOYEE member vs non-member `viewProject`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(permissions): server-side capability checks + guard`.

### Task 3.5: withPortal data-access helper

**Files:**
- Create: `src/lib/db/with-portal.ts`, `tests/integration/with-portal.test.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db/client`.
- Produces: `withPortal(portalId: string)` → object exposing `project`, `financialEntry`, `category`, `member`, `user`, `audit` with methods that **always inject `portalId`** into `where`/`data` (`findMany`, `findByIdOrThrow(id)` → throws `notFound` if row's `portalId` ≠ scope, `create`, `update`, `softDeleteEntry`, ...). Also `raw` escape hatch (documented, discouraged).

- [ ] **Step 1: failing integration test:** seed portal A + portal B, each with a project. `withPortal(A).project.findByIdOrThrow(projectB.id)` → throws `notFound` (404), not returns B. `withPortal(A).project.findMany()` returns only A's.
- [ ] **Step 2:** Run `npm run test -- with-portal` (needs test DB up). Expected: FAIL.
- [ ] **Step 3:** Implement `with-portal.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(db): withPortal scoped data access`.

### Task 3.6: resolveSession + handler wrapper (CSRF, error mapping)

**Files:**
- Create: `src/lib/auth/resolve.ts`, `src/lib/auth/demo.ts`, `src/server/handler.ts`, `src/lib/csrf.ts`, `tests/integration/handler.test.ts`

**Interfaces:**
- Produces:
  - `resolveSession(req): Promise<{ portal; user: AppUser; actor: Actor } | null>` — reads cookie, `verifySession`, loads `AppUser` + `PortalInstallation` from DB, recomputes `role` from `AppUser.role` (ADMIN if `user.isBitrixAdmin`). Returns null if any missing/inactive.
  - `route(handler, opts?: { auth?: boolean; csrf?: boolean })` — wraps a `(ctx: { req; portal; user; actor; params }) => Promise<Response|object>`; on throw → `toErrorResponse`; enforces CSRF double-submit on non-GET when `csrf !== false`; returns 401 when `auth !== false` and no session.
  - `issueDemoSession(role: AppRole)` / `getDemoActorId(role)` in `demo.ts` — throws unless `DEMO_MODE==='true'`.

- [ ] **Step 1: failing integration test:** handler with `auth:true` and no cookie → 401; with valid demo cookie → 200 and `ctx.actor.role` correct; POST without csrf header → 403; POST with matching csrf cookie+header → passes.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(server): resolveSession, route() wrapper with CSRF + error mapping`.

---

## Phase 4 — Demo auth, app shell, roles UI

### Task 4.1: demo seed dataset

**Files:**
- Create: `src/lib/demo/seed-data.ts`, `prisma/seed.ts`, `tests/integration/seed.test.ts`

**Interfaces:**
- Produces: `seedDemoPortal(db): Promise<void>` — idempotent (`memberId: 'demo'`). Creates: portal; users (1 ADMIN "Анна Ковалёва", 1 MANAGER "Дмитрий Соколов", 3 EMPLOYEE); default categories (ТЗ §1) + 2 custom; 6 projects covering ТЗ §68 states (profitable «Внедрение CRM „Альфа"»; loss-making «AI-ассистент отдела продаж»; on-plan «Поддержка CRM „Север"»; over-budget «Интеграция 1С — „Вектор"»; no fact income «Корпоративный портал „Меридиан"»; archived «Миграция с Мегаплана»); PLAN+FACT entries incl. HOURS_RATE dev expenses; some audit log rows; some soft-deleted entries.
- `prisma/seed.ts` calls `seedDemoPortal`.

- [ ] **Step 1:** Write `seed-data.ts` with realistic numbers. Money as strings.
- [ ] **Step 2:** `tests/integration/seed.test.ts`: after `seedDemoPortal`, assert 6 projects, aggregates of «Альфа» → positive margin, «AI-ассистент» → negative profit, «Меридиан» → `factMargin === null`.
- [ ] **Step 3:** Run → iterate seed numbers until asserts pass.
- [ ] **Step 4:** `DATABASE_URL=<test> npm run db:seed` — runs clean.
- [ ] **Step 5:** Commit: `feat(demo): realistic demo portal seed`.

### Task 4.2: demo bootstrap + role switch endpoint

**Files:**
- Create: `src/app/api/demo/switch-role/route.ts`, `src/middleware.ts` (or a root layout server check), `src/app/api/session/route.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: visiting any page with `DEMO_MODE=true` and no valid session → server issues demo ADMIN session (ensures seed exists). `POST /api/demo/switch-role { role }` → re-issues cookie (403 unless demo). `GET /api/session` → `{ user, role, demo }` for the client shell.

- [ ] **Step 1:** Integration test: `POST /api/demo/switch-role {role:'EMPLOYEE'}` in demo → sets cookie, `GET /api/session` shows EMPLOYEE. With `DEMO_MODE` unset → 403.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(demo): session bootstrap + role switcher endpoint`.

### Task 4.3: app shell — left nav, header, demo role switch control

**Files:**
- Create: `src/components/layout/app-shell.tsx`, `src/components/layout/nav.tsx`, `src/components/layout/demo-role-switch.tsx`, `src/components/layout/user-badge.tsx`, `src/app/(app)/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `GET /api/session`.
- Produces: shell with nav (Дашборд, Проекты, Финансы, Статьи [ADMIN/MANAGER], История [ADMIN/MANAGER], Настройки [ADMIN]); header with period placeholder + actions; `DemoRoleSwitch` rendered only when `session.demo === true`. Skeleton while session loads.

- [ ] **Step 1:** Build components (shadcn `button`, `dropdown-menu`, `avatar`). Nav items filtered by role.
- [ ] **Step 2:** Component test (`components` project): given `role='EMPLOYEE'`, nav does not render "Статьи"/"История"/"Настройки"; given `demo=false`, `DemoRoleSwitch` renders nothing.
- [ ] **Step 3:** `npm run test && npm run build`. PASS.
- [ ] **Step 4:** Commit: `feat(ui): app shell with role-aware nav and demo role switch`.

---

## Phase 5 — Projects (CRUD, statuses, archive, members)

### Task 5.1: project DTOs (zod)

**Files:** Create `src/server/dto/project.ts`, `tests/unit/dto/project.test.ts`

**Interfaces:**
- Produces: `createProjectSchema`, `updateProjectSchema`, `listProjectsQuerySchema` (`status?: 'ACTIVE'|'COMPLETED'|'ARCHIVED'|'ALL'`, `q?`, `sort?`, `page?`, `memberId?`). Rule: `endDate >= startDate` when both present (`.refine`). `name` required, trimmed, 1–200.

- [ ] Step 1: failing test — `endDate < startDate` fails; missing name fails; valid passes. Step 2: FAIL → implement → PASS. Step 3: commit `feat(dto): project schemas`.

### Task 5.2: GET /api/projects + GET /api/projects/:id (permission-scoped)

**Files:** Create `src/server/api/projects/list.ts`, `src/server/api/projects/get.ts`, `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `tests/integration/projects/read.test.ts`

**Interfaces:**
- Consumes: `route`, `withPortal`, `can`, `requirePermission`, `aggregateProject`.
- Produces: `GET /api/projects` → list with per-project FACT economics for the active period (query `from`/`to`); EMPLOYEE sees only member projects. `GET /api/projects/:id` → project + economics + members + CRM link; EMPLOYEE non-member → **403**; wrong portal id → 404.

- [ ] **Step 1: failing integration test** (the ТЗ §66 core):

```ts
// seed: portal, manager, employee E, project A (E is member), project B (E not member)
it('employee GET own project -> 200', async () => { /* login E, GET /api/projects/{A} -> 200 */ });
it('employee GET foreign project -> 403', async () => { /* login E, GET /api/projects/{B} -> 403 */ });
it('manager GET any project -> 200', async () => { /* login M, GET /api/projects/{B} -> 200 */ });
it('cross-portal id -> 404', async () => { /* login portalA admin, GET project of portalB -> 404 */ });
it('list as employee returns only member projects', async () => { /* ... */ });
```

- [ ] **Step 2:** FAIL → implement handlers (no N+1: one `findMany` for projects, one grouped `financialEntry.groupBy` for economics, stitch in memory). → PASS.
- [ ] **Step 3:** Commit: `feat(api): project read endpoints with server-enforced access`.

### Task 5.3: POST / PATCH / archive / restore project (+ audit, transaction)

**Files:** Create `src/server/api/projects/create.ts`, `update.ts`, `archive.ts`, `src/app/api/projects/[id]/archive/route.ts`; `tests/integration/projects/write.test.ts`

**Interfaces:**
- Produces: `POST /api/projects` (MANAGER/ADMIN; EMPLOYEE → 403) — creates project + `ProjectMember` rows + `AuditLog PROJECT_CREATED` in one `$transaction`. `PATCH` → `PROJECT_UPDATED` with `changedFields`/`before`/`after`. `POST .../archive { archived: boolean }` → status ARCHIVED/ACTIVE + `PROJECT_ARCHIVED`/`PROJECT_RESTORED`.

- [ ] **Step 1: failing test:** employee POST → 403; manager POST → 201 + audit row exists; PATCH name → audit `changedFields:['name']`; archive → status + audit; **atomicity:** monkeypatch audit create to throw once → project not created (count unchanged).
- [ ] **Step 2:** FAIL → implement. Shared `writeAudit(tx, ...)` from `src/lib/audit.ts` (create it here).
- [ ] **Step 3:** PASS. Commit: `feat(api): project create/update/archive with atomic audit`.

### Task 5.4: project member management

**Files:** Create `src/server/api/projects/members.ts`, `src/app/api/projects/[id]/members/route.ts`, `tests/integration/projects/members.test.ts`

**Interfaces:**
- Produces: `PUT /api/projects/:id/members { userIds: string[] }` (MANAGER/ADMIN) — diffs membership, writes `PROJECT_MEMBER_ADDED`/`PROJECT_MEMBER_REMOVED` per change, one transaction. Validates all `userIds` belong to the portal.

- [ ] Step 1: failing test (add 2 / remove 1 → 3 audit rows; foreign user id → 400; employee → 403). Step 2: FAIL → implement → PASS. Step 3: commit `feat(api): project members with audit`.

### Task 5.5: Projects UI — list page

**Files:** Create `src/app/(app)/projects/page.tsx`, `src/components/projects/projects-table.tsx`, `src/components/projects/status-badge.tsx`, `src/components/projects/project-filters.tsx`, `src/components/ui/data-table.tsx`, `src/components/common/empty-state.tsx`, `src/components/common/table-skeleton.tsx`

**Interfaces:**
- Consumes: `GET /api/projects`. Produces: `/projects` — search + status filter (`Активные/Завершённые/Архив/Все`, URL-synced), sortable table (name/income/expense/profit/margin), row → `/projects/[id]`, `Создать проект` button, empty state per ТЗ §37, skeleton loading.

- [ ] **Step 1:** Build the reusable `data-table` (sort, hover, sticky header, no heavy borders — spec §36), `empty-state`, `table-skeleton`.
- [ ] **Step 2:** Build `/projects` page (server component fetch + client filter controls syncing `useSearchParams`).
- [ ] **Step 3:** Component test: renders rows from mock data; empty state when none; clicking a header updates `?sort=`.
- [ ] **Step 4:** `npm run build`. Commit: `feat(ui): projects list with filters, sorting, empty/loading states`.

### Task 5.6: Projects UI — create/edit form (manual)

**Files:** Create `src/app/(app)/projects/new/page.tsx`, `src/components/projects/project-form.tsx`, `src/components/projects/member-select.tsx`, `src/app/(app)/projects/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `createProjectSchema` (shared), `GET /api/users`, project write endpoints.
- Produces: RHF + zodResolver form (name, description, status, startDate, endDate, clientName, internal comment, members multi-select with search+avatar). Toic: `Проект создан` toast, redirect to card. (CRM-import tab is Phase 10.)

- [ ] **Step 1:** Build `member-select` (shadcn `command` + `popover`, avatars). Build `project-form`. Wire pages.
- [ ] **Step 2:** Component test: submitting with empty name shows error; valid submit calls fetch with correct body.
- [ ] **Step 3:** Manual: create a project in demo → appears in list. Commit: `feat(ui): manual project create/edit form with member select`.

---

## Phase 6 — Finance entries (CRUD, FIXED + HOURS_RATE, PLAN/FACT, soft delete)

### Task 6.1: finance DTOs (zod, server-side rules ТЗ §51)

**Files:** Create `src/server/dto/finance.ts`, `tests/unit/dto/finance.test.ts`

**Interfaces:**
- Produces: `createEntrySchema` / `updateEntrySchema` / `listEntriesQuerySchema`. Discriminated on `calculationMode`: `FIXED` → `amount > 0` required, `hours`/`hourlyRate` forbidden/ignored; `HOURS_RATE` → `hours > 0` and `hourlyRate >= 0` required, `amount` omitted (server computes). `direction`+`budgetType` required. `operationDate` required. Optional fields per ТЗ §12–13. Amounts parsed as `Decimal` (string input).

- [ ] **Step 1: failing test:** `FIXED` w/o amount → fail; `FIXED` amount 0 → fail; `HOURS_RATE` w/o hours → fail; `HOURS_RATE` hours -1 → fail; valid both → pass; `HOURS_RATE` with `amount` present → strips it.
- [ ] **Step 2:** FAIL → implement (`z.discriminatedUnion`) → PASS.
- [ ] **Step 3:** Commit: `feat(dto): finance entry schemas with FIXED/HOURS_RATE rules`.

### Task 6.2: create finance entry (server recompute, audit, transaction)

**Files:** Create `src/server/api/finance/create.ts`, `src/app/api/finance/route.ts`, `tests/integration/finance/create.test.ts`

**Interfaces:**
- Consumes: `hoursRateAmount`, `createEntrySchema`, `can.mutateFinance`, `withPortal`, `writeAudit`.
- Produces: `POST /api/finance` — EMPLOYEE → **403**; MANAGER/ADMIN → creates entry. For `HOURS_RATE`: server sets `amount = hoursRateAmount(hours, rate)` and stores `hours`, `hourlyRate` snapshot; **ignores any client amount**. Validates project + category in portal, category `kind` matches `direction`. `AuditLog FINANCE_CREATED` in same `$transaction`.

- [ ] **Step 1: failing test:** employee → 403; manager `HOURS_RATE` 100×2000, client sends `amount: 1` → stored `amount === '200000'`; category kind mismatch (INCOME category on EXPENSE) → 400; audit row created; audit-throws → entry not created.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(api): create finance entry with server-side amount recompute`.

### Task 6.3: update / soft-delete / duplicate finance entry

**Files:** Create `src/server/api/finance/update.ts`, `delete.ts`, `src/app/api/finance/[id]/route.ts`, `tests/integration/finance/mutate.test.ts`

**Interfaces:**
- Produces: `PATCH /api/finance/:id` — recompute amount for `HOURS_RATE`; `FINANCE_UPDATED` audit with before/after/changedFields. `DELETE /api/finance/:id` — sets `deletedAt`/`deletedById` (soft); `FINANCE_DELETED` audit; **never** hard delete. All in `$transaction`. Wrong portal → 404. EMPLOYEE → 403.

- [ ] **Step 1: failing test:** update amount → audit `25000 → 32000` captured; delete → `deletedAt` set, row still in DB, audit `FINANCE_DELETED`; deleted entry excluded from `GET /api/projects/:id` economics; employee → 403.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(api): update + soft-delete finance entries with audit`.

### Task 6.4: list finance entries (backend filter/sort/pagination)

**Files:** Create `src/server/api/finance/list.ts`, `tests/integration/finance/list.test.ts`

**Interfaces:**
- Produces: `GET /api/finance` — filters: `from`,`to`,`projectId`,`direction`,`budgetType`,`categoryId`,`employeeId`,`authorId`,`q` (comment/description ilike). Sort: `date`,`amount`,`project`. `page`,`pageSize` (default 25, max 100). Returns `{ rows, total, page, pageSize }`. EMPLOYEE → only entries of member projects. Excludes soft-deleted unless `?includeDeleted=true` (ADMIN/MANAGER; shown struck-through).

- [ ] **Step 1: failing test:** pagination totals; employee scoping; `q` match; sort by amount desc; deleted hidden by default.
- [ ] **Step 2:** FAIL → implement (single query with `where` build + `skip`/`take` + `count`). → PASS.
- [ ] **Step 3:** Commit: `feat(api): finance ledger list with backend filter/sort/pagination`.

### Task 6.5: Finance entry form UI (fast add — ТЗ §55)

**Files:** Create `src/components/finance/entry-form.tsx`, `src/components/finance/calc-mode-toggle.tsx`, `src/components/finance/live-amount.tsx`, `src/app/(app)/finance/new/page.tsx`, `src/components/finance/entry-form-dialog.tsx`

**Interfaces:**
- Consumes: `createEntrySchema`, `GET /api/projects`, `GET /api/categories`, `GET /api/users`.
- Produces: stepwise form (Income/Expense → Plan/Fact → Project → Category → Date → Amount|hours/rate → `Дополнительные данные` collapsible). `live-amount` shows `часы × ставка` live (display only; server authoritative). HOURS_RATE offered first for dev categories. Preselects project when `?projectId=`. Toast on success.

- [ ] **Step 1:** Build toggle, live-amount, form. Dialog wrapper for use from dashboard/project.
- [ ] **Step 2:** Component test: switching to HOURS_RATE hides amount, shows hours+rate, live total = product; extra fields hidden by default; `?projectId` preselects.
- [ ] **Step 3:** `npm run build`. Commit: `feat(ui): fast finance entry form with live hours×rate`.

### Task 6.6: Finance ledger page + project finance tab

**Files:** Create `src/app/(app)/finance/page.tsx`, `src/components/finance/entries-table.tsx`, `src/components/finance/entry-row-menu.tsx`, `src/components/finance/finance-filters.tsx`

**Interfaces:**
- Consumes: `GET /api/finance`.
- Produces: `/finance` — filters (URL-synced), sortable paginated table per ТЗ §26 columns, HOURS_RATE secondary line, context menu (Edit/Duplicate/Delete + confirm dialog). Reused as the project "Финансы" tab with `projectId` locked.

- [ ] **Step 1:** Build table + row menu + filters. Confirm dialog (shadcn `alert-dialog`).
- [ ] **Step 2:** Component test: renders secondary `12,5 ч × 2 000 ₽` line for HOURS_RATE; delete triggers confirm.
- [ ] **Step 3:** `npm run build && npm run test`. Commit: `feat(ui): finance ledger + project finance tab`.

---

## Phase 7 — Categories

### Task 7.1: category DTOs + endpoints (CRUD, archive-not-delete-if-used)

**Files:** Create `src/server/dto/category.ts`, `src/server/api/categories/*.ts`, `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts`, `tests/integration/categories.test.ts`

**Interfaces:**
- Produces: `GET /api/categories` (grouped INCOME/EXPENSE, ordered). `POST` (name, kind, accentColor ∈ palette, order). `PATCH` (name/color/order/archived). `DELETE /api/categories/:id` → hard-delete **only if unused**; if used → 409 `"Статья используется, её можно только архивировать"`. Audit `CATEGORY_CREATED/UPDATED/ARCHIVED`. MANAGER/ADMIN only.

- [ ] **Step 1: failing test:** create → appears; delete unused → gone; delete used → 409; archive used → hidden from active list, historical entry still resolves its category name; invalid color → 400; employee → 403.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(api): category CRUD with archive-if-used protection`.

### Task 7.2: Categories settings UI

**Files:** Create `src/app/(app)/settings/categories/page.tsx`, `src/components/categories/category-list.tsx`, `src/components/categories/category-form.tsx`, `src/components/categories/color-picker.tsx`, `src/lib/categories/palette.ts`

**Interfaces:**
- Produces: `/settings/categories` — two groups, inline create/edit, palette color dot picker, drag-or-arrow reorder, archive toggle, delete (disabled w/ tooltip when used). Accent color shown as a dot/small badge only (spec §29).

- [ ] **Step 1:** `palette.ts` (7 named colors → hex, both light values). Build components.
- [ ] **Step 2:** Component test: used category shows disabled delete + enabled archive; color renders as dot not fill.
- [ ] **Step 3:** Commit: `feat(ui): categories settings page`.

---

## Phase 8 — Dashboard

### Task 8.1: dashboard aggregates endpoint (no N+1)

**Files:** Create `src/server/api/dashboard/route-handler.ts`, `src/app/api/dashboard/route.ts`, `src/server/dto/dashboard.ts`, `tests/integration/dashboard.test.ts`

**Interfaces:**
- Consumes: `aggregateProject`, `aggregateCompany`, `expenseStructure`, `timeSeries`.
- Produces: `GET /api/dashboard?from&to&projectId?&status?&employeeId?&categoryId?` → `{ kpi: ProjectEconomics (company-level), timeseries[], projectBars: {projectId,name,profit,margin}[], expenseStructure: {categoryId,name,color,amount}[], projects: <table rows> }`. One `financialEntry.findMany` (scoped, non-deleted, date-bounded, permission-filtered project set) → all rollups computed in the domain layer in memory. EMPLOYEE → only member projects feed every number.

- [ ] **Step 1: failing test:** seed known data → assert company KPI numbers, project bars sorted by profit desc, expense structure sums, employee sees reduced totals. Assert only ≤2 queries issued (spy on `db`).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(api): dashboard aggregates in a single scoped query`.

### Task 8.2: KPI cards + charts components

**Files:** Create `src/components/kpi/kpi-card.tsx`, `src/components/kpi/kpi-row.tsx`, `src/components/charts/income-expense-chart.tsx`, `src/components/charts/project-profit-chart.tsx`, `src/components/charts/expense-structure-chart.tsx`, `src/components/charts/chart-theme.ts`

**Interfaces:**
- Consumes: dashboard payload. Produces: 4 KPI cards (big FACT number, small `План: … ₽` + deviation, п.п. for margin) — restrained, numbers dominate (spec §19). Recharts: area/line income vs expense (fact solid, plan dashed, ≤4 series), horizontal bar profit by project, donut expense structure with legend+values beside it (not color-only, spec §20). Shared muted chart theme.

- [ ] **Step 1:** Build `chart-theme.ts` (palette from `palette.ts` + neutrals), then the three charts + KPI components.
- [ ] **Step 2:** Component test: KPI card renders `—` when margin null; donut renders a legend row per category with its value.
- [ ] **Step 3:** Commit: `feat(ui): KPI cards and three dashboard charts`.

### Task 8.3: Dashboard page + period/filter bar (URL state)

**Files:** Create `src/app/(app)/page.tsx` (move landing), `src/components/dashboard/period-picker.tsx`, `src/components/dashboard/dashboard-filters.tsx`, `src/components/dashboard/projects-overview-table.tsx`, `src/lib/period.ts`, `tests/unit/period.test.ts`

**Interfaces:**
- Produces: `/` dashboard — title/subtitle, period picker (presets ТЗ §22 + custom range) + filters, `+ Добавить операцию` / `+ Новый проект`, KPI row, 3 charts, projects table (ТЗ §21 columns, FACT for period, plan/fact secondary, row → project, sortable, default profit desc). All filter state in query params. `lib/period.ts`: `resolvePeriod(preset|range) → {from,to}` (unit-tested: "этот квартал" boundaries etc.).

- [ ] **Step 1:** `period.ts` + tests. Step 2: build components + page. Step 3: component test (default period = year; changing preset updates `?from&to`). Step 4: `npm run build`. Step 5: commit `feat(ui): main dashboard with period/filters and projects table`.

---

## Phase 9 — Project card + analytics + audit surface

### Task 9.1: project card shell + tabs

**Files:** Create `src/app/(app)/projects/[id]/layout.tsx`, `src/app/(app)/projects/[id]/page.tsx` (overview), `.../finance/page.tsx`, `.../team/page.tsx`, `.../history/page.tsx`, `src/components/projects/project-header.tsx`, `src/components/projects/project-kpi.tsx`

**Interfaces:**
- Consumes: `GET /api/projects/:id`. Produces: header (name, status, client, dates, member avatars w/ tooltip, `Открыть в Bitrix24 ↗` when CRM-linked, `Редактировать`), 4 KPI (plan/fact each), tabs Обзор/Финансы/Команда/История (spec §25). Overview: KPI + dynamics chart + expense structure + last 5 operations. `+ Расход` / `+ Доход` here preselect the project.

- [ ] **Step 1:** Build header + kpi + tab layout. Wire finance tab to Task 6.6 table (project-locked). Team tab → member list + manage (MANAGER/ADMIN). History tab → Task 9.2.
- [ ] **Step 2:** Component test: employee viewing member project sees read-only (no edit/add buttons); non-member never reaches page (redirect/403 boundary tested in 5.2).
- [ ] **Step 3:** Commit: `feat(ui): project card with overview/finance/team/history tabs`.

### Task 9.2: audit read endpoint + history views

**Files:** Create `src/server/api/audit/route-handler.ts`, `src/app/api/audit/route.ts`, `src/app/(app)/history/page.tsx`, `src/components/history/history-feed.tsx`, `src/components/history/history-filters.tsx`, `src/lib/audit/humanize.ts`, `tests/unit/audit/humanize.test.ts`

**Interfaces:**
- Produces: `GET /api/audit?from&to&actorId&projectId&action&page` (ADMIN/MANAGER → 403 for EMPLOYEE). `humanize(entry) → { when, who, sentence, change? }` — e.g. `изменил расход проекта «Альфа»`, `25 000 ₽ → 32 000 ₽`. Never renders raw JSON to users (spec §32). `/history` = filtered feed. Project history tab = same feed scoped to the project.

- [ ] **Step 1: failing test** for `humanize`: FINANCE_UPDATED amount change → `"25 000 ₽ → 32 000 ₽"`; PROJECT_ARCHIVED → `"отправил проект «X» в архив"`; unknown action → safe generic sentence, never throws.
- [ ] **Step 2:** FAIL → implement humanize + endpoint + pages → PASS.
- [ ] **Step 3:** Commit: `feat(audit): audit endpoint + human-readable history feed`.

---

## Phase 10 — Bitrix24 integration

### Task 10.1: Bitrix REST client + token crypto

**Files:** Create `src/lib/bitrix/crypto.ts`, `src/lib/bitrix/client.ts`, `src/lib/bitrix/types.ts`, `tests/unit/bitrix/crypto.test.ts`, `tests/unit/bitrix/client.test.ts`

**Interfaces:**
- Produces:
  - `encryptToken(plain: string): string` / `decryptToken(enc: string): string` — AES-256-GCM, key from `APP_ENCRYPTION_KEY` (base64 32 bytes), format `iv:tag:ciphertext` base64.
  - `callBitrix<T>(portal: PortalInstallation, method: string, params: object): Promise<T>` — POSTs to `https://{domain}/rest/{method}`, injects access token, on `expired_token` refreshes via `oauth.bitrix.info`, re-stores encrypted tokens, retries once. Maps transport/`error` payloads to `AppError` `upstream(...)`. **Never** logs tokens (redaction test).
  - `batchBitrix(portal, calls)` — `batch` method, ≤50 per call.

- [ ] **Step 1: failing test:** crypto round-trip; wrong key → throws; `callBitrix` with mocked fetch returning `expired_token` then success → refreshes + retries + persists new enc token; a `console.*` spy sees no token substring.
- [ ] **Step 2:** FAIL → implement (`fetch`, `node:crypto`). → PASS.
- [ ] **Step 3:** Commit: `feat(bitrix): REST client with token refresh and AES-256-GCM at rest`.

### Task 10.2: OAuth install + placement handlers

**Files:** Create `src/lib/bitrix/auth.ts`, `src/app/api/bitrix/install/route.ts`, `src/app/api/bitrix/handler/route.ts`, `src/app/api/bitrix/events/route.ts`, `tests/integration/bitrix/install.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/bitrix/install` — receives `AUTH_ID`/`REFRESH_ID`/`member_id`/`DOMAIN` (form-encoded), upserts `PortalInstallation` (tokens encrypted, `applicationToken` stored), registers the left-menu placement (`placement.bind` → `Экономика проектов`), seeds default categories for the portal, returns the install-complete HTML.
  - `POST /api/bitrix/handler` — the placement/iframe entrypoint: verifies `application_token`/signature, resolves current user (`user.current` via `callBitrix`), upserts `AppUser` snapshot, resolves role (`is_admin` → ADMIN else stored/`EMPLOYEE`), issues session cookie, redirects to `/`.
  - `ONAPPUNINSTALL` on `/api/bitrix/events` → mark portal uninstalled.

- [ ] **Step 1: failing integration test:** simulated install POST → `PortalInstallation` row with non-plaintext tokens + default categories; handler POST with mocked `user.current` (is_admin) → session cookie set, `AppUser` upserted as ADMIN; missing `application_token` → 401.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(bitrix): install + placement handlers, portal provisioning`.

### Task 10.3: user sync (user_brief)

**Files:** Create `src/lib/bitrix/users.ts`, `src/server/api/users/route-handler.ts`, `src/app/api/users/route.ts`, `tests/integration/bitrix/users.test.ts`

**Interfaces:**
- Produces: `syncUsers(portal)` — `user.get`/`user.search` (brief) paginated, upsert `AppUser` snapshots (id, name, last name, photo, active, position if present), set `lastSyncedAt`, deactivate missing. `GET /api/users?q=` — portal users for member pickers (from local snapshot; triggers a background sync if stale > 1h). In `DEMO_MODE`, returns seeded users, no Bitrix call.

- [ ] **Step 1: failing test:** mocked Bitrix user list → `AppUser` rows upserted; a removed Bitrix user → `active=false`; demo mode → no fetch, seeded users returned.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(bitrix): user sync from user_brief`.

### Task 10.4: CRM entity browse + project import

**Files:** Create `src/lib/bitrix/crm.ts`, `src/server/api/crm/route-handler.ts`, `src/app/api/crm/route.ts`, `src/components/projects/crm-import.tsx`, `tests/integration/bitrix/crm.test.ts`

**Interfaces:**
- Produces:
  - `listCrmItems(portal, entityTypeId, { q, page })` / `getCrmItem(portal, entityTypeId, id)` via `crm.item.list` / `crm.item.get`.
  - `GET /api/crm?entityTypeId=2|4&q=` → normalized `{ id, title, clientName?, url }[]` (Deal `2`, Company `4`).
  - project create accepts `{ sourceType: 'BITRIX_CRM', crmEntityTypeId, crmEntityId }` → stores id/type/title snapshot + `crmEntityUrl` (`https://{domain}/crm/{type}/details/{id}/`), prefills name + client.
  - `crm-import.tsx` — the `Выбрать из Bitrix24` tab in the project form: entity-type switch, search list, pick → prefill.

- [ ] **Step 1: failing test:** mocked `crm.item.list` → normalized rows; create project from a Deal → snapshot fields + valid `Открыть в Bitrix24` URL; demo mode → returns a small canned CRM list so the UI is testable without a portal.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Commit: `feat(bitrix): CRM browse + project import from Deal/Company`.

---

## Phase 11 — Production auth / security hardening

### Task 11.1: security review pass

**Files:** Modify handlers as needed; Create `tests/integration/security.test.ts`

- [ ] **Step 1:** Tests: (a) no endpoint returns `auth`/`refresh` token in any response body (crawl route list); (b) `resolveSession` rejects a cookie whose `appUserId` isn't in the DB; (c) role in cookie is ignored — DB role wins (seed user as EMPLOYEE, forge cookie claiming ADMIN → still 403 on admin route); (d) CSRF enforced on every non-GET route; (e) logs contain no token substrings during an install+refresh cycle.
- [ ] **Step 2:** Fix any failures.
- [ ] **Step 3:** `npm run test`. Commit: `test(security): token exposure, cookie forgery, CSRF coverage`.

### Task 11.2: cookie policy, headers, rate-limit on mutations

**Files:** Modify `src/lib/auth/session.ts`, Create `src/middleware.ts` additions, `src/lib/rate-limit.ts`

- [ ] **Step 1:** Session cookie `HttpOnly; Secure; SameSite=None` in production, `Lax` allowed in dev over http. CSP `frame-ancestors` for bitrix domains; `Referrer-Policy`, `X-Content-Type-Options`. Simple in-memory token-bucket rate limit on mutation routes (per session).
- [ ] **Step 2:** Integration test: 3rd rapid mutation within window → 429; header assertions.
- [ ] **Step 3:** Commit: `feat(security): iframe cookie policy, security headers, mutation rate limit`.

---

## Phase 12 — UI polish (design system pass)

### Task 12.1: design tokens + primitives finalization

**Files:** Modify `globals.css`, `tailwind.config.ts`; Create `src/components/ui/*` refinements, `docs/DESIGN.md`

- [ ] **Step 1:** Lock tokens (spec §34): bg `#F5F5F7`, card `#FFF`, fg `#111`, muted, border, one cobalt accent, semantic muted green/amber/red, radii 14–22, soft shadows only. Typography scale (page title / KPI numerals / small labels — ТЗ §35). Document in `docs/DESIGN.md`.
- [ ] **Step 2:** Sweep components for banner-y cards, heavy shadows, gradients, color-only meaning → fix. Add `+`/`−` or icon alongside profit/loss color (a11y ТЗ §58).
- [ ] **Step 3:** `npm run build`. Commit: `style: finalize Apple-restrained design system`.

### Task 12.2: states + toasts + a11y sweep

**Files:** Create `src/components/common/error-state.tsx`, `src/components/common/toaster.tsx`; modify pages

- [ ] **Step 1:** Every list/detail page: skeleton loading, empty state (ТЗ §37 copy), error state with human message (ТЗ §39 catalogue: Bitrix down, token expired, no rights, not found, CRM entity deleted, network, validation, DB down). Toaster wired to all mutations (ТЗ §40).
- [ ] **Step 2:** a11y: keyboard nav on tables/menus, focus rings, `aria-label` on icon buttons, contrast check. Add `tests/e2e/a11y.spec.ts` (axe on 4 key pages).
- [ ] **Step 3:** Console clean: no warnings/hydration errors on any page (ТЗ §71). Commit: `feat(ui): loading/empty/error states, toasts, a11y pass`.

---

## Phase 13 — Test consolidation

### Task 13.1: fill coverage gaps

- [ ] **Step 1:** Cross-check ТЗ §65 & §66 — every listed case has a green test. Add missing (`decimal` no-float aggregate case at the aggregate level; PLAN/FACT independence at API level).
- [ ] **Step 2:** Add `tests/integration/permissions-matrix.test.ts` — one parametrized table over (role × endpoint × expected status).
- [ ] **Step 3:** Commit: `test: complete finance + permission matrices`.

### Task 13.2: E2E happy path (ТЗ §67)

**Files:** Create `tests/e2e/manager-flow.spec.ts`

- [ ] **Step 1:** Script the full ТЗ §67 scenario against demo-mode (login as demo MANAGER via role switch → create project → add member → plan income 1 000 000 → fact income 900 000 → expense «Внешние программисты» 100×2000 → AI expense 50 000 → open project → assert profit `740 000 ₽` and margin value → edit expense → assert KPI changes → open history → see the change row).
- [ ] **Step 2:** `npm run test:e2e`. Expected: PASS.
- [ ] **Step 3:** Commit: `test(e2e): manager end-to-end economics flow`.

---

## Phase 14 — Docker / VPS finalization

### Task 14.1: end-to-end container run

- [ ] **Step 1:** `docker compose up --build` from clean volumes → app healthy, migrations applied automatically, `/` loads. In demo mode, seed runs via entrypoint when `DEMO_MODE=true` and portal absent.
- [ ] **Step 2:** Verify `prisma migrate deploy` (not `db push`) is what the entrypoint runs. `deploy/README.md` + `deploy/nginx.example.conf` accurate; add `deploy/.env.production.example`.
- [ ] **Step 3:** Commit: `chore(deploy): verified compose bring-up, VPS docs`.

---

## Phase 15 — Documentation

### Task 15.1: README + screenshots

**Files:** Create `README.md`, `docs/screenshots/*` (script `scripts/screenshots.ts`)

- [ ] **Step 1:** `scripts/screenshots.ts` — Playwright, demo-mode, capture dashboard / projects / project card / finance / categories / history at 1440px. Commit PNGs to `docs/screenshots/`.
- [ ] **Step 2:** Write `README.md` per ТЗ §60: what it is, features (only real ones), screenshots, stack, architecture (+ Mermaid), demo quick start, local dev steps, env var table, **detailed Bitrix24 install** (create local app, handler URL `/api/bitrix/handler`, install URL `/api/bitrix/install`, scopes `crm,placement,user_brief,basic`, menu item, verification), Docker, VPS deploy, tests, financial formulas, roles permission matrix.
- [ ] **Step 3:** Commit: `docs: README with real screenshots and install guide`.

### Task 15.2: AI_USAGE.md, DECISIONS.md, TESTING.md

**Files:** Create `AI_USAGE.md`, `docs/DECISIONS.md`, `docs/TESTING.md`

- [ ] **Step 1:** `docs/DECISIONS.md` — ADR-001..013 from spec §3, final wording, note actual Next version.
- [ ] **Step 2:** `docs/TESTING.md` — unit/integration/e2e/manual matrices, how to run, what each guards.
- [ ] **Step 3:** `AI_USAGE.md` — honest: AI-drafted (schema, engine, handlers, UI), human decisions (arch, ТЗ interpretation, security model), AI-risk checks actually performed (div-by-zero, decimal precision, negative profit, plan/fact, deleted entries, permission bypass, token leakage) with the test names that prove each. No claims for unchecked things.
- [ ] **Step 3:** Commit: `docs: AI_USAGE, DECISIONS, TESTING`.

---

## Phase 16 — Final QA

### Task 16.1: full verification run

- [ ] **Step 1:** Run in order, capture output: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`. All green. Fix anything red (do not proceed past a failure).
- [ ] **Step 2:** Manual sweep (ТЗ §70) in demo: Dashboard, Projects, Project, Finance, Categories, History, add income, add expense, hour calc, edit, delete, archive, filters, role switch (ADMIN/MANAGER/EMPLOYEE visibility), empty state, error state. Note any defect, fix, re-run Step 1.
- [ ] **Step 3:** Browser console clean on every page (ТЗ §71).
- [ ] **Step 4:** Commit: `chore: final QA pass — lint/typecheck/test/build/e2e green`.

### Task 16.2: final audit report (ТЗ §78)

- [ ] **Step 1:** Write the 12-point report: what's implemented; architecture; DB structure; Bitrix integration; roles; formulas; tests; lint/typecheck/test/build/e2e results (real output); how to run demo; how to install in Bitrix24; how to deploy to VPS; what remains (honestly). Deliver to the user; do not say only "Готово".

---

## Self-Review notes

- **Spec coverage:** every ТЗ section maps to a task — §5 demo→4.1/4.2, §7 roles→3.4/5.2, §11–17 finance→Phase 2/6, §18–22 dashboard→Phase 8, §24–26 project card→Phase 9, §27 ledger→6.6, §28–29 categories→Phase 7, §30–32 audit→5.3/9.2, §41–44 bitrix/security→Phase 10/11, §45–48 schema→1.3, §49–54 server rules→Phase 3/6/8, §60–64 docs→Phase 15, §65–68 tests→Phase 2/5/6/13, §69 verify→16.1, §77 order→phase order.
- **Placeholder scan:** none — test code is inline for correctness-critical tasks; lighter UI tasks carry concrete component/test descriptions to expand at execution.
- **Type consistency:** `ProjectEconomics` shape defined in 2.1, consumed unchanged in 2.3/5.2/8.1. `Actor`/`ProjectContext` from 3.4 used in 5.2/6.2/8.1. `callBitrix`/`PortalInstallation` from 10.1 used in 10.2–10.4.
