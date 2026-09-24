import { Button } from '@/components/ui/button';

interface IconButtonProps extends React.ComponentProps<typeof Button> {
  label: string;
  icon: React.ReactNode;
}

export function IconButton({
  label,
  icon,
  className,
  variant = 'ghost',
  size = 'icon',
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </Button>
  );
}
