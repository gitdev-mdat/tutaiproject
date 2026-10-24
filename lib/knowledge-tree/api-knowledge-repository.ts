/**
 * Server-backed implementation of IKnowledgeRepository.
 *
 * Every write goes through /api/knowledge-tree so the domain rules in
 * knowledge-tree.ts are enforced on the server and the student experience
 * reads the same data the admin just saved.
 */

import {
  KnowledgeRepoError,
  type CreateNodeInput,
  type IKnowledgeRepository,
  type KnowledgeReadModelResult,
  type KnowledgeRepoErrorCode,
  type KnowledgeResult,
  type UpdateNodeInput,
} from './knowledge-repository';
import { childrenOf } from './knowledge-tree';
import type {
  AiDraftBlockType,
  LearnerLevel,
  LessonDraftMode,
  LessonStage,
} from './ai-lesson-draft';
import type { LessonDraftPreview, LessonDraftResponse } from './ai-lesson-draft-service';
import type { ArticleSummary } from './learning-visibility';
import type {
  KnowledgeArticle,
  KnowledgeSource,
  KnowledgeTreeImportDraft,
  KnowledgeTreeNode,
} from './knowledge-tree-types';

export interface ApiKnowledgeReadModelResult extends KnowledgeReadModelResult {
  articleSummaries: Record<string, ArticleSummary>;
}

export class ArticleValidationError extends KnowledgeRepoError {
  constructor(
    message: string,
    public readonly missing: string[]
  ) {
    super('UNKNOWN', message);
  }
}

const NETWORK_MESSAGE = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';

function fail<T>(code: KnowledgeRepoErrorCode, message: string): KnowledgeResult<T> {
  return { ok: false, error: new KnowledgeRepoError(code, message) };
}

function codeFor(message: string): KnowledgeRepoErrorCode {
  if (message.includes('đã tồn tại')) return 'TITLE_CONFLICT';
  if (message.includes('chính nó')) return 'CANNOT_MOVE_INTO_DESCENDANT';
  if (message.includes('kiến thức con')) return 'HAS_CHILDREN';
  if (message.includes('canonical') || message.includes('Chỉ có thể xóa')) return 'NOT_DELETABLE';
  if (message.includes('Không tìm thấy')) return 'NODE_NOT_FOUND';
  return 'UNKNOWN';
}

async function request<T>(url: string, init?: RequestInit): Promise<KnowledgeResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
  } catch {
    return fail('UNKNOWN', NETWORK_MESSAGE);
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof body.error === 'string' ? body.error : 'Có lỗi xảy ra, vui lòng thử lại.';
    if (Array.isArray(body.missing) && body.missing.length) {
      return { ok: false, error: new ArticleValidationError(message, body.missing as string[]) };
    }
    return fail(codeFor(message), message);
  }
  return { ok: true, data: body as T };
}

export class ApiKnowledgeRepository implements IKnowledgeRepository {
  private nodes: KnowledgeTreeNode[] = [];

  async getReadModel(): Promise<ApiKnowledgeReadModelResult> {
    const result = await request<ApiKnowledgeReadModelResult>('/api/knowledge-tree');
    if (!result.ok) throw result.error;
    this.nodes = result.data.tree.nodes;
    return { tree: result.data.tree, articleSummaries: result.data.articleSummaries ?? {} };
  }

  async createNode(input: CreateNodeInput): Promise<KnowledgeResult<KnowledgeTreeNode>> {
    const result = await request<{ node: KnowledgeTreeNode }>('/api/knowledge-tree', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result.ok ? { ok: true, data: result.data.node } : result;
  }

  async updateNode(
    id: string,
    patch: UpdateNodeInput
  ): Promise<KnowledgeResult<KnowledgeTreeNode>> {
    const result = await request<{ node: KnowledgeTreeNode }>(
      `/api/knowledge-tree/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    );
    return result.ok ? { ok: true, data: result.data.node } : result;
  }

  async moveNode(
    id: string,
    newParentId: string | null,
    order: number
  ): Promise<KnowledgeResult<KnowledgeTreeNode>> {
    const result = await request<{ node: KnowledgeTreeNode }>(
      `/api/knowledge-tree/${encodeURIComponent(id)}/move`,
      { method: 'POST', body: JSON.stringify({ parentId: newParentId, order }) }
    );
    return result.ok ? { ok: true, data: result.data.node } : result;
  }

  async reorderNode(id: string, direction: 'up' | 'down'): Promise<KnowledgeResult<void>> {
    const node = this.nodes.find((item) => item.id === id);
    if (!node) return fail('NODE_NOT_FOUND', 'Không tìm thấy kiến thức.');
    const siblings = childrenOf(this.nodes, node.parentId);
    const index = siblings.findIndex((item) => item.id === id);
    if (direction === 'up' && index === 0) {
      return fail('ALREADY_FIRST', 'Mục này đã ở vị trí đầu tiên.');
    }
    if (direction === 'down' && index === siblings.length - 1) {
      return fail('ALREADY_LAST', 'Mục này đã ở vị trí cuối cùng.');
    }
    const moved = await this.moveNode(id, node.parentId, index + 1 + (direction === 'up' ? -1 : 1));
    return moved.ok ? { ok: true, data: undefined } : moved;
  }

  async deleteNode(
    id: string,
    options: { cascade?: boolean } = {}
  ): Promise<KnowledgeResult<void>> {
    const result = await request<unknown>(
      `/api/knowledge-tree/${encodeURIComponent(id)}${options.cascade ? '?cascade=1' : ''}`,
      { method: 'DELETE' }
    );
    return result.ok ? { ok: true, data: undefined } : result;
  }

  async getArticle(nodeId: string): Promise<KnowledgeResult<KnowledgeArticle | null>> {
    const result = await request<{ article: KnowledgeArticle | null }>(
      `/api/knowledge-tree/${encodeURIComponent(nodeId)}/article`
    );
    return result.ok ? { ok: true, data: result.data.article } : result;
  }

  async upsertArticle(
    nodeId: string,
    article: Partial<KnowledgeArticle>
  ): Promise<KnowledgeResult<KnowledgeArticle>> {
    const result = await request<{ article: KnowledgeArticle }>(
      `/api/knowledge-tree/${encodeURIComponent(nodeId)}/article`,
      {
        method: 'PUT',
        body: JSON.stringify({
          title: article.title,
          blocks: article.blocks,
          publishToLearning: article.publishToLearning,
        }),
      }
    );
    return result.ok ? { ok: true, data: result.data.article } : result;
  }

  async getAiDraftAvailability(nodeId: string): Promise<{
    available: boolean;
    reason?: string;
    context?: LessonDraftPreview | null;
  }> {
    const result = await request<{
      available: boolean;
      reason?: string;
      context?: LessonDraftPreview | null;
    }>(`/api/knowledge-tree/${encodeURIComponent(nodeId)}/article/ai-draft`);
    return result.ok ? result.data : { available: false, reason: result.error.message };
  }

  /** Asks the server for a proposed draft. Never saves anything. */
  async requestAiDraft(
    nodeId: string,
    input: {
      existing?: Partial<Record<AiDraftBlockType, string>>;
      note?: string;
      stage?: LessonStage;
      learnerLevel?: LearnerLevel;
      prerequisites?: string;
      useReferences?: boolean;
      mode?: LessonDraftMode;
    },
    signal?: AbortSignal
  ): Promise<KnowledgeResult<LessonDraftResponse>> {
    return request<LessonDraftResponse>(
      `/api/knowledge-tree/${encodeURIComponent(nodeId)}/article/ai-draft`,
      { method: 'POST', body: JSON.stringify(input), signal }
    );
  }

  /** Notes that reviewed AI parts were applied to the editor, or saved with the lesson. */
  async recordAiDraft(
    nodeId: string,
    generationId: string,
    status: 'APPLIED' | 'SAVED',
    blocks?: AiDraftBlockType[]
  ): Promise<void> {
    await request(`/api/knowledge-tree/${encodeURIComponent(nodeId)}/article/ai-draft`, {
      method: 'PATCH',
      body: JSON.stringify({ generationId, status, blocks }),
    });
  }

  // Source attachments have no server storage yet; the admin page does not expose them.
  async getSources(): Promise<KnowledgeResult<KnowledgeSource[]>> {
    return { ok: true, data: [] };
  }

  async attachSource(): Promise<KnowledgeResult<KnowledgeSource>> {
    return fail('UNKNOWN', 'Chưa hỗ trợ đính kèm nguồn tài liệu trên máy chủ.');
  }

  async removeSource(): Promise<KnowledgeResult<void>> {
    return fail('UNKNOWN', 'Chưa hỗ trợ đính kèm nguồn tài liệu trên máy chủ.');
  }

  async importTree(
    draft: KnowledgeTreeImportDraft,
    destinationNodeId: string | null
  ): Promise<KnowledgeResult<void>> {
    const result = await request<unknown>('/api/knowledge-tree/import', {
      method: 'POST',
      body: JSON.stringify({ draft, destinationNodeId }),
    });
    return result.ok ? { ok: true, data: undefined } : result;
  }
}
