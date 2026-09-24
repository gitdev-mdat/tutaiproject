'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeReturnPath } from '@/lib/auth/safe-return-path';
import { Check } from 'lucide-react';
import { AuthShell, AuthColumn } from '@/components/auth/auth-shell';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { RegisterPreview } from '@/components/auth/register-preview';

// ─── Register Page ───────────────────────────────────────────────────────────
// Route: /auth/register
// Fields (exact order): Họ và tên, Số điện thoại, Tên đăng nhập, Mật khẩu, Nhập lại mật khẩu
// No email field in the primary registration form.
// ─────────────────────────────────────────────────────────────────────────────

function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

function isValidVietnamesePhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // Accepts +84xxxxxxxxx or 0xxxxxxxxx (10 digits starting with 03/05/07/08/09)
  return /^(\+84|0)(3[2-9]|5[2-9]|7[06-9]|8[0-9]|9[0-9])\d{7}$/.test(normalized);
}

function isValidUsername(value: string): boolean {
  return /^[a-zA-Z0-9_]{4,24}$/.test(value);
}

export default function RegisterPage() {
  return (
    <React.Suspense fallback={null}>
      <RegisterPageContent />
    </React.Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));

  React.useEffect(() => {
    let active = true;

    fetch('/api/auth/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((session) => {
        if (active && (session?.authenticated || session?.user)) router.replace(returnTo);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [router, returnTo]);

  const [form, setForm] = React.useState({
    fullName: '',
    phoneNumber: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = React.useState<Partial<typeof form>>({});
  const [serverError, setServerError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      // Clear error on change
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function validate(): boolean {
    const next: Partial<typeof form> = {};

    if (!form.fullName.trim()) {
      next.fullName = 'Vui lòng nhập họ và tên.';
    } else if (form.fullName.trim().length < 2) {
      next.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';
    }

    if (!form.phoneNumber.trim()) {
      next.phoneNumber = 'Vui lòng nhập số điện thoại.';
    } else if (!isValidVietnamesePhone(form.phoneNumber)) {
      next.phoneNumber = 'Số điện thoại không hợp lệ.';
    }

    if (!form.username.trim()) {
      next.username = 'Vui lòng nhập tên đăng nhập.';
    } else if (!isValidUsername(form.username)) {
      next.username = 'Tên đăng nhập gồm 4–24 ký tự: chữ cái, số, hoặc dấu gạch dưới.';
    }

    if (!form.password) {
      next.password = 'Vui lòng nhập mật khẩu.';
    } else if (form.password.length < 8) {
      next.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
    }

    if (!form.confirmPassword) {
      next.confirmPassword = 'Vui lòng nhập lại mật khẩu.';
    } else if (form.password !== form.confirmPassword) {
      next.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Demo: use demo-login endpoint to set cookie (real registration API TBD)
      // In production, this would POST to /api/auth/register with fullName, phoneNumber, username, password
      await fetch('/api/auth/demo-login', { method: 'POST' });
      router.push(returnTo);
      router.refresh();
    } catch {
      setServerError('Đã xảy ra lỗi. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell mode="register">
      {/* ── LEFT: Trust / value copy ──────────────────────────────────── */}
      <AuthColumn side="left" mode="register">
        <div className="flex flex-col lg:pr-8 pb-6 lg:pb-20">
          <span className="mb-3 text-[12px] font-bold uppercase tracking-[0.12em] text-[#0052FF]">
            LƯU LỘ TRÌNH CỦA EM
          </span>
          <h1 className="mb-4 text-[30px] md:text-[38px] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#091224] lg:text-[48px] max-w-[540px]">
            Lộ trình đã sẵn sàng. Tạo tài khoản để giữ lại.
          </h1>
          <p className="mb-6 text-[15px] lg:text-[17px] leading-relaxed text-slate-500 max-w-[480px]">
            Lưu tiến độ, tiếp tục trên nhiều thiết bị và nhận bài học phù hợp mỗi ngày.
          </p>

          <ul className="mb-6 flex flex-col gap-3">
            {[
              'Lưu lộ trình cá nhân hóa',
              'Đồng bộ tiến độ học tập',
              'Tiếp tục đúng bước đang học',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span className="text-[15px] font-medium text-slate-700">{item}</span>
              </li>
            ))}
          </ul>

          {/* Product preview — desktop only */}
          <RegisterPreview />
        </div>
      </AuthColumn>

      {/* ── RIGHT: Register Card ──────────────────────────────────────── */}
      <AuthColumn side="right" mode="register">
        <div className="flex w-full flex-col rounded-[20px] lg:rounded-[24px] border border-[#e8eef8] bg-white p-6 lg:p-8 shadow-[0_20px_60px_rgba(0,82,255,0.06),0_4px_12px_rgba(0,0,0,0.04)] mt-2 lg:mt-0">
          {/* Card heading */}
          <div className="mb-5">
            <h2 className="text-[24px] lg:text-[28px] font-extrabold tracking-tight text-[#091224]">
              Tạo tài khoản
            </h2>
            <p className="mt-1.5 text-[14px] font-medium text-slate-500">
              Chỉ mất chưa đầy 1 phút để bắt đầu lộ trình của em.
            </p>
          </div>

          {/* Server error banner */}
          {serverError && (
            <div className="mb-4 rounded-[10px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
            {/* 1. Họ và tên */}
            <AuthFormField
              id="reg-full-name"
              label="Họ và tên"
              type="text"
              placeholder="Nguyễn Văn Minh"
              autoComplete="name"
              value={form.fullName}
              onChange={update('fullName')}
              error={errors.fullName}
              required
            />

            {/* 2. Số điện thoại */}
            <AuthFormField
              id="reg-phone"
              label="Số điện thoại"
              type="tel"
              placeholder="09xxxxxxxx"
              autoComplete="tel"
              value={form.phoneNumber}
              onChange={update('phoneNumber')}
              error={errors.phoneNumber}
              required
            />

            {/* 3. Tên đăng nhập */}
            <AuthFormField
              id="reg-username"
              label="Tên đăng nhập"
              type="text"
              placeholder="minhdat12"
              autoComplete="username"
              value={form.username}
              onChange={update('username')}
              error={errors.username}
              supportingText="Dùng để đăng nhập vào Tú Tài."
              required
            />

            {/* 4. Mật khẩu */}
            <AuthFormField
              id="reg-password"
              label="Mật khẩu"
              type="password"
              placeholder="Tạo mật khẩu"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              error={errors.password}
              showPasswordToggle
              supportingText={!errors.password ? 'Tối thiểu 8 ký tự.' : undefined}
              required
            />

            {/* 5. Nhập lại mật khẩu */}
            <AuthFormField
              id="reg-confirm-password"
              label="Nhập lại mật khẩu"
              type="password"
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              error={errors.confirmPassword}
              showPasswordToggle
              required
            />

            {/* Primary CTA */}
            <button
              id="register-submit"
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#0052FF] text-[15px] font-bold text-white shadow-[0_4px_16px_rgba(0,82,255,0.25)] transition-all hover:bg-[#0044CC] hover:shadow-[0_8px_24px_rgba(0,82,255,0.35)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang tạo tài khoản...</span>
                </>
              ) : (
                'Tạo tài khoản & bắt đầu →'
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-5 text-center text-[13px] font-medium text-slate-500">
            Đã có tài khoản?{' '}
            <Link
              href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
              className="font-semibold text-[#0052FF] hover:underline"
            >
              Đăng nhập
            </Link>
          </p>

          {/* Legal */}
          <p className="mt-4 text-center text-[11px] font-medium leading-relaxed text-slate-400">
            Bằng việc tiếp tục, em đồng ý với{' '}
            <Link href="#" className="underline hover:text-slate-600">
              Điều khoản sử dụng
            </Link>{' '}
            và{' '}
            <Link href="#" className="underline hover:text-slate-600">
              Chính sách bảo mật
            </Link>
            .
          </p>
        </div>
      </AuthColumn>
    </AuthShell>
  );
}
