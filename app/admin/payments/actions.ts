'use server';

import { requireAdmin } from '@/lib/auth/admin';
import {
  adminConfirmPayment,
  adminRejectPayment,
  adminCancelPayment,
  adminReopenPayment,
} from '@/lib/auth/entitlements';
import { revalidatePath } from 'next/cache';

export async function adminConfirmPaymentAction(orderCode: string) {
  const adminId = await requireAdmin();
  await adminConfirmPayment(orderCode, adminId);

  revalidatePath('/admin/payments');
}

export async function adminRejectPaymentAction(orderCode: string, reason: string) {
  const adminId = await requireAdmin();
  await adminRejectPayment(orderCode, adminId, reason);
  revalidatePath('/admin/payments');
}

export async function adminCancelPaymentAction(orderCode: string) {
  const adminId = await requireAdmin();
  await adminCancelPayment(orderCode, adminId);
  revalidatePath('/admin/payments');
}

export async function adminReopenPaymentAction(orderCode: string) {
  const adminId = await requireAdmin();
  await adminReopenPayment(orderCode, adminId);
  revalidatePath('/admin/payments');
}
