'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { centeredIn, useViewportBand } from '@/lib/client/viewport-band';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  style,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  const band = useViewportBand();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/70" />
      <DialogPrimitive.Content
        className={cn(
          'border-border bg-surface fixed top-1/2 left-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 border p-5 sm:p-6',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 max-h-[88vh] overflow-y-auto',
          className,
        )}
        style={{ ...centeredIn(band), ...style }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="text-fg-tertiary hover:bg-surface-muted hover:text-fg absolute top-4 right-4 p-1"
          aria-label="Закрыть"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <DialogPrimitive.Title className="text-lg font-bold tracking-tight uppercase">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-fg-secondary mt-1 text-sm">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  );
}
