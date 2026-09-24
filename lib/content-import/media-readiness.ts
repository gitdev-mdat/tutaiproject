import type { QuestionContentBlock } from '@/lib/question-bank/qb-types';
import type { CandidateWarning, QuestionCandidate } from './types';

// Deliberately conservative: only phrases that normally point to a necessary visual.
const VISUAL_CUE =
  /(?:bảng\s+(?:biến\s+thiên|xét\s+dấu)|đồ\s*thị|biểu\s*đồ|hình\s*(?:vẽ|bên|dưới|trên|sau)|như\s+hình|theo\s+hình|graph|diagram|figure)/iu;

export function hasRequiredVisualCue(text: string): boolean {
  return VISUAL_CUE.test(text.normalize('NFC'));
}

export function candidateContent(candidate: QuestionCandidate): QuestionContentBlock[] {
  const content = candidate.orderedContent?.length
    ? candidate.orderedContent
    : [{ id: `text-${candidate.id}`, type: 'TEXT' as const, text: candidate.content }];
  return normalizeRecoveredVisualContent(content);
}

const VISUAL_PLACEHOLDER = /^\s*\[(?:hình ảnh|hình|ảnh|bảng|biểu đồ)[^\]]*\]\s*$/iu;
const RECOVERED_VISUAL_ENVIRONMENT =
  /\\begin\{(?:center|aligned|gathered)\}[\s\S]*?\\begin\{tabular\}[\s\S]*?\\end\{tabular\}[\s\S]*?\\end\{(?:center|aligned|gathered)\}|\\begin\{tabular\}[\s\S]*?\\end\{tabular\}/giu;

/** Removes only synthetic visual serialization adjacent to an attached real image. */
export function normalizeRecoveredVisualContent(
  blocks: QuestionContentBlock[]
): QuestionContentBlock[] {
  return blocks.flatMap((block, index) => {
    if (block.type !== 'TEXT') return [block];
    const adjacentImage = [blocks[index - 1], blocks[index + 1]].some(
      (nearby) => nearby?.type === 'IMAGE'
    );
    if (!adjacentImage) return [block];
    let text = block.text.replace(RECOVERED_VISUAL_ENVIRONMENT, '').trim();
    if (VISUAL_PLACEHOLDER.test(text)) text = '';
    return text ? [{ ...block, text }] : [];
  });
}

export function recomputeMediaReadiness(candidate: QuestionCandidate): QuestionCandidate {
  const orderedContent = candidateContent(candidate);
  const requiresMedia = hasRequiredVisualCue(
    orderedContent
      .filter(
        (block): block is Extract<QuestionContentBlock, { type: 'TEXT' }> => block.type === 'TEXT'
      )
      .map((block) => block.text)
      .join(' ')
  );
  const hasMedia = orderedContent.some((block) => block.type === 'IMAGE');
  const uncertain = (candidate.mediaCandidates ?? []).some(
    (media) =>
      media.confidence !== 'HIGH' &&
      !orderedContent.some((block) => block.type === 'IMAGE' && block.media.assetId === media.id)
  );
  const warnings = candidate.warnings.filter((warning) => warning.code !== 'MISSING_ASSET');
  if (requiresMedia && !hasMedia) {
    const warning: CandidateWarning = {
      id: `missing-asset-${candidate.id}`,
      code: 'MISSING_ASSET',
      message: 'Đề bài nhắc đến hình hoặc bảng nhưng chưa có hình minh họa.',
      actions: ['RESELECT_REGION', 'EDIT'],
    };
    warnings.push(warning);
  }
  const blocking = candidate.validationErrors?.length || (requiresMedia && !hasMedia);
  return {
    ...candidate,
    orderedContent,
    warnings,
    reviewLevel: blocking ? 'BLOCKING' : uncertain || warnings.length ? 'REVIEW' : 'READY',
    fieldConfidence: {
      ...candidate.fieldConfidence,
      asset: hasMedia ? 'HIGH' : requiresMedia || uncertain ? 'REVIEW' : 'HIGH',
    },
  };
}

export function normalizedRegion(region: { x: number; y: number; width: number; height: number }) {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const x = clamp(region.x);
  const y = clamp(region.y);
  return {
    x,
    y,
    width: Math.min(clamp(region.width), 1 - x),
    height: Math.min(clamp(region.height), 1 - y),
  };
}
