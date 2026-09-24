import type { Metadata } from 'next';
import { KnowledgeTreeManager } from '@/components/admin/knowledge-tree/knowledge-tree-manager';

export const metadata: Metadata = {
  title: 'Chương trình & Kiến thức | Tú Tài Admin',
  description: 'Quản lý cấu trúc chương trình theo môn học và khối lớp.',
};

export default function KnowledgeAdminPage() {
  return <KnowledgeTreeManager />;
}
