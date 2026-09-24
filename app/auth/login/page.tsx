'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { AuthShell, AuthColumn } from '@/components/auth/auth-shell';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { LoginDashboardPreview } from '@/components/auth/login-dashboard-preview';
import { safeReturnPath } from '@/lib/auth/safe-return-path';

// ─── Login Page ─────────────────────────────────────────────────────────────
// Route: /auth/login
// The login card must be the visual focus — no marketing content.
// ─────────────────────────────────────────────────────────────────────────────

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPracticeIntent = searchParams.get('intent') === 'practice';
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const practiceExam = searchParams.get('exam');
  const practiceSource = safeReturnPath(searchParams.get('source'), '/exam-sets');

  React.useEffect(() => {
    let active = true;

    fetch('/api/auth/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((session) => {
        if (!active || !(session?.authenticated || session?.user)) return;
        router.replace(returnTo);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [router, returnTo]);

  // Form state
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [rememberMe, setRememberMe] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState('');

  // Inline field errors
  const [errors, setErrors] = React.useState<{ username?: string; password?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!username.trim()) next.username = 'Vui lòng nhập tên đăng nhập.';
    if (!password) next.password = 'Vui lòng nhập mật khẩu.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password, returnTo }),
      });
      const data = await res.json();

      if (data.success) {
        if (isPracticeIntent && practiceExam) {
          const startResponse = await fetch('/api/exam-sets/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: practiceExam, source: practiceSource }),
          });
          const startData = (await startResponse.json()) as {
            code?: string;
            destination?: string;
          };

          if (startData.code === 'START' && startData.destination) {
            router.push(startData.destination);
            router.refresh();
            return;
          }

          if (startData.code === 'FREE_LIMIT_REACHED') {
            const sourceUrl = new URL(practiceSource, window.location.origin);
            sourceUrl.searchParams.set('notice', 'free-limit');
            router.push(`${sourceUrl.pathname}${sourceUrl.search}`);
            router.refresh();
            return;
          }
        }

        router.push(data.redirectTo ?? '/student/dashboard');
        router.refresh();
      } else {
        setServerError(data.message ?? 'Tên đăng nhập hoặc mật khẩu không đúng.');
        setIsSubmitting(false);
      }
    } catch {
      setServerError('Đã xảy ra lỗi. Vui lòng thử lại.');
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell mode="login">
      {/* ── LEFT: Trust / welcome copy ─────────────────────────────────── */}
      <AuthColumn side="left" mode="login">
        <div className="flex flex-col lg:pr-6 pb-6 lg:pb-0">
          <span className="mb-3 text-[13px] font-bold uppercase tracking-[0.1em] text-[#0052FF]">
            CHÀO MỪNG EM TRỞ LẠI
          </span>
          <h1 className="mb-3 max-w-[500px] text-[32px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#091224] lg:text-[40px]">
            Học tiếp đúng chỗ em đã dừng.
          </h1>
          <p className="mb-6 max-w-[480px] text-[16px] leading-7 text-slate-600">
            Đăng nhập để xem giai đoạn hiện tại, bài được đề xuất và lý do phù hợp với kết quả học
            của em.
          </p>

          {/* Product context — desktop only */}
          <LoginDashboardPreview />
        </div>
      </AuthColumn>

      {/* ── RIGHT: Login Card ─────────────────────────────────────────── */}
      <AuthColumn side="right" mode="login">
        <div className="flex w-full flex-col rounded-[20px] lg:rounded-[24px] border border-[#e8eef8] bg-white p-6 lg:p-8 shadow-[0_20px_60px_rgba(0,82,255,0.06),0_4px_12px_rgba(0,0,0,0.04)]">
          {/* Card heading */}
          <div className="mb-6">
            <h2 className="text-[26px] lg:text-[30px] font-extrabold tracking-tight text-[#091224]">
              Đăng nhập
            </h2>
            <p className="mt-1.5 text-[15px] font-medium text-slate-500">
              {isPracticeIntent
                ? 'Đăng nhập để bắt đầu làm bài và lưu toàn bộ kết quả của em.'
                : 'Tiếp tục lộ trình học của em.'}
            </p>
          </div>

          {isPracticeIntent && (
            <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-blue-100 bg-[#F3F7FF] px-4 py-3.5 text-[#21466F]">
              <LockKeyhole
                className="mt-0.5 shrink-0 text-[#1768FF]"
                size={17}
                aria-hidden="true"
              />
              <p className="text-[13px] font-medium leading-relaxed">
                Sau khi đăng nhập, em sẽ được đưa thẳng vào bộ đề vừa chọn.
              </p>
            </div>
          )}

          {/* Server error banner */}
          {serverError && (
            <div className="mb-4 rounded-[10px] border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* Username field */}
            <AuthFormField
              id="login-username"
              label="Tên đăng nhập"
              type="text"
              placeholder="Nhập tên đăng nhập"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              }}
              error={errors.username}
              required
            />

            {/* Password field */}
            <AuthFormField
              id="login-password"
              label="Mật khẩu"
              type="password"
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              error={errors.password}
              showPasswordToggle
              required
            />

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 select-none">
                <input
                  id="login-remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0052FF] accent-[#0052FF]"
                />
                <span className="text-[14px] font-medium text-slate-700">Nhớ đăng nhập</span>
              </label>
              <Link
                href="/auth/forgot-password"
                className="min-h-11 px-2 -mr-2 inline-flex items-center text-[14px] font-semibold text-[#0052FF] hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {/* Primary CTA */}
            <button
              id="login-submit"
              type="submit"
              disabled={isSubmitting}
              className="mt-1 flex h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#0052FF] text-[15px] font-bold text-white shadow-[0_4px_16px_rgba(0,82,255,0.25)] transition-all hover:bg-[#0044CC] hover:shadow-[0_8px_24px_rgba(0,82,255,0.35)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                'Đăng nhập →'
              )}
            </button>
          </form>

          {/* Register link below CTA */}
          <p className="mt-5 text-center text-[14px] font-medium text-slate-600">
            Chưa có tài khoản?{' '}
            <Link
              href={
                isPracticeIntent
                  ? `/auth/register?intent=practice&returnTo=${encodeURIComponent(returnTo)}`
                  : `/auth/register?returnTo=${encodeURIComponent(returnTo)}`
              }
              className="font-semibold text-[#0052FF] hover:underline"
            >
              Đăng ký miễn phí
            </Link>
          </p>
        </div>
      </AuthColumn>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
          Đang chuẩn bị trang đăng nhập…
        </div>
      }
    >
      <LoginPageContent />
    </React.Suspense>
  );
}
