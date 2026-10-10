'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell, AuthColumn } from '@/components/auth/auth-shell';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { RegisterPreview } from '@/components/auth/register-preview';
import { safeReturnPath } from '@/lib/auth/safe-return-path';
import { fetchAuthSession } from '@/lib/auth/client-session';

function GoogleButton({ returnTo, disabled }: { returnTo: string; disabled: boolean }) {
  return (
    <a
      href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`}
      aria-disabled={disabled}
      className="flex h-[50px] w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 transition hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-60"
    >
      <span aria-hidden="true" className="text-lg font-black text-[#4285F4]">
        G
      </span>
      Tiếp tục với Google
    </a>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'), '/student/dashboard');
  const [form, setForm] = React.useState({
    fullName: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = React.useState<Partial<typeof form>>({});
  const [serverError, setServerError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    fetchAuthSession()
      .then((session) => {
        if (active && session?.authenticated) router.replace(session.redirectTo);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [router]);

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function validate() {
    const next: Partial<typeof form> = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Vui lòng nhập họ và tên.';
    if (
      !/^(?:\+84|84|0)(?:3[2-9]|5[2-9]|7[06-9]|8\d|9\d)\d{7}$/.test(
        form.phone.replace(/[\s.()-]/g, '')
      )
    )
      next.phone = 'Số điện thoại không hợp lệ.';
    if (!/^[a-zA-Z0-9_]{4,24}$/.test(form.username.trim()))
      next.username = 'Dùng 4–24 ký tự: chữ cái, số hoặc dấu gạch dưới.';
    if (form.password.length < 8) next.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
    if (form.confirmPassword !== form.password)
      next.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);
    setServerError('');
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setServerError(data.message ?? 'Không thể tạo tài khoản.');
        setIsSubmitting(false);
        return;
      }
      router.replace(data.redirectTo ?? '/onboarding/profile');
      router.refresh();
    } catch {
      setServerError('Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.');
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell mode="register">
      <AuthColumn side="left" mode="register">
        <div className="flex flex-col pb-6 lg:pr-8 lg:pb-20">
          <span className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-[#0052FF]">
            BẮT ĐẦU NHẸ NHÀNG
          </span>
          <h1 className="mb-4 max-w-[540px] text-3xl font-extrabold leading-tight tracking-tight text-[#091224] lg:text-5xl">
            Lộ trình đã sẵn sàng. Tạo tài khoản để giữ lại.
          </h1>
          <p className="mb-6 max-w-[480px] text-base leading-relaxed text-slate-500">
            Chỉ cần thông tin đăng nhập. Tú Tài sẽ hỏi mục tiêu học tập ở bước tiếp theo.
          </p>
          <RegisterPreview />
        </div>
      </AuthColumn>
      <AuthColumn side="right" mode="register">
        <div className="flex w-full flex-col rounded-3xl border border-[#e8eef8] bg-white p-6 shadow-xl lg:p-8">
          <h2 className="text-2xl font-extrabold text-[#091224]">Tạo tài khoản</h2>
          <p className="mb-5 mt-1 text-sm font-medium text-slate-500">
            Bắt đầu miễn phí trong chưa đầy một phút.
          </p>
          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {serverError}
            </div>
          )}
          <GoogleButton returnTo={returnTo} disabled={isSubmitting} />
          <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            hoặc
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <AuthFormField
              id="reg-full-name"
              label="Họ và tên"
              type="text"
              autoComplete="name"
              value={form.fullName}
              onChange={update('fullName')}
              error={errors.fullName}
              required
            />
            <AuthFormField
              id="reg-phone"
              label="Số điện thoại"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={update('phone')}
              error={errors.phone}
              required
            />
            <AuthFormField
              id="reg-username"
              label="Tên đăng nhập"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={update('username')}
              error={errors.username}
              required
            />
            <AuthFormField
              id="reg-password"
              label="Mật khẩu"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              error={errors.password}
              showPasswordToggle
              supportingText="Tối thiểu 8 ký tự."
              required
            />
            <AuthFormField
              id="reg-confirm-password"
              label="Nhập lại mật khẩu"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              error={errors.confirmPassword}
              showPasswordToggle
              required
            />
            <button
              id="register-submit"
              type="submit"
              disabled={isSubmitting}
              className="mt-1 flex h-[52px] items-center justify-center rounded-xl bg-[#0052FF] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản & bắt đầu'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            Đã có tài khoản?{' '}
            <Link
              className="font-semibold text-[#0052FF]"
              href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
            >
              Đăng nhập
            </Link>
          </p>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
            Việc tạo tài khoản không đồng nghĩa với đồng ý nhận nội dung tiếp thị.
          </p>
        </div>
      </AuthColumn>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense fallback={null}>
      <RegisterPageContent />
    </React.Suspense>
  );
}
