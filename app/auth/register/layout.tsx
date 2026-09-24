import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Tạo tài khoản',
  description: 'Tạo tài khoản Tú Tài miễn phí và bắt đầu lộ trình học của em.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
