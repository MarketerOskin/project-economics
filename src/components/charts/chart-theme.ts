/** Shared chart tokens — recessive axes/grid, ink for text, semantic for polarity. */
export const CHART = {
  ink: '#111111',
  inkSecondary: '#5b5b60',
  inkTertiary: '#8a8a8e',
  grid: '#ececef',
  axis: '#d4d4d8',
  surface: '#ffffff',

  income: '#2a78d6',
  expense: '#5b6270',
  positive: '#1f7a4d',
  negative: '#b23b3b',

  fontSize: 12,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Segoe UI', Roboto, sans-serif",
} as const;

export const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.inkTertiary, fontSize: CHART.fontSize },
  tickLine: false,
  axisLine: false,
} as const;
