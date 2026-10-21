/**
 * Shared chart tokens — recessive axes/grid, ink for text, semantic for polarity. They are
 * CSS variables, so charts follow the dark/light theme (ADR-044) without re-rendering.
 */
export const CHART = {
  ink: 'var(--fg)',
  inkSecondary: 'var(--fg-secondary)',
  inkTertiary: 'var(--fg-tertiary)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  surface: 'var(--surface)',

  // Income wears the brand accent; expense a neutral warm gray (toxick.ru palette).
  income: 'var(--chart-primary)',
  expense: 'var(--fg-tertiary)',
  positive: 'var(--positive)',
  negative: 'var(--negative)',

  fontSize: 11,
  fontFamily: "var(--font-mono-tech), ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.inkTertiary, fontSize: CHART.fontSize },
  tickLine: false,
  axisLine: false,
} as const;
