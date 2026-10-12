import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { getAdminAccess } from '@/lib/auth/admin';
import { getAuthSession } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Chưa có quyền quản trị' };

// Signed-in accounts without admin access land here from /admin. The page
// says why in general terms and never reveals who the admins are.
export default async function AdminAccessPage() {
  const session = await getAuthSession();
  if (!session) redirect('/auth/login?returnTo=%2Fadmin');
  if ((await getAdminAccess()).allowed) redirect('/admin');
  const verified = Boolean(session.user.emailVerifiedAt);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <ShieldAlert className="size-8 text-amber-500" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-extrabold">Tài khoản này chưa có quyền quản trị</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {verified
            ? 'Email của tài khoản đang đăng nhập không có quyền vào khu vực quản trị. Nếu em dùng một tài khoản khác để quản trị, hãy đăng xuất rồi đăng nhập bằng tài khoản đó.'
            : 'Khu vực quản trị cần email đã được Google xác minh. Nếu em đăng ký bằng mật khẩu, hãy vào Hồ sơ và chọn “Liên kết Google” để dùng chung một tài khoản cho cả học tập và quản trị.'}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/student/dashboard"
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
          >
            Về trang học tập
          </Link>
          {!verified && (
            <Link
              href="/student/profile"
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              Mở Hồ sơ
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
