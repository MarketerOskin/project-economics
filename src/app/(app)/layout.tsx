import { SessionProvider } from '@/lib/client/session';
import { ToastProvider } from '@/lib/client/toast';
import { AppShell } from '@/components/layout/app-shell';
import { Bx24Init } from '@/components/bitrix/bx24-init';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <Bx24Init />
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </SessionProvider>
  );
}
