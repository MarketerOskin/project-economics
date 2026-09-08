import { SessionProvider } from '@/lib/client/session';
import { ToastProvider } from '@/lib/client/toast';
import { AppShell } from '@/components/layout/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </SessionProvider>
  );
}
