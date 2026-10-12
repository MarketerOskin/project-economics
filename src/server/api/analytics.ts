import { can, requirePermission } from '@/lib/permissions';
import { requirePro } from '@/lib/billing/plan';
import { parseAnalyticsPeriod } from '@/domain/analytics';
import { analyticsTimeZone, loadAnalytics, peopleNames } from '@/server/services/analytics';
import { buildAnalyticsWorkbook } from '@/server/services/analytics-export';
import type { HandlerContext } from '@/server/handler';

/** GET /api/analytics/export — the analytics .xlsx for the period and filters in the query. */
export async function exportAnalytics({ req, session, scope }: HandlerContext) {
  requirePermission(can.viewAllProjects(session.actor));
  requirePro(session.plan, 'Аналитика задач, часов и встреч');

  const q = new URL(req.url).searchParams;
  const tz = analyticsTimeZone();
  const period = parseAnalyticsPeriod(
    { p: q.get('p') ?? undefined, m: q.get('m') ?? undefined, from: q.get('from') ?? undefined, to: q.get('to') ?? undefined },
    tz,
  );
  const projectId = q.get('projectId') || undefined;
  const employeeId = q.get('employeeId') || undefined;

  const world = await loadAnalytics(session, scope, { projectId });
  const data = await buildAnalyticsWorkbook(world, period, { employeeId }, peopleNames(world));

  const base = projectId && world.projects[0] ? world.projects[0].name : 'Аналитика';
  const filename = `${base} — ${period.label}.xlsx`.replace(/[\\/:*?"<>|]+/g, ' ');
  return new Response(new Uint8Array(data), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="analytics.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  });
}
