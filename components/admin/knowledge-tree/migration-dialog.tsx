'use client';

import * as React from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ApiKnowledgeRepository } from '@/lib/knowledge-tree/api-knowledge-repository';
import {
  markLocalDraftsHandled,
  migrateLocalDrafts,
  planLocalDraftMigration,
  type LocalDraftSnapshot,
} from '@/lib/knowledge-tree/local-draft-migration';
import type { KnowledgeTreeNode } from '@/lib/knowledge-tree/knowledge-tree-types';

type Outcome = 'migrated' | 'dismissed' | 'failed';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: ApiKnowledgeRepository;
  snapshot: LocalDraftSnapshot;
  serverNodes: KnowledgeTreeNode[];
  serverArticleNodeIds: ReadonlySet<string>;
  onFinished: (outcome: Outcome) => void | Promise<void>;
}

/** Explains exactly what the one-time legacy transfer will do before it runs. */
export function MigrationDialog({
  open,
  onOpenChange,
  repo,
  snapshot,
  serverNodes,
  serverArticleNodeIds,
  onFinished,
}: Props) {
  const [phase, setPhase] = React.useState<
    | { kind: 'plan' }
    | { kind: 'running' }
    | { kind: 'done'; nodes: number; articles: number; skipped: number }
    | { kind: 'failed'; message: string }
  >({ kind: 'plan' });

  const plan = React.useMemo(
    () => planLocalDraftMigration(serverNodes, snapshot, serverArticleNodeIds),
    [serverNodes, snapshot, serverArticleNodeIds]
  );

  const run = async () => {
    setPhase({ kind: 'running' });
    try {
      const result = await migrateLocalDrafts(repo, serverNodes, snapshot, serverArticleNodeIds);
      setPhase({ kind: 'done', ...result });
    } catch (error) {
      setPhase({
        kind: 'failed',
        message: error instanceof Error ? error.message : 'Không chuyển được dữ liệu.',
      });
    }
  };

  const close = (outcome?: Outcome) => {
    onOpenChange(false);
    if (outcome) void onFinished(outcome);
    setPhase({ kind: 'plan' });
  };

  const lines = [
    plan.create > 0 && `Tạo mới ${plan.create} mục trên máy chủ.`,
    plan.merge > 0 &&
      `${plan.merge} mục trùng tên với mục đã có cùng vị trí sẽ dùng mục đã có, không tạo bản trùng.`,
    plan.articles > 0 && `Chuyển ${plan.articles} bài học, tất cả ở dạng bản nháp.`,
    plan.articlesKeptOnServer > 0 &&
      `Giữ nguyên ${plan.articlesKeptOnServer} bài vì máy chủ đã có bài cho mục đó. Bản trên trình duyệt không ghi đè.`,
    plan.orphaned + plan.articlesWithoutTarget > 0 &&
      `Bỏ qua ${plan.orphaned + plan.articlesWithoutTarget} mục không còn vị trí phù hợp.`,
  ].filter(Boolean) as string[];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (phase.kind === 'running') return;
        if (!next)
          close(
            phase.kind === 'done' ? 'migrated' : phase.kind === 'failed' ? 'failed' : undefined
          );
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chuyển dữ liệu cũ lên máy chủ</DialogTitle>
          <DialogDescription className="leading-6">
            Trình duyệt này còn {snapshot.nodes.length} mục và {snapshot.articles.length} bài tạo ở
            phiên bản cũ, chỉ lưu tại đây.
          </DialogDescription>
        </DialogHeader>

        {phase.kind === 'plan' && (
          <div className="space-y-3 text-sm leading-6 text-slate-700">
            <ul className="list-disc space-y-1 pl-5">
              {lines.length ? (
                lines.map((line) => <li key={line}>{line}</li>)
              ) : (
                <li>Không có gì cần chuyển.</li>
              )}
            </ul>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
              Không bài nào được hiển thị cho học sinh. Dữ liệu trên trình duyệt được giữ nguyên.
              Nếu lỗi giữa chừng, phần đã chuyển vẫn còn và có thể chạy lại mà không tạo trùng.
            </p>
          </div>
        )}

        {phase.kind === 'running' && (
          <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang chuyển…
          </p>
        )}

        {phase.kind === 'done' && (
          <p className="flex gap-2 text-sm leading-6 text-emerald-800" role="status">
            <CheckCircle2 className="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>
              Đã tạo {phase.nodes} mục và chuyển {phase.articles} bài học dạng nháp
              {phase.skipped ? `, bỏ qua ${phase.skipped} mục` : ''}.
            </span>
          </p>
        )}

        {phase.kind === 'failed' && (
          <p className="flex gap-2 text-sm leading-6 text-red-700" role="alert">
            <XCircle className="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>{phase.message} Dữ liệu trên trình duyệt vẫn còn; có thể chạy lại sau.</span>
          </p>
        )}

        <DialogFooter>
          {phase.kind === 'plan' && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  markLocalDraftsHandled('dismissed');
                  close('dismissed');
                }}
              >
                Không chuyển
              </Button>
              <Button variant="outline" onClick={() => close()}>
                Để sau
              </Button>
              <Button onClick={() => void run()} disabled={lines.length === 0}>
                Chuyển lên máy chủ
              </Button>
            </>
          )}
          {phase.kind === 'done' && <Button onClick={() => close('migrated')}>Xong</Button>}
          {phase.kind === 'failed' && (
            <>
              <Button variant="outline" onClick={() => close('failed')}>
                Đóng
              </Button>
              <Button onClick={() => void run()}>Thử lại</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
