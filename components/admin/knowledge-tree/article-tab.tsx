'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type {
  KnowledgeArticle,
  KnowledgeArticleBlock,
} from '@/lib/knowledge-tree/knowledge-tree-types';
import { Save, Eye } from 'lucide-react';

interface ArticleTabProps {
  hasLearningContent: boolean;
  onEnableContent: () => void;
  article: KnowledgeArticle | null;
  onSaveArticle: (article: Partial<KnowledgeArticle>) => Promise<void>;
}

const BLOCK_LABELS: Record<string, string> = {
  TITLE: 'Tiêu đề',
  INTRO: 'Mở đầu (Đây là gì?)',
  OBJECTIVE: 'Mục tiêu (Học sinh cần hiểu gì?)',
  MAIN_CONTENT: 'Nội dung chính (Giải thích rõ ràng)',
  EXAMPLE: 'Ví dụ dễ hiểu',
  RECAP: 'Ghi nhớ nhanh',
  COMMON_MISTAKE: 'Lỗi hay gặp',
  REFERENCES: 'Nguồn tham khảo',
};

export function ArticleTab({
  hasLearningContent,
  onEnableContent,
  article,
  onSaveArticle,
}: ArticleTabProps) {
  const [blocks, setBlocks] = React.useState<KnowledgeArticleBlock[]>([]);
  const [title, setTitle] = React.useState('');
  const [publishToBlog, setPublishToBlog] = React.useState(false);
  const [publishToLearning, setPublishToLearning] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState(false);

  const [prevArticle, setPrevArticle] = React.useState(article);
  if (article !== prevArticle) {
    setPrevArticle(article);
    if (article) {
      setTitle(article.title);
      setBlocks(article.blocks);
      setPublishToBlog(article.publishToBlog);
      setPublishToLearning(article.publishToLearning);
    }
  }

  if (!hasLearningContent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <h3 className="text-base font-semibold text-slate-900">Chưa có nội dung học</h3>
        <p className="mt-1 max-w-md text-sm text-slate-500 mb-6">
          Soạn nội dung cho mục kiến thức này.
        </p>
        <Button onClick={onEnableContent}>Tạo nội dung</Button>
      </div>
    );
  }

  if (!article) return <div className="p-6">Đang tải nội dung...</div>;

  const handleBlockChange = (id: string, content: string) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSaveArticle({
        title,
        blocks,
        publishToBlog,
        publishToLearning,
        status: publishToBlog || publishToLearning ? 'PUBLISHED' : 'DRAFT',
      });
    } finally {
      setSaving(false);
    }
  };

  if (previewMode) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="font-semibold">Chế độ xem trước</div>
          <Button variant="outline" size="sm" onClick={() => setPreviewMode(false)}>
            Đóng xem trước
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
            <h1 className="mb-6 text-3xl font-bold">{title}</h1>
            {blocks
              .filter((b) => b.type !== 'TITLE')
              .map((block) =>
                block.content.trim() ? (
                  <div key={block.id} className="mb-8">
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
                      {BLOCK_LABELS[block.type]}
                    </h3>
                    <div className="prose max-w-none text-slate-700 whitespace-pre-wrap">
                      {block.content}
                    </div>
                  </div>
                ) : null
              )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-md bg-slate-100 p-1">
            <Button
              variant={publishToLearning ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPublishToLearning(!publishToLearning)}
            >
              Chương trình học
            </Button>
            <Button
              variant={publishToBlog ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPublishToBlog(!publishToBlog)}
            >
              Blog
            </Button>
          </div>
          <span className="text-sm text-slate-500">
            {publishToBlog || publishToLearning ? 'Sẽ được xuất bản' : 'Bản nháp'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewMode(true)}>
            <Eye className="mr-2 size-4" /> Xem trước
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="mr-2 size-4" /> {saving ? 'Đang lưu...' : 'Lưu lại'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề bài viết..."
              className="w-full text-2xl font-bold focus:outline-none placeholder:text-slate-300"
            />
          </div>

          {blocks
            .filter((b) => b.type !== 'TITLE')
            .map((block) => (
              <div
                key={block.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100"
              >
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 rounded-t-xl">
                  {BLOCK_LABELS[block.type]}
                </div>
                <Textarea
                  value={block.content}
                  onChange={(e) => handleBlockChange(block.id, e.target.value)}
                  placeholder={`Nhập nội dung cho phần ${BLOCK_LABELS[block.type].toLowerCase()}...`}
                  className="min-h-[100px] w-full resize-y border-0 bg-transparent p-4 focus-visible:ring-0"
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
