import type { Metadata } from 'next';

import { PublicFooter } from '@/components/layout';

export const metadata: Metadata = {
  title: 'Tú Tài',
  description:
    'Nền tảng học tập cá nhân hóa cho học sinh lớp 12. Lộ trình đúng, luyện tập đúng chỗ, thi thử như thi thật.',
};

// PublicHeader is rendered inside the Hero section — not in the layout.
// This allows the navbar to scroll away naturally when the Hero leaves the viewport.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
