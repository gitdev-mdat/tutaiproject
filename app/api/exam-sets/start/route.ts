import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { safeReturnPath } from '@/lib/auth/safe-return-path';
import { CURRICULUM_EXAM_SETS } from '@/lib/exam-sets/curriculum-data';
import {
  FREE_DAILY_EXAM_LIMIT,
  parseDailyExamUsage,
  recordExamStart,
  serializeDailyExamUsage,
} from '@/lib/exam-sets/free-usage';

const USAGE_COOKIE_NAME = 'tutai_daily_exam_usage';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    slug?: unknown;
    source?: unknown;
    restart?: unknown;
    mode?: unknown;
  } | null;
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const examSet = CURRICULUM_EXAM_SETS.find((item) => item.slug === slug);

  if (!examSet) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Không tìm thấy bộ đề.' },
      { status: 404 }
    );
  }

  const source = safeReturnPath(body?.source, '/exam-sets');
  const modeParam = typeof body?.mode === 'string' ? `&mode=${encodeURIComponent(body.mode)}` : '';
  const practicePath = `/exam-sets/${examSet.slug}/practice?source=${encodeURIComponent(source)}${
    body?.restart === true ? '&restart=1' : ''
  }${modeParam}`;
  const session = await getDemoStudentSession();

  if (!session) {
    const loginUrl = `/auth/login?intent=practice&exam=${encodeURIComponent(
      examSet.slug
    )}&source=${encodeURIComponent(source)}&returnTo=${encodeURIComponent(practicePath)}`;
    return NextResponse.json({ code: 'AUTH_REQUIRED', loginUrl }, { status: 401 });
  }

  // The demo student is a free account. This branch becomes an entitlement
  // lookup when subscriptions are connected.
  const hasPlus = false;
  if (examSet.tier === 'SPECIAL' && !hasPlus) {
    return NextResponse.json({ code: 'PLUS_REQUIRED' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const currentUsage = parseDailyExamUsage(cookieStore.get(USAGE_COOKIE_NAME)?.value);
  const next = recordExamStart(currentUsage, examSet.id);

  if (next.limitReached) {
    return NextResponse.json(
      { code: 'FREE_LIMIT_REACHED', dailyLimit: FREE_DAILY_EXAM_LIMIT },
      { status: 429 }
    );
  }

  cookieStore.set(USAGE_COOKIE_NAME, serializeDailyExamUsage(next.usage), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 2,
  });

  return NextResponse.json({
    code: 'START',
    destination: practicePath,
    resumeQuestion: body?.restart === true ? 1 : (examSet.resumeQuestion ?? 1),
  });
}
