import { can, requirePermission } from '@/lib/permissions';
import { requirePro } from '@/lib/billing/plan';
import { parseAnalyticsPeriod } from '@/domain/analytics';
import { analyticsTimeZone } from '@/server/services/analytics';
import { createSpendSchema, qualifiedStagesSchema, savePlanSchema } from '@/server/dto/marketing';
import {
  createSpend,
  deleteSpend,
  marketingReport,
  salesReport,
  savePlan,
  saveQualifiedStages,
} from '@/server/services/marketing';
import {
  marketingTables,
  salesTables,
  tableToCsv,
  tablesToXlsx,
} from '@/server/services/marketing-export';
import type { HandlerContext } from '@/server/handler';

const FEATURE = 'Маркетинг и продажи по каналам';

function guardWrite({ session }: HandlerContext<unknown>) {
  requirePermission(can.mutateFinance(session.actor));
  requirePro(session.plan, FEATURE);
}

/** POST /api/marketing/spend — money put into a channel. */
export async function postSpend(ctx: HandlerContext) {
  guardWrite(ctx);
  return createSpend(ctx.session, createSpendSchema.parse(await ctx.req.json()));
}

/** DELETE /api/marketing/spend/:id — soft delete, audited. */
export async function removeSpend(ctx: HandlerContext<{ id: string }>) {
  guardWrite(ctx);
  await deleteSpend(ctx.session, ctx.params.id);
  return { ok: true };
}

/** PUT /api/marketing/plan — the month's plan. */
export async function putPlan(ctx: HandlerContext) {
  guardWrite(ctx);
  return savePlan(ctx.session, savePlanSchema.parse(await ctx.req.json()));
}

/** PUT /api/marketing/qualified-stages — what counts as a qualified lead. */
export async function putQualifiedStages(ctx: HandlerContext) {
  guardWrite(ctx);
  const { stages } = qualifiedStagesSchema.parse(await ctx.req.json());
  await saveQualifiedStages(ctx.scope, stages);
  return { ok: true };
}

/** GET /api/marketing/export?tab=marketing|sales&format=xlsx|csv&p=… — the page's tables. */
export async function exportMarketing({ req, session, scope }: HandlerContext) {
  requirePermission(can.viewAllProjects(session.actor));
  requirePro(session.plan, FEATURE);
  const q = new URL(req.url).searchParams;
  const tz = analyticsTimeZone();
  const period = parseAnalyticsPeriod(
    {
      p: q.get('p') ?? undefined,
      m: q.get('m') ?? undefined,
      from: q.get('from') ?? undefined,
      to: q.get('to') ?? undefined,
    },
    tz,
  );
  const sales = q.get('tab') === 'sales';
  const tables = sales
    ? salesTables(await salesReport(session, scope, period, tz))
    : marketingTables(await marketingReport(session, scope, period, tz));
  const csv = q.get('format') === 'csv';
  const base = `${sales ? 'Продажи' : 'Маркетинг'} — ${period.label}`.replace(
    /[\\/:*?"<>|]+/g,
    ' ',
  );
  const filename = `${base}.${csv ? 'csv' : 'xlsx'}`;
  const body = csv ? tableToCsv(tables[0]!) : new Uint8Array(await tablesToXlsx(tables));
  return new Response(body, {
    headers: {
      'content-type': csv
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="export.${csv ? 'csv' : 'xlsx'}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  });
}
