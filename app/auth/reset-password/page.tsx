'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ResetPasswordContent() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json();
    setSuccess(response.ok);
    setMessage(
      response.ok
        ? 'Mật khẩu đã được cập nhật. Các phiên đăng nhập cũ đã bị thu hồi.'
        : data.message
    );
  }
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-extrabold">Đặt mật khẩu mới</h1>
        {message && (
          <div
            role="status"
            className={`mt-5 rounded-xl p-4 text-sm ${success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
          >
            {message}
          </div>
        )}
        {success ? (
          <Link href="/auth/login" className="mt-5 block text-center font-bold text-[#0052FF]">
            Đăng nhập
          </Link>
        ) : (
          <form onSubmit={submit} className="mt-6">
            <label className="text-sm font-semibold">
              Mật khẩu mới
              <input
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3"
              />
            </label>
            <button className="mt-4 h-12 w-full rounded-xl bg-[#0052FF] font-bold text-white">
              Cập nhật mật khẩu
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordContent />
    </React.Suspense>
  );
}
