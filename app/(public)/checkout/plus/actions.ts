'use server';

import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { createOrder, updateOrderStatus } from '@/lib/db/payment-db';
import { PLUS_PLANS, PaymentMethod } from '@/lib/db/payment-types';
import { redirect } from 'next/navigation';

export async function createCheckoutOrderAction(
  planId: string,
  method: PaymentMethod,
  returnUrl?: string
) {
  const session = await getDemoStudentSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const plan = PLUS_PLANS[planId];
  if (!plan) {
    throw new Error('Invalid plan');
  }

  // Authoritative server calculation of price
  const order = await createOrder(session.id, planId, plan.price, method);

  // Since QR is on the first page, clicking "Tôi đã thanh toán" means they transferred.
  await updateOrderStatus(order.code, 'PAYMENT_REVIEW');

  // Store returnUrl in session/cookies if we wanted, or just pass via query string.
  const returnUrlParam = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';

  redirect(`/checkout/plus/${order.code}${returnUrlParam}`);
}
