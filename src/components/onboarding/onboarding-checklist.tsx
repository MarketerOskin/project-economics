'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, X } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import type { OnboardingStep } from '@/lib/onboarding';

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const [dismissed, setDismissed] = React.useState(false);
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed || doneCount === steps.length) return null;

  const dismiss = () => {
    setDismissed(true);
    apiFetch('/api/onboarding/dismiss', { method: 'POST' }).catch(() => undefined);
  };

  return (
    <div className="rounded-[16px] border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-fg">Начало работы</h2>
          <p className="mt-0.5 text-sm text-fg-secondary">
            {doneCount} из {steps.length} — дальше приложение считает экономику само.{' '}
            <Link href="/how-it-works" className="font-medium text-accent hover:underline">
              Как это работает
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Скрыть"
          className="rounded-[8px] p-1 text-fg-tertiary hover:bg-surface-muted hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step.key}>
            {step.done ? (
              <div className="flex h-full flex-col gap-1.5 rounded-[12px] border border-border bg-surface-muted/40 p-3">
                <span className="flex size-5 items-center justify-center rounded-full bg-positive-soft text-positive">
                  <Check className="size-3.5" />
                </span>
                <span className="text-sm font-medium text-fg-secondary line-through decoration-fg-tertiary/50">
                  {step.label}
                </span>
              </div>
            ) : (
              <Link
                href={step.href}
                className={cn(
                  'flex h-full flex-col gap-1.5 rounded-[12px] border border-dashed border-border p-3 transition-colors',
                  'hover:border-accent hover:bg-accent-soft/30',
                )}
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-border text-xs text-fg-tertiary">
                  {steps.findIndex((s) => s.key === step.key) + 1}
                </span>
                <span className="text-sm font-medium text-fg">{step.label}</span>
                <span className="text-xs text-fg-tertiary">{step.description}</span>
                <span className="mt-auto flex items-center gap-1 pt-1 text-xs font-medium text-accent">
                  Перейти <ArrowRight className="size-3" />
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
