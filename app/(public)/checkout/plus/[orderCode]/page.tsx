import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getOrderByCode } from '@/lib/db/payment-db';
import { redirect } from 'next/navigation';
import { OrderClient } from './order-client';

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderCode: string }>;
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const session = await getDemoStudentSession();
  if (!session) {
    redirect('/auth/login');
  }

  const { orderCode } = await params;
  const { returnUrl } = await searchParams;
  const order = await getOrderByCode(orderCode);

  if (!order || order.userId !== session.id) {
    redirect('/pricing');
  }

  // If already paid, redirect to success
  if (order.status === 'PAID') {
    const returnUrlParam = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    redirect(`/checkout/plus/${orderCode}/success${returnUrlParam}`);
  }

  return <OrderClient order={order} />;
}
