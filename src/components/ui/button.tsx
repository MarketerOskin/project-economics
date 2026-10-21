import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[color,background-color,border-color,filter,box-shadow,scale] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'btn-glow bg-button-primary text-button-primary-fg hover:brightness-110',
        secondary:
          'border border-border-strong bg-white/[0.03] text-fg backdrop-blur-sm hover:bg-white/[0.07] in-data-[theme=light]:bg-white in-data-[theme=light]:hover:bg-[#f2f2f5]',
        ghost: 'text-fg-secondary hover:bg-surface-muted hover:text-fg',
        destructive: 'bg-negative text-bg hover:brightness-110',
      },
      size: {
        sm: 'h-8 px-3.5',
        md: 'h-10 px-5',
        lg: 'h-12 px-6',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
