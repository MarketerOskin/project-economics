'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, ImagePlus, Trash2 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ReportLetterhead, ReportSignoff } from '@/components/report/letterhead';
import { DEFAULT_ACCENT, LOGO_MAX_BYTES, normalizeHex, reportPalette } from '@/lib/brand';
import type { BrandDto, BrandSuggestion } from '@/server/services/brand';

type Text = 'companyName' | 'contacts' | 'requisites' | 'signerName' | 'signerTitle' | 'footerNote';

/** Report branding form with a live preview of the report's top and bottom (ADR-054). */
export function BrandForm({ initial }: { initial: BrandDto }) {
  const router = useRouter();
  const { toast } = useToast();
  const [v, setV] = React.useState({
    companyName: initial.companyName ?? '',
    contacts: initial.contacts ?? '',
    requisites: initial.requisites ?? '',
    signerName: initial.signerName ?? '',
    signerTitle: initial.signerTitle ?? '',
    footerNote: initial.footerNote ?? '',
    accentColor: initial.accentColor ?? DEFAULT_ACCENT,
  });
  // undefined = keep the saved logo, null = remove it, string = new data URL.
  const [logo, setLogo] = React.useState<string | null | undefined>(undefined);
  const [busy, setBusy] = React.useState<'save' | 'pull' | null>(null);
  const [notes, setNotes] = React.useState<string[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const logoUrl = logo === undefined ? initial.logoUrl : logo;
  const palette = reportPalette(v.accentColor);
  const set = (k: Text) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > LOGO_MAX_BYTES) return toast('Логотип больше 512 КБ, уменьшите его', 'error');
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(f);
  };

  const pull = async () => {
    setBusy('pull');
    try {
      const s = await apiFetch<BrandSuggestion>('/api/brand/suggest', { method: 'POST' });
      setV((x) => ({
        ...x,
        companyName: s.companyName ?? x.companyName,
        contacts: s.contacts ?? x.contacts,
        requisites: s.requisites ?? x.requisites,
        signerName: s.signerName ?? x.signerName,
        signerTitle: s.signerTitle ?? x.signerTitle,
      }));
      if (s.logo) setLogo(s.logo);
      setNotes(s.notes);
      toast('Данные подтянуты, проверьте и сохраните');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось прочитать CRM', 'error');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save');
    try {
      await apiFetch('/api/brand', {
        method: 'PUT',
        body: {
          ...v,
          accentColor: normalizeHex(v.accentColor),
          ...(logo !== undefined ? { logo } : {}),
        },
      });
      setLogo(undefined);
      toast('Бренд сохранён');
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="border-border bg-surface flex flex-col gap-4 border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="tx-mark text-accent">Данные компании</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={pull}
            disabled={busy !== null}
          >
            <Download className="size-3.5" />
            {busy === 'pull' ? 'Читаю CRM…' : 'Подтянуть из Битрикс24'}
          </Button>
        </div>
        {notes.length ? (
          <ul className="border-border bg-surface-muted text-fg-secondary border border-dashed px-4 py-3 text-sm">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}

        <div>
          <div className="tx-mark text-fg-tertiary mb-1.5">Логотип</div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="border-border flex h-16 w-44 items-center justify-center border bg-white p-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-[#888]">нет логотипа</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={pickFile}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-3.5" />
              Загрузить
            </Button>
            {logoUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>
                <Trash2 className="size-3.5" />
                Убрать
              </Button>
            ) : null}
          </div>
          <p className="text-fg-tertiary mt-1 text-xs">
            PNG, JPEG или WEBP до 512 КБ, лучше на прозрачном или белом фоне
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="Название компании" htmlFor="b-name">
            <Input
              id="b-name"
              value={v.companyName}
              onChange={set('companyName')}
              placeholder="ООО «Ваша компания»"
            />
          </Field>
          <Field label="Фирменный цвет" htmlFor="b-color">
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Выбрать цвет"
                value={normalizeHex(v.accentColor) ?? DEFAULT_ACCENT}
                onChange={(e) => setV((x) => ({ ...x, accentColor: e.target.value }))}
                className="border-border h-10 w-10 shrink-0 cursor-pointer border bg-transparent p-1"
              />
              <Input
                id="b-color"
                value={v.accentColor}
                onChange={(e) => setV((x) => ({ ...x, accentColor: e.target.value }))}
              />
            </div>
          </Field>
        </div>
        <Field label="Контакты в шапке" htmlFor="b-contacts" hint="Телефон, почта, сайт">
          <Textarea
            id="b-contacts"
            value={v.contacts}
            onChange={set('contacts')}
            className="min-h-[56px]"
          />
        </Field>
        <Field
          label="Реквизиты внизу отчёта"
          htmlFor="b-req"
          hint="Юрлицо, ИНН, КПП, адрес, банк, как они должны выглядеть"
        >
          <Textarea
            id="b-req"
            value={v.requisites}
            onChange={set('requisites')}
            className="min-h-[96px]"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Подписывает" htmlFor="b-signer">
            <Input
              id="b-signer"
              value={v.signerName}
              onChange={set('signerName')}
              placeholder="Имя Фамилия"
            />
          </Field>
          <Field label="Должность" htmlFor="b-signer-title">
            <Input
              id="b-signer-title"
              value={v.signerTitle}
              onChange={set('signerTitle')}
              placeholder="Генеральный директор"
            />
          </Field>
        </div>
        <Field
          label="Примечание в конце отчёта"
          htmlFor="b-note"
          hint="Например, условия приёмки работ"
        >
          <Textarea
            id="b-note"
            value={v.footerNote}
            onChange={set('footerNote')}
            className="min-h-[56px]"
          />
        </Field>
        <div>
          <Button type="button" onClick={save} disabled={busy !== null}>
            {busy === 'save' ? 'Сохраняю…' : 'Сохранить'}
          </Button>
        </div>
      </div>

      <div>
        <div className="tx-mark text-fg-tertiary mb-2">Так будет выглядеть отчёт</div>
        <div className="bg-white pb-6 text-[13px] text-[#111] shadow-[0_0_0_1px_var(--border)]">
          <ReportLetterhead
            brand={{ companyName: v.companyName || null, contacts: v.contacts || null, logoUrl }}
            palette={palette}
            kicker="Отчёт о выполненных работах"
            title="Поддержка CRM"
            subtitle="ООО «Клиент»"
          />
          <div className="px-8">
            <div
              className="mt-4 inline-block px-3 py-1 text-sm font-bold"
              style={{ background: palette.accent, color: palette.onAccent }}
            >
              Октябрь 2026
            </div>
            <table className="mt-4 w-full border-collapse text-[12px]">
              <thead>
                <tr style={{ background: palette.soft }}>
                  <th className="px-2 py-1.5 text-left font-semibold">Задача</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Затрачено</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#e6e6dc]">
                  <td className="px-2 py-1.5">Настроить воронку продаж</td>
                  <td className="px-2 py-1.5 text-right">2 ч 30 мин</td>
                </tr>
              </tbody>
            </table>
            <ReportSignoff
              palette={palette}
              requisites={v.requisites || null}
              signerName={v.signerName || null}
              signerTitle={v.signerTitle || null}
              clientName="ООО «Клиент»"
              footerNote={v.footerNote || null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
