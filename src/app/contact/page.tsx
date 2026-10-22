import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Экономика проектов — связаться с разработчиком',
};

export default function ContactPage() {
  return (
    <div className="bg-bg flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-surface w-full max-w-md space-y-5 border p-8 text-center">
        <Image src="/icon.svg" alt="" width={48} height={48} className="mx-auto" />

        <div>
          <h1 className="text-lg font-bold tracking-tight">Экономика проектов</h1>
          <p className="text-fg-secondary mt-1 text-sm">
            Приложение для Битрикс24 — план, факт, прибыль и маржа по каждому проекту.
          </p>
        </div>

        <p className="text-fg-secondary text-sm">
          Приложение работает только внутри Битрикс24 — отдельного публичного демо нет. Установите
          его на тестовый портал через Маркетплейс, либо напишите, и я покажу вживую.
        </p>

        <a
          href="mailto:MarketerOskin@yandex.ru"
          className="bg-accent text-accent-fg inline-block rounded-full px-4 py-2 font-mono text-[12px] font-bold uppercase hover:brightness-110"
        >
          MarketerOskin@yandex.ru
        </a>

        <p className="text-fg-tertiary text-xs">
          Уже установили приложение? Внутри него, в правом нижнем углу, есть кнопка «Сообщить о
          проблеме» — сообщение придёт напрямую разработчику.
        </p>
      </div>
    </div>
  );
}
