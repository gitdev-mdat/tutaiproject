'use client';

import * as React from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [resetUrl, setResetUrl] = React.useState('');
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setResetUrl('');
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await response.json();
      setMessage(data.message);
      setResetUrl(data.resetUrl ?? '');
    } catch {
      setMessage('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    }
    setPending(false);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-extrabold">Quên mật khẩu?</h1>
        <p className="mt-2 text-sm text-slate-500">Nhập tên đăng nhập hoặc email đã đăng ký.</p>
        {message && (
          <div role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            {message}
            {resetUrl && (
              <Link className="mt-2 block font-bold underline" href={resetUrl}>
                Mở liên kết đặt lại (môi trường phát triển)
              </Link>
            )}
          </div>
        )}
        <form onSubmit={submit} className="mt-6">
          <label className="text-sm font-semibold">
            Tên đăng nhập hoặc email
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3"
            />
          </label>
          <button
            disabled={pending}
            className="mt-4 h-12 w-full rounded-xl bg-[#0052FF] font-bold text-white disabled:opacity-60"
          >
            {pending ? 'Đang gửi…' : 'Gửi hướng dẫn'}
          </button>
        </form>
        <Link
          href="/auth/login"
          className="mt-5 block text-center text-sm font-semibold text-[#0052FF]"
        >
          Quay lại đăng nhập
        </Link>
      </div>
    </main>
  );
}
