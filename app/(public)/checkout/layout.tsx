import { TuTaiMark } from '@/components/layout/public-header';
import Link from 'next/link';

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f0f4f8]">
      <header className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-100">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <TuTaiMark size={32} />
          </div>
          <Link
            href="/pricing"
            className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Quay lại
          </Link>
        </div>
      </header>
      <main className="flex-1 py-6 px-6">
        <div className="mx-auto w-full max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
