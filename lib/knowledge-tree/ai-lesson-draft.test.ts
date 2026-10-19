import { describe, expect, it, vi } from 'vitest';
import {
  AI_DRAFT_LIMITS,
  LessonDraftError,
  buildLessonDraftPrompt,
  generateLessonDraft,
  parseLessonDraft,
  parseLessonDraftRequest,
  repairLatexEscapes,
  sanitizeDraftText,
  withDraftLock,
  inferLessonStage,
  parseLessonDraftResult,
  type LessonDraftContext,
} from './ai-lesson-draft';
import { getLessonDraftAvailability } from './ai-lesson-draft-service';

const context: LessonDraftContext = {
  subject: 'Toán học',
  grade: 'Lớp 12',
  chapterPath: ['Hàm số và ứng dụng đạo hàm'],
  title: 'Đạo hàm',
  description: '',
};

const validDraft = {
  INTRO: 'Đạo hàm đo tốc độ thay đổi của hàm số.',
  OBJECTIVE: '- Phát biểu được định nghĩa đạo hàm.\n- Tính được đạo hàm cơ bản.',
  MAIN_CONTENT: 'Đạo hàm của $f$ tại $x_0$ là $\\lim_{h \\to 0} \\frac{f(x_0+h)-f(x_0)}{h}$.',
  EXAMPLE: "Cho $f(x)=x^2$. Tính $f'(1)$.\n\nLời giải: $f'(x)=2x$ nên $f'(1)=2$.",
  RECAP: '- Đạo hàm là giới hạn của tỉ số gia số.',
  COMMON_MISTAKE: '',
};

const failing = (error: unknown) => vi.fn(async () => Promise.reject(error));

describe('AI lesson draft', () => {
  it('builds a prompt from curriculum context with the $...$ math rule', () => {
    const prompt = buildLessonDraftPrompt({ ...context, note: 'Nhấn mạnh ý nghĩa hình học' });
    expect(prompt).toContain('Toán học › Lớp 12 › Hàm số và ứng dụng đạo hàm');
    expect(prompt).toContain('Tên bài: Đạo hàm');
    expect(prompt).toContain('$...$');
    expect(prompt).toContain('Nhấn mạnh ý nghĩa hình học');
    expect(prompt).not.toContain('Nội dung giáo viên đã viết');
  });

  it('includes existing content only when the admin sends it', () => {
    const prompt = buildLessonDraftPrompt({ ...context, existing: { OBJECTIVE: 'Mục tiêu cũ' } });
    expect(prompt).toContain('Nội dung giáo viên đã viết');
    expect(prompt).toContain('Mục tiêu cũ');
  });

  it('returns a validated draft from a mock provider', async () => {
    const provider = vi.fn(async () => JSON.stringify(validDraft));
    const { draft, plan } = await generateLessonDraft(context, provider);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(plan).toEqual({ prerequisites: [], newNotation: [], teacherNotes: [] });
    expect(draft.OBJECTIVE).toContain('Phát biểu');
    expect(draft.MAIN_CONTENT).toContain('$\\lim_{h \\to 0}');
    expect(draft.COMMON_MISTAKE).toBe('');
  });

  it('keeps LaTeX commands the model escaped with a single backslash', () => {
    // Raw provider text as received: one backslash before each LaTeX command.
    const raw = String.raw`{"OBJECTIVE":"- Xét được tính đơn điệu của hàm số.","MAIN_CONTENT":"Với mọi $x_1, x_2 \in I$, $x_1 \notin J$, $f'(x) \ne 0$, $\frac{1}{2} \times 3 \to \beta$, $\left( x \right)$, $\theta$ và $\forall x$.\nDòng mới\tTab","EXAMPLE":"Cho $f(x) \ge 0$ và $\sqrt{x} \le 1$."}`;
    const draft = parseLessonDraft(raw);
    expect(draft.MAIN_CONTENT).toBe(
      String.raw`Với mọi $x_1, x_2 \in I$, $x_1 \notin J$, $f'(x) \ne 0$, $\frac{1}{2} \times 3 \to \beta$, $\left( x \right)$, $\theta$ và $\forall x$.` +
        '\nDòng mới\tTab'
    );
    expect(draft.EXAMPLE).toBe(String.raw`Cho $f(x) \ge 0$ và $\sqrt{x} \le 1$.`);
  });

  it('leaves correctly escaped JSON unchanged', () => {
    const json = JSON.stringify(validDraft);
    expect(repairLatexEscapes(json)).toBe(json);
    expect(repairLatexEscapes(String.raw`"a\\notin b\nnext \"q\" é"`)).toBe(
      String.raw`"a\\notin b\nnext \"q\" é"`
    );
  });

  it('accepts JSON wrapped in a code fence', () => {
    expect(parseLessonDraft('```json\n' + JSON.stringify(validDraft) + '\n```').EXAMPLE).toContain(
      'Lời giải'
    );
  });

  it('rejects malformed or incomplete output', async () => {
    await expect(generateLessonDraft(context, async () => 'not json')).rejects.toMatchObject({
      code: 'MALFORMED',
    });
    await expect(
      generateLessonDraft(context, async () => JSON.stringify({ ...validDraft, EXAMPLE: 'ngắn' }))
    ).rejects.toMatchObject({ code: 'MALFORMED' });
    await expect(generateLessonDraft(context, async () => '')).rejects.toMatchObject({
      code: 'MALFORMED',
    });
  });

  it('classifies quota, provider and timeout failures', async () => {
    await expect(
      generateLessonDraft(context, failing(Object.assign(new Error('x'), { status: 429 })))
    ).rejects.toMatchObject({ code: 'QUOTA' });
    await expect(
      generateLessonDraft(context, failing(new Error('RESOURCE_EXHAUSTED')))
    ).rejects.toMatchObject({ code: 'QUOTA' });
    await expect(generateLessonDraft(context, failing(new Error('boom')))).rejects.toMatchObject({
      code: 'PROVIDER',
    });
    const slow = (_prompt: string, signal: AbortSignal) =>
      new Promise<string>((_, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason))
      );
    await expect(generateLessonDraft(context, slow, { timeoutMs: 20 })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('strips HTML, scripts and markdown while keeping math', () => {
    const text = sanitizeDraftText(
      '<p>Ý **chính**</p><script>alert(1)</script>\n# Tiêu đề\n* ý một<br>Với $a<b$ và $x^2 \\ge 0$'
    );
    expect(text).not.toMatch(/<script|alert|<p>|\*\*|^#/m);
    expect(text).toContain('Ý chính');
    expect(text).toContain('- ý một');
    expect(text).toContain('$a<b$');
    expect(text).toContain('$x^2 \\ge 0$');
    expect(sanitizeDraftText('a'.repeat(AI_DRAFT_LIMITS.outputBlockChars + 50))).toHaveLength(
      AI_DRAFT_LIMITS.outputBlockChars
    );
  });

  it('bounds request size and ignores unknown fields', () => {
    expect(
      parseLessonDraftRequest({ note: '  ', existing: { OBJECTIVE: 'x', HACK: 'y' } })
    ).toEqual({ existing: { OBJECTIVE: 'x' } });
    expect(() => parseLessonDraftRequest({ note: 'a'.repeat(501) })).toThrow(LessonDraftError);
    expect(() => parseLessonDraftRequest({ existing: { MAIN_CONTENT: 'a'.repeat(6001) } })).toThrow(
      LessonDraftError
    );
    expect(() => parseLessonDraftRequest({ existing: { MAIN_CONTENT: 42 } })).toThrow(
      LessonDraftError
    );
  });

  it('blocks a duplicate request for the same lesson while one is running', async () => {
    let release!: () => void;
    const first = withDraftLock('node-1', () => new Promise<void>((r) => (release = r)));
    await expect(withDraftLock('node-1', async () => 'second')).rejects.toMatchObject({
      code: 'BUSY',
    });
    await expect(withDraftLock('node-2', async () => 'other')).resolves.toBe('other');
    release();
    await first;
    await expect(withDraftLock('node-1', async () => 'again')).resolves.toBe('again');
  });

  it('runs on production deployments when Gemini is configured; never with the mock', () => {
    expect(
      getLessonDraftAvailability({ NODE_ENV: 'production', GEMINI_API_KEY: 'set' }).available
    ).toBe(true);
    expect(getLessonDraftAvailability({ NODE_ENV: 'production' }).available).toBe(false);
    expect(getLessonDraftAvailability({ NODE_ENV: 'development' }).available).toBe(false);
    expect(
      getLessonDraftAvailability({ NODE_ENV: 'development', KNOWLEDGE_AI_PROVIDER: 'mock' })
        .available
    ).toBe(true);
    expect(
      getLessonDraftAvailability({
        NODE_ENV: 'production',
        KNOWLEDGE_AI_PROVIDER: 'mock',
        GEMINI_API_KEY: 'set',
      }).available
    ).toBe(false);
  });
});

describe('AI lesson draft contract', () => {
  it('guesses the learning stage from the title and says where the guess came from', () => {
    expect(inferLessonStage('Tính đơn điệu của hàm số (P1)')).toEqual({
      stage: 'INTRODUCTORY',
      source: 'title',
    });
    expect(inferLessonStage('Tính đơn điệu của hàm số (P2)').stage).toBe('APPLICATION');
    expect(inferLessonStage('Ôn tập chủ đề Một số yếu tố xác suất (P1)').stage).toBe('REVISION');
    expect(inferLessonStage('Kiểm tra cuối học kì I').stage).toBe('REVISION');
    expect(inferLessonStage('Nguyên hàm')).toEqual({ stage: 'INTRODUCTORY', source: 'default' });
  });

  it('tells the model the stage, learner, sequence and unverified prerequisites', () => {
    const prompt = buildLessonDraftPrompt({
      ...context,
      title: 'Tính đơn điệu của hàm số (P1)',
      stage: 'INTRODUCTORY',
      learnerLevel: 'FOUNDATION',
      sequence: { position: 1, total: 17, earlier: [], later: ['Tính đơn điệu của hàm số (P2)'] },
    });
    expect(prompt).toContain('bài 1/17');
    expect(prompt).toContain('Đây là bài MỞ ĐẦU');
    expect(prompt).toContain('học sinh cần củng cố nền');
    expect(prompt).toContain('Không dạy trước nội dung của các bài này');
    expect(prompt).toContain('Chưa có danh sách kiến thức nền được xác nhận');
    expect(prompt).toContain('\\rightarrow');
    expect(prompt).not.toMatch(/undefined/);
  });

  it('says earlier lessons are not proof of mastery and uses admin-stated prerequisites', () => {
    const prompt = buildLessonDraftPrompt({
      ...context,
      sequence: { position: 3, total: 5, earlier: ['Bài A', 'Bài B'], later: [] },
      prerequisites: 'đạo hàm của hàm đa thức',
    });
    expect(prompt).toContain('Xếp trước KHÔNG có nghĩa là học sinh đã nắm vững');
    expect(prompt).toContain(
      'Kiến thức nền giáo viên xác nhận bài này cần: đạo hàm của hàm đa thức'
    );
  });

  it('accepts stage, learner level and prerequisites from the admin and rejects unknown values', () => {
    expect(
      parseLessonDraftRequest({ stage: 'REVISION', learnerLevel: 'ADVANCED', prerequisites: ' x ' })
    ).toEqual({ stage: 'REVISION', learnerLevel: 'ADVANCED', prerequisites: 'x' });
    expect(() => parseLessonDraftRequest({ stage: 'EXPERT' })).toThrow(LessonDraftError);
    expect(() => parseLessonDraftRequest({ prerequisites: 'a'.repeat(401) })).toThrow(
      LessonDraftError
    );
  });

  it('keeps the plan for the admin, a drawable GRAPH, and repairs \\rightarrow', () => {
    const raw = String.raw`{"plan":{"prerequisites":["Đạo hàm"],"newNotation":["$f'(x)$"],"teacherNotes":[]},"OBJECTIVE":"- Xét được tính đơn điệu.","MAIN_CONTENT":"**Ý tưởng.** Tập xác định $\rightarrow$ đạo hàm $\nearrow$ rồi Tính f'(x) \rightarrow Xét dấu.","EXAMPLE":"Ví dụ 1. Cho $y = x^2$. Lời giải. Bước 1: $y' = 2x$.","GRAPH":"y = x^3 - 3x"}`;
    const { draft, plan } = parseLessonDraftResult(raw);
    expect(draft.MAIN_CONTENT).toBe(
      String.raw`**Ý tưởng.** Tập xác định $\rightarrow$ đạo hàm $\nearrow$ rồi Tính f'(x) → Xét dấu.`
    );
    expect(draft.GRAPH).toBe('y = x^3 - 3x');
    expect(plan.prerequisites).toEqual(['Đạo hàm']);
    expect(parseLessonDraftResult(raw.replace('y = x^3 - 3x', 'y = sin(x)')).draft.GRAPH).toBe('');
  });

  it('does not treat a newline before a word as a LaTeX command', () => {
    const json = JSON.stringify({ OBJECTIVE: 'a\nto b\nne c\nTa có' });
    expect(repairLatexEscapes(json)).toBe(json);
  });
});
