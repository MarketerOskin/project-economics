import * as React from 'react';
import { cn } from '@/lib/cn';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-1.5 block text-sm font-medium text-fg', className)} {...props} />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-[10px] border border-border bg-surface px-3 text-sm outline-none transition-colors',
        'placeholder:text-fg-tertiary focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30',
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
      'min-h-[76px] w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm outline-none',
      'placeholder:text-fg-tertiary focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30',
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
