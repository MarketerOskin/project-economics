'use client';

import * as React from 'react';
import type { AppRole } from '@prisma/client';
import { apiFetch } from './api';

export interface ClientSession {
  demo: boolean;
  role: AppRole;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    photoUrl: string | null;
    position: string | null;
  };
}

interface SessionContextValue {
  session: ClientSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  switchRole: (role: AppRole) => Promise<void>;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<ClientSession | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const data = await apiFetch<ClientSession>('/api/session');
      setSession(data);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchRole = React.useCallback(
    async (role: AppRole) => {
      await apiFetch('/api/demo/switch-role', { method: 'POST', body: { role } });
      await refresh();
      // A role change alters what data is visible everywhere — hard reload for correctness.
      window.location.reload();
    },
    [refresh],
  );

  React.useEffect(() => {
    // Synchronising with an external system (the session endpoint) on mount; setState
    // only happens after the awaited fetch resolves, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, refresh, switchRole }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
