import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { redirect } from 'next/navigation';
import { CheckoutClient } from './checkout-client';
import { getSubscriptionByUserId } from '@/lib/db/payment-db';

export default async function CheckoutPlusPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; returnUrl?: string }>;
}) {
  const session = await getDemoStudentSession();
  const params = await searchParams;
  const returnUrlParam = params.returnUrl
    ? `&returnUrl=${encodeURIComponent(params.returnUrl)}`
    : '';
  const planParam = params.plan || 'PLUS_6M';

  if (!session) {
    redirect(
      `/auth/login?returnUrl=${encodeURIComponent(`/checkout/plus?plan=${planParam}${returnUrlParam}`)}`
    );
  }

  // Get current subscription to calculate "Dự kiến"
  const existingSub = await getSubscriptionByUserId(session.id);

  return <CheckoutClient planParam={planParam} existingSub={existingSub} />;
}
