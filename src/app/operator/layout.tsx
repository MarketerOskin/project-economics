import { ToastProvider } from '@/lib/client/toast';

export const metadata = {
  title: 'Оператор — Экономика проектов',
};

/**
 * The operator back-office lives entirely outside the Bitrix24 iframe app: no AppShell,
 * no portal SessionProvider (there is no portal here — see src/lib/operator/).
 */
export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
