'use client';

import * as React from 'react';
import { Toaster, toast as sonner } from 'sonner';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useViewportBand } from '@/lib/client/viewport-band';

type ToastKind = 'success' | 'error';

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** A confirmation after a save, the reason after a failure (sonner, ADR-067). */
function show(message: string, kind: ToastKind = 'success') {
  if (kind === 'error') sonner.error(message, { duration: 6000 });
  else sonner.success(message);
}

const GAP = 16;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // Inside the Bitrix24 iframe the toasts sit at the bottom of the slice on screen (ADR-053).
  const band = useViewportBand();
  const offset = band
    ? { right: GAP, bottom: Math.max(GAP, window.innerHeight - band.top - band.height + GAP) }
    : GAP;
  const value = React.useMemo(() => ({ toast: show }), []);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        position="bottom-right"
        offset={offset}
        mobileOffset={offset}
        closeButton
        visibleToasts={4}
        gap={8}
        icons={{
          success: <CheckCircle2 className="text-positive size-4" />,
          error: <AlertCircle className="text-negative size-4" />,
        }}
        toastOptions={{
          unstyled: true,
          duration: 4500,
          closeButtonAriaLabel: 'Закрыть',
          classNames: { toast: 'app-toast', title: 'flex-1' },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
