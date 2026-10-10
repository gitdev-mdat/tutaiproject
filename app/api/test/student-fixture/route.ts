import { NextResponse } from 'next/server';
import {
  assertStudentBrowserFixtureEnvironment,
  establishActiveStudentBrowserSession,
  isStudentBrowserFixtureEnabled,
  redactStudentFixtureError,
  StudentFixtureError,
} from '@/lib/auth/student-browser-fixture';

export async function POST() {
  if (process.env.NODE_ENV && !isStudentBrowserFixtureEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    assertStudentBrowserFixtureEnvironment();
    const fixture = await establishActiveStudentBrowserSession();
    return NextResponse.json({
      ready: true,
      lifecycle: fixture.lifecycle.state,
      startPath: '/student/dashboard',
    });
  } catch (error) {
    const failure =
      error instanceof StudentFixtureError
        ? error
        : new StudentFixtureError(
            'FIXTURE_INTERNAL_ERROR',
            'unknown',
            'Unexpected student fixture failure.',
            { cause: error }
          );
    const root = failure.cause ?? failure;
    console.error(
      `[student-fixture] code=${failure.code} stage=${failure.stage} cause=${redactStudentFixtureError(root)}`
    );
    return NextResponse.json(
      {
        ready: false,
        error: {
          code: failure.code,
          stage: failure.stage,
          message: failure.message,
        },
      },
      { status: 503 }
    );
  }
}
