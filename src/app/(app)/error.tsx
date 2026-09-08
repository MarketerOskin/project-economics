'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Human error screen for anything that throws in an (app) route (ТЗ §39). */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Что-то пошло не так</h1>
      <p className="text-sm text-fg-secondary">
        Не удалось загрузить данные. Проверьте соединение и попробуйте ещё раз — если ошибка
        повторяется, обратитесь к администратору.
      </p>
      <Button onClick={reset}>Попробовать снова</Button>
    </div>
  );
}
