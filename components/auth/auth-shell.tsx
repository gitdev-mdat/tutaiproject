import * as React from 'react';

interface AuthShellProps {
  children: React.ReactNode;
  mode: 'register' | 'login';
}

export function AuthShell({ children, mode }: AuthShellProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-[1160px] flex-col items-center justify-center px-4 py-8 lg:px-8">
      <div
        className={`flex w-full flex-col items-start justify-between gap-10 lg:flex-row lg:items-center ${
          mode === 'register' ? 'lg:gap-10' : 'lg:gap-14'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

interface AuthColumnProps {
  children: React.ReactNode;
  side: 'left' | 'right';
  mode: 'register' | 'login';
}

export function AuthColumn({ children, side, mode }: AuthColumnProps) {
  let widthClass = '';
  let orderClass = '';

  if (mode === 'register') {
    // Left = copy/trust content, Right = form card
    widthClass = side === 'left' ? 'lg:w-[45%]' : 'lg:w-[55%] lg:max-w-[480px]';
    orderClass = side === 'left' ? 'order-2 lg:order-1' : 'order-1 lg:order-2';
  } else {
    // Login — Left = copy/preview, Right = login card
    widthClass = side === 'left' ? 'lg:w-[48%]' : 'lg:w-[52%] lg:max-w-[460px]';
    if (side === 'left') {
      // Hide on mobile (form takes priority), show on lg+
      orderClass = 'hidden lg:flex lg:flex-col lg:order-1';
    } else {
      // Form always shows first on mobile
      orderClass = 'order-1 w-full lg:order-2';
    }
  }

  return <div className={`flex w-full flex-col ${widthClass} ${orderClass}`}>{children}</div>;
}
