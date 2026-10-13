'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/client/toast';

/**
 * Downloads the .xlsx through fetch (not a plain link) so it carries the same session as the
 * rest of the app inside the Bitrix24 iframe, where third-party cookies may be blocked.
 */
export function ExportButton({
  projectId,
  employeeId,
  label = 'Excel',
  endpoint = '/api/analytics/export',
  extra,
}: {
  projectId?: string;
  employeeId?: string;
  label?: string;
  endpoint?: string;
  /** More query parameters (e.g. tab and format of the marketing export). */
  extra?: Record<string, string>;
}) {
  const params = useSearchParams();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams();
      for (const k of ['p', 'm', 'from', 'to', 'employeeId', 'projectId']) {
        const v = params.get(k);
        if (v) q.set(k, v);
      }
      if (projectId) q.set('projectId', projectId);
      if (employeeId) q.set('employeeId', employeeId);
      for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v);
      const res = await fetch(`${endpoint}?${q.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('content-disposition') ?? '')?.[1];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name ? decodeURIComponent(name) : `export.${extra?.format === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      toast('Не удалось сформировать выгрузку', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" onClick={run} disabled={busy}>
      <Download />
      {busy ? 'Готовлю…' : label}
    </Button>
  );
}
