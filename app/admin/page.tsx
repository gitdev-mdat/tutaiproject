import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { getAllOrders } from '@/lib/db/payment-db';

export const metadata: Metadata = {
  title: 'Tổng quan | Admin',
  description: 'Theo dõi nội dung, vận hành và những việc cần xử lý trên Tú Tài.',
};

export default async function AdminHomePage() {
  const tree = await readKnowledgeTree();
  const orders = await getAllOrders();

  const pendingCount = orders.filter((o) => o.status === 'PAYMENT_REVIEW').length;

  return (
    <AdminDashboard
      metrics={{
        knowledgeCount: tree.nodes.filter(
          (node) => node.kind === 'KNOWLEDGE' && node.status !== 'ARCHIVED'
        ).length,
        questionCount: 2648,
        examCount: 42,
        studentCount: 326,
        pendingReviewCount: pendingCount,
      }}
    />
  );
}
