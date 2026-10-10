import { NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/auth/auth-service';

export async function POST(request: Request) {
  const body = (await request.json()) as { identifier?: string };
  const token = await requestPasswordReset(body.identifier ?? '');
  const response: { success: true; message: string; resetUrl?: string } = {
    success: true,
    message: 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi tới email đã đăng ký.',
  };
  // Local development has no mail provider. Expose the link only outside production so the lifecycle remains testable.
  if (token && process.env.NODE_ENV !== 'production')
    response.resetUrl = `/auth/reset-password?token=${encodeURIComponent(token)}`;
  return NextResponse.json(response);
}
