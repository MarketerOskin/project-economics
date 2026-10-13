'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/toast';
import { CRM_ROLES, OPTIONAL_SECTIONS, type CrmRoleValue } from '@/lib/sections';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Section {
  entityTypeId: number;
  title: string;
  role: CrmRoleValue;
  isDefault: boolean;
}

interface SetupData {
  sections: Section[];
  disabledSections: string[];
  completedAt: string | null;
  error: string | null;
}

const ROLE_HINT = Object.fromEntries(CRM_ROLES.map((r) => [r.value, r.hint])) as Record<
  CrmRoleValue,
  string
>;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-medium">
        <span className="bg-accent text-accent-fg flex size-6 items-center justify-center text-xs font-bold">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** «Настройка под портал» (ADR-041): roles of CRM sections and which app sections to show. */
export function SetupWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const { refresh } = useSession();
  const [data, setData] = React.useState<SetupData | null>(null);
  const [roles, setRoles] = React.useState<Record<number, CrmRoleValue>>({});
  const [disabled, setDisabled] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<SetupData>('/api/setup')
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setRoles(Object.fromEntries(r.sections.map((s) => [s.entityTypeId, s.role])));
        setDisabled(new Set(r.disabledSections));
      })
      .catch(
        (e) =>
          !cancelled &&
          setData({
            sections: [],
            disabledSections: [],
            completedAt: null,
            error: e instanceof Error ? e.message : 'Не удалось загрузить',
          }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/setup', {
        method: 'PUT',
        body: {
          roles: Object.entries(roles).map(([entityTypeId, role]) => ({
            entityTypeId: Number(entityTypeId),
            role,
          })),
          disabledSections: [...disabled],
        },
      });
      await refresh();
      toast('Настройки сохранены');
      router.push('/');
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <p className="text-fg-tertiary text-sm">Загружаю разделы Битрикс24…</p>;

  const toggle = (key: string) =>
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-8">
      <Step n={1} title="Для чего у вас разделы Битрикс24">
        <p className="text-fg-secondary text-sm">
          У каждой компании CRM устроена по-своему: где-то лиды это весь входящий трафик, сделки это
          первичные продажи, а клиентов на поддержке ведут в смарт-процессе. Укажите, для чего
          служит каждый раздел.
        </p>
        {data.error ? (
          <p className="bg-negative-soft text-negative px-3 py-2 text-sm">
            Битрикс24 не отдал список разделов: {data.error}
          </p>
        ) : data.sections.length === 0 ? (
          <p className="text-fg-tertiary text-sm">В демо-режиме разделов Битрикс24 нет.</p>
        ) : (
          <div className="divide-border border-border bg-surface divide-y border">
            {data.sections.map((s) => {
              const role = roles[s.entityTypeId] ?? s.role;
              return (
                <div
                  key={s.entityTypeId}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_16rem] sm:items-center"
                >
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-fg-tertiary mt-0.5 text-xs">{ROLE_HINT[role]}</div>
                  </div>
                  <Select
                    value={role}
                    onValueChange={(v) =>
                      setRoles((prev) => ({ ...prev, [s.entityTypeId]: v as CrmRoleValue }))
                    }
                  >
                    <SelectTrigger aria-label={`Назначение раздела ${s.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="w-[var(--radix-select-trigger-width)]">
                      {CRM_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </Step>

      <Step n={2} title="Какие разделы приложения нужны">
        <p className="text-fg-secondary text-sm">
          Проекты, финансы и настройки есть всегда. Остальное можно убрать из меню и вернуть здесь
          же.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONAL_SECTIONS.map((s) => (
            <label
              key={s.key}
              className="border-border bg-surface hover:border-accent flex cursor-pointer items-start gap-3 border px-4 py-3 text-sm"
            >
              <input
                type="checkbox"
                checked={!disabled.has(s.key)}
                onChange={() => toggle(s.key)}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-medium">{s.label}</span>
                <span className="text-fg-tertiary block text-xs">{s.description}</span>
              </span>
            </label>
          ))}
        </div>
      </Step>

      <Step n={3} title="Откуда брать время">
        <p className="text-fg-secondary text-sm">
          Часы берутся из учёта времени в задачах Битрикс24. Если в смарт-процессе поддержки или в
          сделках время пишут в свои поля (например, отдельно часы и минуты), укажите их в{' '}
          <Link href="/settings/time-fields" className="text-accent underline underline-offset-2">
            учёте времени
          </Link>
          .
        </p>
      </Step>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Сохраняю…' : data.completedAt ? 'Сохранить' : 'Готово'}
        </Button>
        <span className="text-fg-tertiary text-sm">
          Не подходит ни один вариант?{' '}
          <Link href="/implementation" className="text-accent underline underline-offset-2">
            Оставьте заявку на внедрение
          </Link>
        </span>
      </div>
    </div>
  );
}
