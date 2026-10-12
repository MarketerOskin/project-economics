/** Shared chart tokens — recessive axes/grid, ink for text, semantic for polarity. */
export const CHART = {
  ink: '#f4f4ef',
  inkSecondary: '#c3c2b7',
  inkTertiary: '#8f8f86',
  grid: '#1f1f1e',
  axis: '#383835',
  surface: '#0d0d0d',

  // Income wears the brand lime; expense a neutral warm gray (toxick.ru palette).
  income: '#d6ff3f',
  expense: '#8f8f86',
  positive: '#4fd14f',
  negative: '#ff5c5c',

  fontSize: 11,
  fontFamily: "var(--font-mono-tech), ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.inkTertiary, fontSize: CHART.fontSize },
  tickLine: false,
  axisLine: false,
} as const;
