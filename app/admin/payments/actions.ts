'use server';

import { getDemoStudentSession } from '@/lib/auth/demo-session';
import {
  adminConfirmPayment,
  adminRejectPayment,
  adminCancelPayment,
  adminReopenPayment,
} from '@/lib/auth/entitlements';
import { revalidatePath } from 'next/cache';

export async function adminConfirmPaymentAction(orderCode: string) {
  const session = await getDemoStudentSession();

  // Note: in a real application, check for ADMIN role.
  // For demo purposes, we'll allow any logged in session to act as admin here
  // or hardcode a check if there's a specific admin user.
  if (!session) {
    throw new Error('Unauthorized');
  }

  await adminConfirmPayment(orderCode, session.id);

  revalidatePath('/admin/payments');
}

export async function adminRejectPaymentAction(orderCode: string, reason: string) {
  const session = await getDemoStudentSession();
  if (!session) throw new Error('Unauthorized');
  await adminRejectPayment(orderCode, session.id, reason);
  revalidatePath('/admin/payments');
}

export async function adminCancelPaymentAction(orderCode: string) {
  const session = await getDemoStudentSession();
  if (!session) throw new Error('Unauthorized');
  await adminCancelPayment(orderCode, session.id);
  revalidatePath('/admin/payments');
}

export async function adminReopenPaymentAction(orderCode: string) {
  const session = await getDemoStudentSession();
  if (!session) throw new Error('Unauthorized');
  await adminReopenPayment(orderCode, session.id);
  revalidatePath('/admin/payments');
}
