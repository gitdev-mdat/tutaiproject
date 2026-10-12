import * as React from 'react';
import { redirect } from 'next/navigation';
import { getAdminAccess } from '@/lib/auth/admin';
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
  // The shortcut is only a link: /admin checks access again on every request.
  const canAdmin = (await getAdminAccess()).allowed;

  return (
    <StudentShell model={shellModel} canAdmin={canAdmin}>
      {children}
    </StudentShell>
  );
}
