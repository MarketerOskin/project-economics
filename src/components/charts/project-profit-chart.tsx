'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { formatPercentStr, formatRubStr } from '@/lib/format';
import { cn } from '@/lib/cn';

interface ProfitBar {
  id: string;
  name: string;
  profit: string;
  margin: string | null;
}

/**
 * Profit per project as a bar list (ADR-065): the name sits on its bar, the sum and margin at
 * the right, so every figure is read rather than estimated from an axis. A loss is a red bar
 * of its own size. The row opens the project.
 */
export function ProjectProfitChart({ data }: { data: ProfitBar[] }) {
  const reduce = useReducedMotion();
  const rows = data.slice(0, 10).map((b) => ({ ...b, value: Number(b.profit) }));
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  if (rows.length === 0) {
    return <p className="text-fg-tertiary py-8 text-center text-sm">Нет проектов за период</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => {
        const loss = r.value < 0;
        const width = `${Math.max(2, (Math.abs(r.value) / max) * 100)}%`;
        return (
          <li key={r.id}>
            <Link
              href={`/projects/${r.id}`}
              className="group flex items-center gap-3 rounded-xl px-1 py-0.5 transition-colors hover:bg-white/[0.03] in-data-[theme=light]:hover:bg-black/[0.025] sm:gap-4"
            >
              <div className="relative h-9 min-w-0 flex-1">
                <motion.div
                  aria-hidden
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-[10px] border transition-[filter] group-hover:brightness-125',
                    loss
                      ? 'border-[var(--negative)]/30 bg-[linear-gradient(90deg,rgb(255_107_107/0.38),rgb(255_107_107/0.14))]'
                      : 'border-[var(--accent)]/25 bg-[linear-gradient(90deg,rgb(214_255_63/0.34),rgb(214_255_63/0.08))] in-data-[theme=light]:border-[rgb(140_175_0/0.35)] in-data-[theme=light]:bg-[linear-gradient(90deg,rgb(214_255_63/0.6),rgb(214_255_63/0.18))]',
                  )}
                  initial={reduce ? { width } : { width: 0 }}
                  whileInView={{ width }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: 0.06 * i, ease: [0.16, 1, 0.3, 1] }}
                />
                <span className="text-fg relative flex h-full items-center px-3 text-[13px] font-medium">
                  <span className="truncate">{r.name}</span>
                </span>
              </div>
              <div className="w-[104px] shrink-0 text-right sm:w-[132px]">
                <div
                  className={cn('nums text-sm font-semibold', loss ? 'text-negative' : 'text-fg')}
                >
                  {formatRubStr(r.profit)}
                </div>
                <div className="nums text-fg-tertiary text-[11px]">
                  маржа {formatPercentStr(r.margin)}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
