import * as React from 'react';
import { AdminWorkspaceShell } from '@/components/admin/admin-shell';
import { requireAdminPage } from '@/lib/auth/admin';

// Every /admin page renders inside this layout, so the server-side admin check
// here covers the whole admin area. Route Handlers check again on their own.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <AdminWorkspaceShell>{children}</AdminWorkspaceShell>;
}
