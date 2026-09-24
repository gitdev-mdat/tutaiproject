import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';

import { cn } from '@/lib/utils';

const linkButtonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline: 'border-border bg-background hover:bg-muted hover:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]',
        ghost: 'hover:bg-muted hover:text-foreground',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 gap-1.5 px-2.5',
        xs: 'h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs',
        sm: 'h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]',
        lg: 'h-9 gap-1.5 px-2.5',
        icon: 'size-8',
        'icon-xs': 'size-6 rounded-[min(var(--radius-md),10px)]',
        'icon-sm': 'size-7 rounded-[min(var(--radius-md),12px)]',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type LinkButtonProps = VariantProps<typeof linkButtonVariants> & {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function LinkButton({ href, variant, size, className, children }: LinkButtonProps) {
  return (
    <Link href={href} className={cn(linkButtonVariants({ variant, size, className }))}>
      {children}
    </Link>
  );
}
