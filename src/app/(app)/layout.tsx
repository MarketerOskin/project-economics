import { SessionProvider } from '@/lib/client/session';
import { ToastProvider } from '@/lib/client/toast';
import { AppShell } from '@/components/layout/app-shell';
import { Bx24Init } from '@/components/bitrix/bx24-init';
import { MotionProvider } from '@/components/motion/motion-provider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <Bx24Init />
        <MotionProvider>
          <AppShell>{children}</AppShell>
        </MotionProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
