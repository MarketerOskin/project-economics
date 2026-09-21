import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Экономика проектов — связаться с разработчиком',
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md space-y-5 rounded-[18px] border border-border bg-surface p-8 text-center shadow-sm">
        <Image src="/icon.svg" alt="" width={48} height={48} className="mx-auto rounded-[12px]" />

        <div>
          <h1 className="text-lg font-semibold tracking-tight">Экономика проектов</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            Приложение для Битрикс24 — план, факт, прибыль и маржа по каждому проекту.
          </p>
        </div>

        <p className="text-sm text-fg-secondary">
          Приложение работает только внутри Битрикс24 — отдельного публичного демо нет.
          Установите его на тестовый портал через Маркетплейс, либо напишите, и я покажу
          вживую.
        </p>

        <a
          href="mailto:vasiliyoskin96@gmail.com"
          className="inline-block rounded-[10px] bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          vasiliyoskin96@gmail.com
        </a>

        <p className="text-xs text-fg-tertiary">
          Уже установили приложение? Внутри него, в правом нижнем углу, есть кнопка
          «Сообщить о проблеме» — сообщение придёт напрямую разработчику.
        </p>
      </div>
    </div>
  );
}
