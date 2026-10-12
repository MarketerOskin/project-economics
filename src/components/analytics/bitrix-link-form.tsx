'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CrmImport, type CrmSelection } from '@/components/projects/crm-import';
import type { BitrixGroupSelection } from '@/components/projects/bitrix-group-import';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';

/**
 * Attach a project made by hand to a Bitrix24 deal, company, smart-process item or «Проекты»
 * group (ADR-035), so «Аналитика» can read its tasks, hours and meetings.
 */
export function BitrixLinkForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [crm, setCrm] = React.useState<CrmSelection | null>(null);
  const [group, setGroup] = React.useState<BitrixGroupSelection | null>(null);
  const [saving, setSaving] = React.useState(false);

  const pickCrm = (v: CrmSelection | null) => {
    setCrm(v);
    if (v) setGroup(null);
  };
  const pickGroup = (v: BitrixGroupSelection | null) => {
    setGroup(v);
    if (v) setCrm(null);
  };

  const chosen = group?.title ?? crm?.title ?? null;

  const submit = async () => {
    const body = group
      ? { source: 'BITRIX_PROJECT', bitrixGroupId: group.id }
      : crm
        ? { source: 'BITRIX_CRM', crmEntityTypeId: crm.entityTypeId, crmEntityId: crm.id }
        : null;
    if (!body) return;
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/bitrix-link`, { method: 'POST', body });
      toast('Проект связан с Битрикс24');
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось связать', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border border-border bg-surface p-4">
      <CrmImport value={crm} onChange={pickCrm} group={group} onGroupChange={pickGroup} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={submit} disabled={!chosen || saving}>
          <Link2 />
          {saving ? 'Связываю…' : 'Связать с Битрикс24'}
        </Button>
        {chosen ? <span className="text-sm text-fg-secondary">Выбрано: {chosen}</span> : null}
      </div>
    </div>
  );
}
