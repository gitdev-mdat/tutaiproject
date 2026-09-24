import {
  getOrderByCode,
  updateOrderStatus,
  getSubscriptionByUserId,
  upsertSubscription,
} from '../db/payment-db';
import { PLUS_PLANS, PlusSubscription } from '../db/payment-types';

export async function hasActivePlus(userId: string): Promise<boolean> {
  const sub = await getSubscriptionByUserId(userId);
  if (!sub || sub.status !== 'ACTIVE') return false;

  const now = new Date();
  const endsAt = new Date(sub.endsAt);
  return endsAt > now;
}

export async function adminConfirmPayment(orderCode: string, adminId: string): Promise<void> {
  // STUB: Verify adminId actually belongs to an admin role in a real system
  if (!adminId) throw new Error('Unauthorized: Admin only');

  const order = await getOrderByCode(orderCode);
  if (!order) throw new Error('Order not found');

  if (order.status === 'PAID') {
    // Idempotent: already paid, do nothing
    return;
  }

  if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PAYMENT_REVIEW') {
    throw new Error('Chỉ có thể xác nhận giao dịch đang chờ xử lý');
  }

  // 1. Mark order as PAID
  const now = new Date();
  await updateOrderStatus(orderCode, 'PAID', {
    paidAt: now.toISOString(),
    approvedBy: adminId,
  });

  // 2. Calculate new Plus access
  const plan = PLUS_PLANS[order.planId];
  if (!plan) throw new Error('Invalid plan on order');

  // Month addition based on calendar (approximated logically)
  const existingSub = await getSubscriptionByUserId(order.userId);

  let startsAt = now;
  let endsAt = new Date(now);
  endsAt.setMonth(endsAt.getMonth() + plan.durationMonths);

  if (existingSub && existingSub.status === 'ACTIVE') {
    const existingEndsAt = new Date(existingSub.endsAt);
    if (existingEndsAt > now) {
      // Extend from existing end date
      startsAt = new Date(existingSub.startsAt);
      endsAt = new Date(existingEndsAt);
      endsAt.setMonth(endsAt.getMonth() + plan.durationMonths);
    }
  }

  // 3. Upsert subscription
  const newSub: PlusSubscription = {
    userId: order.userId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: 'ACTIVE',
    updatedAt: now.toISOString(),
  };

  await upsertSubscription(newSub);
}

export async function adminRejectPayment(
  orderCode: string,
  adminId: string,
  reason: string
): Promise<void> {
  if (!adminId) throw new Error('Unauthorized: Admin only');

  const order = await getOrderByCode(orderCode);
  if (!order) throw new Error('Order not found');

  if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PAYMENT_REVIEW') {
    throw new Error('Chỉ có thể từ chối giao dịch đang chờ xử lý');
  }

  const now = new Date();
  await updateOrderStatus(orderCode, 'REJECTED', {
    rejectedAt: now.toISOString(),
    rejectedBy: adminId,
    rejectionReason: reason,
  });
}

export async function adminCancelPayment(orderCode: string, adminId: string): Promise<void> {
  if (!adminId) throw new Error('Unauthorized: Admin only');

  const order = await getOrderByCode(orderCode);
  if (!order) throw new Error('Order not found');

  if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PAYMENT_REVIEW') {
    throw new Error('Chỉ có thể hủy giao dịch đang chờ xử lý');
  }

  const now = new Date();
  await updateOrderStatus(orderCode, 'CANCELLED', {
    cancelledAt: now.toISOString(),
    cancelledBy: adminId,
  });
}

export async function adminReopenPayment(orderCode: string, adminId: string): Promise<void> {
  if (!adminId) throw new Error('Unauthorized: Admin only');

  const order = await getOrderByCode(orderCode);
  if (!order) throw new Error('Order not found');

  if (order.status !== 'REJECTED') {
    throw new Error('Chỉ có thể mở lại giao dịch đã bị từ chối');
  }

  await updateOrderStatus(orderCode, 'PAYMENT_REVIEW');
}
