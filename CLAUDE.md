# Project: «Экономика проектов» — Bitrix24 application

> The `CLAUDE.md` in the parent `~/Documents/` folder describes a **different, unrelated**
> project (SLS storage-fee calculator, PHP+MySQL). It does **not** apply here. This project
> is the Bitrix24 "Project Economics" full-stack app. Source of truth: `docs/REQUIREMENTS.md`.

## What this is

Full-stack Bitrix24 application for manual income/expense tracking per project, so management
can see the economic health of each project and the business: plan vs fact income/expenses,
profit, margin, deviation, expense structure, and team.

## Stack

- Next.js (App Router) + TypeScript strict, React
- PostgreSQL + Prisma ORM, money as `Decimal`
- Tailwind CSS + shadcn/ui + Lucide + Recharts
- React Hook Form + Zod
- Vitest + Testing Library + Playwright
- Docker + Docker Compose

## Non-negotiable rules (from ТЗ)

1. **Financial correctness first**, then data safety, then security, then features, then UX, then visuals.
2. Money never flows through JS floating point as source of truth — `Decimal` everywhere in finance logic.
3. All permissions re-checked on the backend. Frontend checks are cosmetic only.
4. Every DB query is scoped by `portalId`. No cross-portal access, ever.
5. PLAN and FACT are **separate** `FinancialEntry` rows. Never `planAmount` + `factAmount` on one row.
6. Financial mutations are soft-delete; deletions still land in the audit log.
7. `margin` is `null` (renders `—`) when income is 0. Never `Infinity`/`NaN`/`0%`.
8. Margin deltas are in percentage points (`п.п.`), not `%`.
9. Currency formatting (`₽`, `Intl.NumberFormat('ru-RU')`) lives only in `src/lib/format/`.
10. Finance formulas have exactly one home: `src/domain/finance/`. No duplication in pages/API/charts.
11. Bitrix OAuth tokens are secrets: never logged, never sent to the frontend, encrypted at rest.
12. No `any` / `@ts-ignore` to silence the compiler without a documented reason.
13. Demo-mode role switcher must not exist in production Bitrix mode.

## Key commands

```
npm run dev            # local dev
npm run db:migrate     # prisma migrate dev
npm run db:seed        # seed demo data
npm run lint
npm run typecheck
npm run test           # vitest (unit + integration)
npm run test:e2e       # playwright
npm run build
docker compose up --build
```

## Layout

```
src/domain/finance/   pure calc engine (Decimal in -> Decimal|null out), no DB, no React
src/lib/bitrix/       Bitrix REST service layer (client, auth, users, crm, types)
src/lib/auth/         session + server-side role resolution
src/lib/permissions/  can(...) checks, re-run on backend
src/lib/db/           prisma singleton + withPortal helper
src/lib/format/        the only place "₽" and ru-RU number formatting live
src/lib/demo/          demo portal seed + demo role switch (DEMO_MODE only)
src/server/api/        thin route handlers: zod -> permissions -> domain -> db -> audit
src/app/              App Router pages (RSC for reads)
src/components/       UI
```
