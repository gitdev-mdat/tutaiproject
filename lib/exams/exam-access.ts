import {
  CURATOR_NOTE_MAX_LENGTH,
  EXAM_ACCESS_TIERS,
  type ExamAccessTier,
  type ExamRecord,
} from './exam-types';

/** An exam with no access tier stored is free: that is how every exam was published before. */
export function examAccessTier(exam: Pick<ExamRecord, 'accessTier'>): ExamAccessTier {
  return exam.accessTier === 'PLUS' ? 'PLUS' : 'FREE';
}

export type ExamAccessInput =
  | { ok: true; value: Pick<ExamRecord, 'accessTier' | 'curatorNote'> }
  | { ok: false; message: string };

/**
 * Reads the access settings an admin sent. Fields left out keep their current
 * value. The note only makes sense on a Plus exam, so a free exam has none.
 */
export function parseExamAccess(
  body: { accessTier?: unknown; curatorNote?: unknown },
  current: Pick<ExamRecord, 'accessTier' | 'curatorNote'> = {}
): ExamAccessInput {
  const tier = body.accessTier === undefined ? examAccessTier(current) : body.accessTier;
  if (!EXAM_ACCESS_TIERS.includes(tier as ExamAccessTier)) {
    return { ok: false, message: 'Quyền truy cập không hợp lệ.' };
  }
  const rawNote = body.curatorNote === undefined ? (current.curatorNote ?? '') : body.curatorNote;
  if (typeof rawNote !== 'string') return { ok: false, message: 'Ghi chú không hợp lệ.' };
  const note = rawNote.replace(/\s+/g, ' ').trim();
  if (note.length > CURATOR_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      message: `Ghi chú tuyển chọn tối đa ${CURATOR_NOTE_MAX_LENGTH} ký tự.`,
    };
  }
  return {
    ok: true,
    value: {
      accessTier: tier as ExamAccessTier,
      curatorNote: tier === 'PLUS' && note ? note : undefined,
    },
  };
}
