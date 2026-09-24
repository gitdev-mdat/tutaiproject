import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getAllOrders } from '@/lib/db/payment-db';
import { redirect } from 'next/navigation';
import { PaymentAdminClient } from './payment-admin-client';

export default async function AdminPaymentsPage() {
  const session = await getDemoStudentSession();

  if (!session) {
    redirect('/auth/login');
  }

  // Fetch all orders
  const orders = await getAllOrders();

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#0a1628] mb-2">Quản lý giao dịch</h1>
        <p className="text-gray-500">
          Phê duyệt và kiểm tra các giao dịch thanh toán nâng cấp Plus.
        </p>
      </div>

      <PaymentAdminClient initialOrders={orders} />
    </div>
  );
}
