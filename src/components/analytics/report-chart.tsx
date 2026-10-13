import { formatDayKey, formatHours } from '@/lib/format';

/**
 * Hours per day as a static SVG for the printable report: no JS, prints identically on paper.
 * Ink = task time, lime-olive = meetings (lime itself is unreadable on white).
 */
export function ReportHoursChart({
  data,
  taskColor = '#050505',
  meetingColor = '#9fcf00',
}: {
  data: Array<{ day: string; taskSeconds: number; meetingSeconds: number }>;
  /** The company's accent and a lighter shade of it on branded reports (ADR-054). */
  taskColor?: string;
  meetingColor?: string;
}) {
  const W = 720;
  const H = 170;
  const pad = { l: 28, r: 6, t: 8, b: 22 };
  const max = Math.max(1, ...data.map((d) => d.taskSeconds + d.meetingSeconds)) / 3600;
  const top = Math.max(1, Math.ceil(max));
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length);
  const y = (h: number) => pad.t + (H - pad.t - pad.b) * (1 - h / top);
  const labelEvery = Math.max(1, Math.ceil(data.length / 10));

  if (data.every((d) => d.taskSeconds + d.meetingSeconds === 0)) {
    return <p className="report-muted">За период часов не было.</p>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Часы по дням">
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e3e3d9" />
          <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#6d6d65">
            {formatHours(v * 3600)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = pad.l + i * bw + bw * 0.15;
        const w = bw * 0.7;
        const t = d.taskSeconds / 3600;
        const mt = d.meetingSeconds / 3600;
        return (
          <g key={d.day}>
            {t > 0 ? <rect x={x} y={y(t)} width={w} height={y(0) - y(t)} fill={taskColor} /> : null}
            {mt > 0 ? <rect x={x} y={y(t + mt)} width={w} height={y(t) - y(t + mt)} fill={meetingColor} /> : null}
            {i % labelEvery === 0 ? (
              <text x={x + w / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#6d6d65">
                {formatDayKey(d.day)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
