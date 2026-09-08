'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/cn';

export function Avatar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex size-8 shrink-0 overflow-hidden rounded-full bg-surface-muted',
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage(
  props: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>,
) {
  return <AvatarPrimitive.Image className="size-full object-cover" {...props} />;
}

export function AvatarFallback({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex size-full items-center justify-center text-xs font-medium text-fg-secondary',
        className,
      )}
      {...props}
    />
  );
}

/** Initials from a full name, e.g. "Анна Ковалёва" -> "АК". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
