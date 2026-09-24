'use server';

import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { updateOrderStatus, getOrderByCode } from '@/lib/db/payment-db';

export async function markPaymentUnderReviewAction(orderCode: string) {
  const session = await getDemoStudentSession();
  if (!session) throw new Error('Unauthorized');

  const order = await getOrderByCode(orderCode);
  if (!order || order.userId !== session.id) throw new Error('Not found');

  if (order.status === 'PENDING_PAYMENT') {
    await updateOrderStatus(orderCode, 'PAYMENT_REVIEW');
  }
}
