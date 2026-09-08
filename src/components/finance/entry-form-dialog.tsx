'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog';
import { EntryForm } from './entry-form';

export function EntryFormDialog({
  lockedProjectId,
  trigger,
  label = 'Добавить операцию',
}: {
  lockedProjectId?: string;
  trigger?: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader title={label} description="Доход или расход по проекту" />
        <EntryForm
          lockedProjectId={lockedProjectId}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
