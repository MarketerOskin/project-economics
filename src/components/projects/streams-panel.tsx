'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { StreamKind } from '@prisma/client';
import { Pencil, Plus } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { cn } from '@/lib/cn';
import { formatDate, formatRubStr, RUB_SIGN } from '@/lib/format';
import { STREAM_KINDS, STREAM_KIND_LABELS } from '@/lib/streams';
import { initials } from '@/lib/text';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { MemberSelect } from './member-select';
import type { StreamDto } from '@/server/services/streams';
import type { EconomicsJson } from '@/server/serialize';

type Stream = StreamDto & { economics: EconomicsJson };

interface Person {
  id: string;
  fullName: string;
  photoUrl: string | null;
}

interface FormValues {
  kind: StreamKind;
  name: string;
  status: 'ACTIVE' | 'COMPLETED';
  startDate: string;
  endDate: string;
  budget: string;
  monthlyFee: string;
  hourRate: string;
  hoursLimit: string;
  memberIds: string[];
  comment: string;
}

const EMPTY: FormValues = {
  kind: 'SUPPORT',
  name: '',
  status: 'ACTIVE',
  startDate: '',
  endDate: '',
  budget: '',
  monthlyFee: '',
  hourRate: '',
  hoursLimit: '',
  memberIds: [],
  comment: '',
};

function toForm(s: Stream): FormValues {
  return {
    kind: s.kind,
    name: s.name ?? '',
    status: s.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
    startDate: s.startDate ?? '',
    endDate: s.endDate ?? '',
    budget: s.budget ?? '',
    monthlyFee: s.monthlyFee ?? '',
    hourRate: s.hourRate ?? '',
    hoursLimit: s.hoursLimit ?? '',
    memberIds: s.memberIds,
    comment: s.comment ?? '',
  };
}

function StreamDialog({
  projectId,
  stream,
  open,
  onOpenChange,
}: {
  projectId: string;
  stream: Stream | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [v, setV] = React.useState<FormValues>(stream ? toForm(stream) : EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const set =
    (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await apiFetch(
        stream
          ? `/api/projects/${projectId}/streams/${stream.id}`
          : `/api/projects/${projectId}/streams`,
        { method: stream ? 'PATCH' : 'POST', body: v },
      );
      toast(stream ? 'Направление сохранено' : 'Направление добавлено');
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!stream) return;
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/streams/${stream.id}`, { method: 'DELETE' });
      toast('Направление убрано, операции остались в проекте');
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось убрать', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,40rem)]">
        <DialogHeader
          title={stream ? 'Направление' : 'Новое направление'}
          description="Поддержка, внедрение, разработка: свои условия оплаты и своя команда"
        />
        <form onSubmit={submit} className="space-y-4">
          <Field label="Вид работ" error={errors.kind}>
            <Segmented
              value={v.kind}
              onChange={(kind) => setV((x) => ({ ...x, kind }))}
              options={STREAM_KINDS.map((k) => ({ value: k, label: STREAM_KIND_LABELS[k] }))}
              className="flex-wrap"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Название (необязательно)" htmlFor="st-name" error={errors.name}>
              <Input
                id="st-name"
                value={v.name}
                onChange={set('name')}
                placeholder={STREAM_KIND_LABELS[v.kind]}
              />
            </Field>
            <Field label="Статус">
              <Segmented
                value={v.status}
                onChange={(status) => setV((x) => ({ ...x, status }))}
                options={[
                  { value: 'ACTIVE', label: 'Идёт' },
                  { value: 'COMPLETED', label: 'Завершено' },
                ]}
              />
            </Field>
            <Field label="Начало" htmlFor="st-start" error={errors.startDate}>
              <Input id="st-start" type="date" value={v.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="Окончание" htmlFor="st-end" error={errors.endDate}>
              <Input id="st-end" type="date" value={v.endDate} onChange={set('endDate')} />
            </Field>
            <Field label={`Бюджет, ${RUB_SIGN}`} htmlFor="st-budget" error={errors.budget}>
              <Input
                id="st-budget"
                inputMode="decimal"
                value={v.budget}
                onChange={set('budget')}
                placeholder="Фикс за этап"
              />
            </Field>
            <Field
              label={`Абонентская плата, ${RUB_SIGN} в месяц`}
              htmlFor="st-fee"
              error={errors.monthlyFee}
            >
              <Input
                id="st-fee"
                inputMode="decimal"
                value={v.monthlyFee}
                onChange={set('monthlyFee')}
              />
            </Field>
            <Field label="Пакет, часов в месяц" htmlFor="st-hours" error={errors.hoursLimit}>
              <Input
                id="st-hours"
                inputMode="decimal"
                value={v.hoursLimit}
                onChange={set('hoursLimit')}
              />
            </Field>
            <Field label={`Цена часа, ${RUB_SIGN}`} htmlFor="st-rate" error={errors.hourRate}>
              <Input
                id="st-rate"
                inputMode="decimal"
                value={v.hourRate}
                onChange={set('hourRate')}
              />
            </Field>
          </div>
          <Field label="Команда направления" error={errors.memberIds}>
            <MemberSelect
              value={v.memberIds}
              onChange={(memberIds) => setV((x) => ({ ...x, memberIds }))}
            />
          </Field>
          <Field label="Комментарий" error={errors.comment}>
            <Textarea
              value={v.comment}
              onChange={set('comment')}
              placeholder="Условия, договор, что входит"
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохраняю…' : stream ? 'Сохранить' : 'Добавить направление'}
            </Button>
            {stream ? (
              <Button type="button" variant="ghost" onClick={archive} disabled={saving}>
                Убрать направление
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Terms({ s }: { s: Stream }) {
  const parts = [
    s.budget ? `бюджет ${formatRubStr(s.budget)}` : null,
    s.monthlyFee ? `${formatRubStr(s.monthlyFee)} в месяц` : null,
    s.hoursLimit ? `пакет ${s.hoursLimit.replace('.', ',')} ч` : null,
    s.hourRate ? `час ${formatRubStr(s.hourRate)}` : null,
  ].filter(Boolean);
  return parts.length ? (
    <div className="text-fg-secondary text-sm">{parts.join(' · ')}</div>
  ) : (
    <div className="text-fg-tertiary text-sm">Условия оплаты не заданы</div>
  );
}

/** Directions of a project (ADR-052) as cards with terms, team and economics. */
export function StreamsPanel({
  projectId,
  streams,
  untagged,
  people,
  canEdit,
}: {
  projectId: string;
  streams: Stream[];
  untagged: EconomicsJson | null;
  people: Record<string, Person>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = React.useState<Stream | null>(null);
  const [open, setOpen] = React.useState(false);
  // A fresh form every time the dialog opens.
  const [round, setRound] = React.useState(0);
  const openFor = (s: Stream | null) => {
    setEditing(s);
    setRound((r) => r + 1);
    setOpen(true);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="tx-mark text-accent">Направления</h2>
        {canEdit ? (
          <Button size="sm" variant="secondary" onClick={() => openFor(null)}>
            <Plus className="size-3.5" />
            Направление
          </Button>
        ) : null}
      </div>
      {streams.length === 0 ? (
        <p className="border-border text-fg-tertiary border border-dashed px-4 py-6 text-center text-sm">
          Проект целиком. Если по нему идут разные работы, например поддержка и разработка, добавьте
          направления: у каждого будут свои условия оплаты, команда и финансы.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {streams.map((s) => {
            const team = s.memberIds.map((id) => people[id]).filter((p): p is Person => Boolean(p));
            const profitNegative = s.economics.factProfit.startsWith('-');
            return (
              <div key={s.id} className="border-border bg-surface flex flex-col gap-3 border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="bg-accent-soft text-accent px-2 py-0.5 text-xs font-semibold">
                      {STREAM_KIND_LABELS[s.kind]}
                    </span>
                    {s.name ? (
                      <div className="text-fg mt-2 text-lg leading-snug font-semibold break-words">
                        {s.name}
                      </div>
                    ) : null}
                    <div className="text-fg-tertiary mt-1.5 text-xs">
                      {s.status === 'COMPLETED' ? 'Завершено' : 'Идёт'}
                      {s.startDate ? ` · с ${formatDate(new Date(s.startDate))}` : ''}
                      {s.endDate ? ` по ${formatDate(new Date(s.endDate))}` : ''}
                    </div>
                  </div>
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openFor(s)}
                      aria-label="Изменить"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
                <Terms s={s} />
                <div className="border-border grid grid-cols-3 gap-2 border-t pt-3 text-sm">
                  <div>
                    <div className="text-fg-tertiary text-xs">Доход</div>
                    <div className="nums font-medium">{formatRubStr(s.economics.factIncome)}</div>
                  </div>
                  <div>
                    <div className="text-fg-tertiary text-xs">Расход</div>
                    <div className="nums font-medium">{formatRubStr(s.economics.factExpense)}</div>
                  </div>
                  <div>
                    <div className="text-fg-tertiary text-xs">Прибыль</div>
                    <div
                      className={cn(
                        'nums font-medium',
                        profitNegative ? 'text-negative' : 'text-positive',
                      )}
                    >
                      {formatRubStr(s.economics.factProfit)}
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  {team.length ? (
                    <div className="flex -space-x-1">
                      {team.slice(0, 6).map((p) => (
                        <Avatar
                          key={p.id}
                          className="ring-surface size-7 ring-2"
                          title={p.fullName}
                        >
                          {p.photoUrl ? <AvatarImage src={p.photoUrl} alt="" /> : null}
                          <AvatarFallback className="text-[10px]">
                            {initials(p.fullName)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  ) : null}
                  <span className="text-fg-tertiary truncate text-xs">
                    {team.length ? team.map((p) => p.fullName).join(', ') : 'Команда не задана'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {untagged ? (
        <p className="text-fg-tertiary mt-3 text-sm">
          Операции без направления: доход {formatRubStr(untagged.factIncome)}, расход{' '}
          {formatRubStr(untagged.factExpense)}.
        </p>
      ) : null}
      {canEdit ? (
        <StreamDialog
          key={round}
          projectId={projectId}
          stream={editing}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </section>
  );
}
