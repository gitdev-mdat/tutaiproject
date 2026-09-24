import * as React from 'react';
import { redirect } from 'next/navigation';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { resolveStudentShellModel } from '@/lib/student/student-service';
import { StudentShell } from '@/components/student/student-shell';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getDemoStudentSession();

  if (!session) {
    redirect('/auth/login');
  }

  const shellModel = resolveStudentShellModel(session);

  return <StudentShell model={shellModel}>{children}</StudentShell>;
}
