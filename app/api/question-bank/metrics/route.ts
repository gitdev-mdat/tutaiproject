import { NextResponse } from 'next/server';
import { getMetrics } from '@/lib/question-bank/qb-storage';
import { adminApiGuard } from '@/lib/auth/admin';

export async function GET() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const metrics = await getMetrics();
    return NextResponse.json(metrics);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
