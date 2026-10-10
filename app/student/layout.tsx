import * as React from 'react';
import { redirect } from 'next/navigation';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getAuthSession } from '@/lib/auth/session';
import { lifecycleDestination, resolveAndEnsureStudentLifecycle } from '@/lib/student/lifecycle';
import { resolveStudentShellModel } from '@/lib/student/student-service';
import { StudentShell } from '@/components/student/student-shell';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const authSession = await getAuthSession();
  if (!authSession) redirect('/auth/login');
  const lifecycle = await resolveAndEnsureStudentLifecycle(authSession);
  if (lifecycle.state !== 'AUTHENTICATED_ACTIVE_STUDENT') {
    redirect(lifecycleDestination(lifecycle.state));
  }
  const session = await getDemoStudentSession();

  if (!session) redirect('/auth/login');

  const shellModel = resolveStudentShellModel(session);

  return <StudentShell model={shellModel}>{children}</StudentShell>;
}
