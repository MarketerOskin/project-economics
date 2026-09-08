import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="text-sm text-fg-secondary">
        Возможно, проект или операция были удалены, либо ссылка устарела.
      </p>
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        Вернуться на дашборд
      </Link>
    </main>
  );
}
