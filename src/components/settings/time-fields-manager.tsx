'use client';

import * as React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Mapping {
  entityTypeId: number;
  label: string;
  hoursField: string | null;
  minutesField: string | null;
  userField: string | null;
}

interface Field {
  name: string;
  title: string;
}

const NONE = 'none';

function FieldSelect({
  label,
  value,
  onChange,
  fields,
  noneLabel,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  fields: Field[];
  noneLabel: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-fg-secondary text-xs">{label}</span>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-[var(--radix-select-trigger-width)] overflow-y-auto">
          <SelectItem value={NONE}>{noneLabel}</SelectItem>
          {fields.map((f) => (
            <SelectItem key={f.name} value={f.name}>
              {f.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Editor({
  entityTypeId,
  title,
  initial,
  onDone,
}: {
  entityTypeId: number;
  title: string;
  initial: Mapping | null;
  onDone: (saved: boolean) => void;
}) {
  const { toast } = useToast();
  const [fields, setFields] = React.useState<{ numeric: Field[]; users: Field[] } | null>(null);
  const [hours, setHours] = React.useState(initial?.hoursField ?? null);
  const [minutes, setMinutes] = React.useState(initial?.minutesField ?? null);
  const [user, setUser] = React.useState(initial?.userField ?? null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ numeric: Field[]; users: Field[] }>(
      `/api/crm/time-fields/fields?entityTypeId=${entityTypeId}`,
    )
      .then((r) => !cancelled && setFields(r))
      .catch((e) => {
        if (cancelled) return;
        toast(e instanceof Error ? e.message : 'Не удалось загрузить поля', 'error');
        onDone(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityTypeId, toast, onDone]);

  const save = async () => {
    if (!hours && !minutes) {
      toast('Выберите поле для часов или минут', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/crm/time-fields', {
        method: 'PUT',
        body: { entityTypeId, hoursField: hours, minutesField: minutes, userField: user },
      });
      toast('Сохранено. Аналитика пересчитается при следующем открытии');
      onDone(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-accent/40 bg-surface flex flex-col gap-3 border p-4">
      <div className="font-medium">{title}</div>
      {fields === null ? (
        <p className="text-fg-tertiary text-sm">Загружаю поля из Битрикс24…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldSelect
              label="Часы"
              value={hours}
              onChange={setHours}
              fields={fields.numeric}
              noneLabel="Не используется"
            />
            <FieldSelect
              label="Минуты"
              value={minutes}
              onChange={setMinutes}
              fields={fields.numeric}
              noneLabel="Не используется"
            />
            <FieldSelect
              label="Кто работал"
              value={user}
              onChange={setUser}
              fields={fields.users}
              noneLabel="Ответственный"
            />
          </div>
          <p className="text-fg-tertiary text-xs">
            Если время лежит в одном поле, выберите только его. Часы и минуты складываются: 1 ч в
            одном поле и 30 мин в другом дают 1 ч 30 мин.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDone(false)} disabled={saving}>
              Отмена
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Where CRM types keep time spent on an item (ADR-040). */
export function TimeFieldsManager() {
  const { toast } = useToast();
  const [data, setData] = React.useState<{
    types: Array<{ entityTypeId: number; title: string }>;
    mappings: Mapping[];
    error: string | null;
  } | null>(null);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setData(await apiFetch('/api/crm/time-fields'));
    } catch (e) {
      setData({
        types: [],
        mappings: [],
        error: e instanceof Error ? e.message : 'Не удалось загрузить',
      });
    }
  }, []);

  React.useEffect(() => {
    // Fetch-on-mount: setState only happens after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const done = React.useCallback(
    (saved: boolean) => {
      setEditing(null);
      setAdding(false);
      if (saved) void load();
    },
    [load],
  );

  const remove = async (m: Mapping) => {
    try {
      await apiFetch('/api/crm/time-fields', {
        method: 'PUT',
        body: {
          entityTypeId: m.entityTypeId,
          hoursField: null,
          minutesField: null,
          userField: null,
        },
      });
      toast('Убрано');
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось убрать', 'error');
    }
  };

  if (!data) return <p className="text-fg-tertiary text-sm">Загрузка…</p>;

  const mapped = new Set(data.mappings.map((m) => m.entityTypeId));
  const addable = data.types.filter((t) => !mapped.has(t.entityTypeId));
  const typeTitle = (id: number) => data.types.find((t) => t.entityTypeId === id)?.title;

  return (
    <div className="flex flex-col gap-3">
      {data.error ? (
        <p className="bg-negative-soft text-negative px-3 py-2 text-sm">
          Битрикс24 не отдал список разделов: {data.error}
        </p>
      ) : null}

      {data.mappings.length === 0 && !adding ? (
        <p className="border-border text-fg-secondary border border-dashed px-4 py-5 text-sm">
          Пока время берётся только из учёта времени в задачах. Если в каком-то смарт-процессе или в
          сделках время записывают в отдельные поля, выберите этот раздел и его поля.
        </p>
      ) : null}

      {data.mappings.map((m) =>
        editing === m.entityTypeId ? (
          <Editor
            key={m.entityTypeId}
            entityTypeId={m.entityTypeId}
            title={typeTitle(m.entityTypeId) ?? m.label}
            initial={m}
            onDone={done}
          />
        ) : (
          <div
            key={m.entityTypeId}
            className="border-border bg-surface flex items-center justify-between gap-3 border px-4 py-3 text-sm"
          >
            <div>
              <div className="font-medium">{typeTitle(m.entityTypeId) ?? m.label}</div>
              <div className="text-fg-tertiary mt-0.5 text-xs">
                {[m.hoursField && 'часы', m.minutesField && 'минуты'].filter(Boolean).join(' + ')}
                {' · '}
                {m.userField ? 'сотрудник из поля' : 'время записывается на ответственного'}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(m.entityTypeId)}
                aria-label="Изменить"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label="Убрать">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ),
      )}

      {adding && editing !== null ? (
        <Editor
          key={`new-${editing}`}
          entityTypeId={editing}
          title={typeTitle(editing) ?? ''}
          initial={null}
          onDone={done}
        />
      ) : adding ? (
        <Select onValueChange={(v) => setEditing(Number(v))}>
          <SelectTrigger aria-label="Раздел">
            <SelectValue placeholder="Выберите раздел Битрикс24" />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)] overflow-y-auto">
            {addable.map((t) => (
              <SelectItem key={t.entityTypeId} value={String(t.entityTypeId)}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : addable.length > 0 ? (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            Добавить раздел с полями времени
          </Button>
        </div>
      ) : null}
    </div>
  );
}
