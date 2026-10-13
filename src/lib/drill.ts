/**
 * Links from an analytics figure to the list behind it (ADR-049): the period query of the
 * page plus the filters that narrow it (project, employee, view).
 */
export function drillHref(
  path: string,
  periodQuery: string,
  extra: Record<string, string | undefined | null> = {},
): string {
  const q = new URLSearchParams(periodQuery.replace(/^\?/, ''));
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
