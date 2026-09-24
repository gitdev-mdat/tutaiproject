import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getSubscriptionByUserId, getOrdersByUserId } from '@/lib/db/payment-db';
import { redirect } from 'next/navigation';
import { PlusOrder } from '@/lib/db/payment-types';
import Link from 'next/link';

export default async function BillingPage() {
  const session = await getDemoStudentSession();
  if (!session) {
    redirect('/auth/login');
  }

  const subscription = await getSubscriptionByUserId(session.id);
  const orders = await getOrdersByUserId(session.id);

  const now = new Date();
  const isActive =
    subscription && subscription.status === 'ACTIVE' && new Date(subscription.endsAt) > now;

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0a1628]">Gói & thanh toán</h1>
        <Link
          href="/pricing"
          className="text-sm font-bold text-[#0052ff] bg-[#f2f8ff] px-4 py-2 rounded-lg hover:bg-[#e6f0ff] transition-colors"
        >
          Xem bảng giá
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Col: Current Subscription */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 p-6 sticky top-24">
            <h2 className="text-sm font-bold text-gray-400 tracking-wider mb-4">GÓI HIỆN TẠI</h2>

            {isActive ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xl font-bold text-[#0a1628]">Tú Tài Plus</div>
                  <div className="bg-[#e4f3ed] text-[#08a985] text-xs font-bold px-2 py-0.5 rounded-full">
                    Đang hoạt động
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-6">
                  Hết hạn:{' '}
                  <span className="font-semibold text-[#0a1628]">
                    {new Date(subscription.endsAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <Link
                  href="/pricing"
                  className="block text-center w-full bg-[#0052ff] hover:bg-[#0047df] text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  Gia hạn Plus
                </Link>
              </>
            ) : (
              <>
                <div className="text-xl font-bold text-[#0a1628] mb-2">Tú Tài Free</div>
                <div className="text-sm text-gray-500 mb-6">
                  Đủ để em bắt đầu học nghiêm túc mỗi ngày.
                </div>

                <Link
                  href="/pricing"
                  className="block text-center w-full bg-[#0052ff] hover:bg-[#0047df] text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  Nâng cấp Tú Tài Plus
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Right Col: Order History */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 p-6">
            <h2 className="text-sm font-bold text-gray-400 tracking-wider mb-6">
              LỊCH SỬ GIAO DỊCH
            </h2>

            {orders.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Chưa có giao dịch nào</div>
            ) : (
              <div className="flex flex-col gap-4">
                {orders.map((order: PlusOrder) => (
                  <div
                    key={order.id}
                    className="flex justify-between items-center p-4 border rounded-xl border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-[#0a1628]">{order.code}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-[#0a1628]">
                        {order.amount.toLocaleString('vi-VN')}đ
                      </div>
                      <div className="mt-1">
                        {order.status === 'PAID' && (
                          <span className="text-[#08a985] text-xs font-bold bg-[#e4f3ed] px-2 py-0.5 rounded-full">
                            Đã thanh toán
                          </span>
                        )}
                        {order.status === 'PENDING_PAYMENT' && (
                          <span className="text-[#d97706] text-xs font-bold bg-[#fef3c7] px-2 py-0.5 rounded-full">
                            Chờ thanh toán
                          </span>
                        )}
                        {order.status === 'PAYMENT_REVIEW' && (
                          <span className="text-[#0052ff] text-xs font-bold bg-[#eef4fc] px-2 py-0.5 rounded-full">
                            Đang xác nhận
                          </span>
                        )}
                        {order.status === 'EXPIRED' && (
                          <span className="text-gray-500 text-xs font-bold bg-gray-100 px-2 py-0.5 rounded-full">
                            Đã hủy
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
