import * as React from 'react';
import { cn } from '@/lib/cn';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('tx-mark mb-1.5 block text-fg-tertiary', className)} {...props} />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full border border-border bg-transparent px-3 text-sm outline-none transition-colors',
        'placeholder:text-fg-tertiary focus-visible:border-accent',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-[76px] w-full border border-border bg-transparent px-3 py-2 text-sm outline-none',
      'placeholder:text-fg-tertiary focus-visible:border-accent',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-negative">{children}</p>;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-fg-tertiary">{hint}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/**
 * A button that sits in a row of fields: an invisible label keeps it level with the inputs,
 * whatever hints the fields show underneath.
 */
export function FieldAction({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Label aria-hidden className="invisible hidden sm:block">
        &nbsp;
      </Label>
      {children}
    </div>
  );
}
