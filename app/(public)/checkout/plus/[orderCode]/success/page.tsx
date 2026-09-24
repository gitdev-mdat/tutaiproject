import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getOrderByCode, getSubscriptionByUserId } from '@/lib/db/payment-db';
import { redirect } from 'next/navigation';
import { PLUS_PLANS } from '@/lib/db/payment-types';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';

const SUCCESS_BENEFITS = [
  'Phân tích sâu lỗi sai',
  'Lộ trình tự điều chỉnh',
  'Nội dung Plus',
  'Đấu trường Tú Tài',
];

export default async function SuccessPage({
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

  if (!order || order.userId !== session.id || order.status !== 'PAID') {
    redirect('/pricing');
  }

  const plan = PLUS_PLANS[order.planId];
  const subscription = await getSubscriptionByUserId(session.id);

  if (!subscription || subscription.status !== 'ACTIVE') {
    // Should not happen if confirmPlusPayment was successful, but just in case
    redirect(`/checkout/plus/${orderCode}`);
  }

  const endsAtFormatted = new Date(subscription.endsAt).toLocaleDateString('vi-VN');

  return (
    <div className="max-w-xl mx-auto mt-8">
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 overflow-hidden text-center p-10">
        <div className="w-16 h-16 bg-[#08a985]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#08a985]">
          <Check size={32} strokeWidth={3} />
        </div>

        <h1 className="text-3xl font-extrabold text-[#0a1628] mb-2">Tú Tài Plus đã được mở</h1>
        <p className="text-gray-500 mb-8">Quyền truy cập của em đã được nâng cấp thành công.</p>

        <div className="bg-[#f8fbff] border border-[#e8f1ff] rounded-xl p-6 mb-8 text-left">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-1.5 text-[#0052ff] font-bold text-lg mb-1">
                Tú Tài Plus <Sparkles size={16} />
              </div>
              <div className="text-sm text-gray-500">{plan.durationMonths} tháng truy cập</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Hiệu lực đến</div>
              <div className="font-bold text-[#08a985] text-lg">{endsAtFormatted}</div>
            </div>
          </div>

          <div className="h-px bg-[#e8f1ff] w-full my-4"></div>

          <ul className="space-y-3">
            {SUCCESS_BENEFITS.map((benefit, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm font-medium text-[#0a1628]">
                <Check size={16} className="text-[#08a985]" strokeWidth={3} />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={returnUrl || '/student/dashboard'}
            className="w-full bg-[#0052ff] hover:bg-[#0047df] text-white font-bold py-4 rounded-xl transition-colors inline-block"
          >
            {returnUrl ? 'Quay lại cuộc thi' : 'Bắt đầu với Plus'}
          </Link>

          <Link
            href="/account/billing"
            className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3.5 rounded-xl transition-colors inline-block text-sm"
          >
            Về trang cá nhân
          </Link>
        </div>
      </div>
    </div>
  );
}
