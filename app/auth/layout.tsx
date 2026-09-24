import type { Metadata } from 'next';
import React from 'react';

import { AuthHeader } from '@/components/auth/auth-header';

export const metadata: Metadata = {
  title: {
    template: '%s | Tú Tài',
    default: 'Xác thực | Tú Tài',
  },
  description: 'Đăng nhập hoặc tạo tài khoản Tú Tài.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{ background: 'linear-gradient(160deg, #f5f8ff 0%, #edf2ff 60%, #f0f4ff 100%)' }}
    >
      <AuthHeader />
      <main id="main-content" className="flex flex-1 flex-col" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
