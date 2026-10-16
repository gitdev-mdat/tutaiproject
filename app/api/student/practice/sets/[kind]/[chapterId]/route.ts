import { withStudent } from '@/lib/practice/practice-http';
import { startSetAttempt } from '@/lib/practice/practice-catalog';
import { PracticeError } from '@/lib/practice/practice-service';
import { setKindFromSegment } from '@/lib/practice/practice-sets';

type Context = { params: Promise<{ kind: string; chapterId: string }> };

/** Starts a session of a chapter set: `chapter` (Ôn chương) or `synthesis` (Tổng hợp, Plus). */
export async function POST(_request: Request, { params }: Context) {
  const { kind: segment, chapterId } = await params;
  const kind = setKindFromSegment(segment);
  return withStudent(async (studentId) => {
    if (!kind) throw new PracticeError(404, 'Không tìm thấy bộ luyện tập.');
    return startSetAttempt(studentId, kind, decodeURIComponent(chapterId));
  });
}
