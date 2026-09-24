'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Grid2x2,
  Loader2,
  SendHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

import type { CurriculumExamSet, ExamSessionMode } from '@/lib/exam-sets/types';
import { recordAssessmentSubmission } from '@/features/student-experience/lib/student-experience-service';
import type { StudentActivityKind } from '@/features/student-experience/lib/types';

import styles from './practice-session.module.css';

interface SignTableData {
  headers: string[];
  rows: { label: string; values: string[] }[];
}

export interface PracticeQuestion {
  content: string;
  options: readonly { id: string; label: string }[];
  correctAnswer: string;
  primaryKnowledgeNodeId?: string;
  knowledgePath?: readonly string[];
  signTable?: SignTableData;
  explanationParts?: readonly {
    type: 'text' | 'signTable' | 'conclusion';
    content?: string;
  }[];
  tip?: string;
}

export const DEFAULT_FIXTURE_QUESTIONS: readonly PracticeQuestion[] = [
  {
    content:
      'Cho hàm số y = f(x) có bảng xét dấu của đạo hàm f′(x) = (x − 1)(x + 2). Hàm số đã cho đồng biến trên khoảng nào dưới đây?',
    options: [
      { id: 'a', label: '(−∞; −2)' },
      { id: 'b', label: '(−2; 1)' },
      { id: 'c', label: '(1; +∞)' },
      { id: 'd', label: '(−∞; −2) và (1; +∞)' },
    ],
    correctAnswer: 'd',
    primaryKnowledgeNodeId: 'node-calculus-monotonicity',
    knowledgePath: ['Toán học', 'Lớp 12', 'Ứng dụng đạo hàm', 'Tính đơn điệu của hàm số'],
    signTable: {
      headers: ['x', '−∞', '−2', '', '1', '+∞'],
      rows: [{ label: 'f′(x)', values: ['+', '0', '−', '0', '+'] }],
    },
    explanationParts: [
      {
        type: 'text',
        content: 'Ta có: f′(x) = (x − 1)(x + 2) = 0 ⇔ x = −2 hoặc x = 1.',
      },
      { type: 'signTable' },
      {
        type: 'conclusion',
        content:
          'Suy ra f′(x) > 0 trên (−∞; −2) và (1; +∞).\nVậy hàm số đồng biến trên (−∞; −2) và (1; +∞).',
      },
    ],
    tip: 'Tìm nghiệm của f′(x) = 0, xét dấu f′(x) trên các khoảng để xác định khoảng đồng biến.',
  },
  {
    content: 'Cho hàm số y = f(x) có f′(x) = x(x − 2)². Điểm cực tiểu của hàm số đã cho là:',
    options: [
      { id: 'a', label: 'x = 0' },
      { id: 'b', label: 'x = 2' },
      { id: 'c', label: 'x = −2' },
      { id: 'd', label: 'Không có cực tiểu' },
    ],
    correctAnswer: 'a',
    primaryKnowledgeNodeId: 'node-calculus-extrema',
    knowledgePath: ['Toán học', 'Lớp 12', 'Ứng dụng đạo hàm', 'Cực trị của hàm số'],
    explanationParts: [
      {
        type: 'text',
        content:
          'Ta có f′(x) = 0 ⇔ x = 0 hoặc x = 2. Vì (x − 2)² ≥ 0 với mọi x nên f′(x) chỉ đổi dấu từ âm sang dương khi qua x = 0.',
      },
      {
        type: 'conclusion',
        content: 'Do đó x = 0 là điểm cực tiểu của hàm số.',
      },
    ],
    tip: 'Điểm cực tiểu là điểm mà đạo hàm đổi dấu từ âm sang dương.',
  },
  {
    content: 'Giá trị lớn nhất của hàm số f(x) = x³ − 3x + 2 trên đoạn [0; 2] bằng:',
    options: [
      { id: 'a', label: '0' },
      { id: 'b', label: '2' },
      { id: 'c', label: '4' },
      { id: 'd', label: '1' },
    ],
    correctAnswer: 'c',
    primaryKnowledgeNodeId: 'node-calculus-minmax',
    knowledgePath: ['Toán học', 'Lớp 12', 'Ứng dụng đạo hàm', 'Giá trị lớn nhất và nhỏ nhất'],
    explanationParts: [
      {
        type: 'text',
        content:
          'f′(x) = 3x² − 3 = 0 ⇔ x = ±1. Trong đoạn [0; 2] có x = 1. Ta tính: f(0) = 2, f(1) = 0, f(2) = 4.',
      },
      {
        type: 'conclusion',
        content: 'Vậy giá trị lớn nhất trên [0; 2] là f(2) = 4.',
      },
    ],
    tip: 'Tính đạo hàm, tìm nghiệm trong đoạn, so sánh giá trị tại các điểm tới hạn và 2 đầu mút.',
  },
  {
    content: 'Họ tất cả các nguyên hàm của hàm số f(x) = 2x + eˣ là:',
    options: [
      { id: 'a', label: 'x² + eˣ + C' },
      { id: 'b', label: '2 + eˣ + C' },
      { id: 'c', label: 'x² − eˣ + C' },
      { id: 'd', label: '2x² + eˣ + C' },
    ],
    correctAnswer: 'a',
    primaryKnowledgeNodeId: 'node-integral-basic',
    knowledgePath: ['Toán học', 'Lớp 12', 'Nguyên hàm và tích phân', 'Nguyên hàm cơ bản'],
    explanationParts: [
      {
        type: 'text',
        content: 'Áp dụng công thức nguyên hàm cơ bản: ∫2x dx = x² + C₁ và ∫eˣ dx = eˣ + C₂.',
      },
      {
        type: 'conclusion',
        content: 'Vậy ∫(2x + eˣ) dx = x² + eˣ + C.',
      },
    ],
    tip: 'Áp dụng bảng nguyên hàm từng thành phần.',
  },
  {
    content:
      'Nếu đặt u = x² + 1 thì tích phân I = ∫₀¹ 2x(x² + 1)³ dx trở thành tích phân nào dưới đây?',
    options: [
      { id: 'a', label: '∫₁² u³ du' },
      { id: 'b', label: '∫₀¹ u³ du' },
      { id: 'c', label: '∫₁² 2u³ du' },
      { id: 'd', label: '∫₀¹ 2u³ du' },
    ],
    correctAnswer: 'a',
    primaryKnowledgeNodeId: 'node-integral-substitution',
    knowledgePath: ['Toán học', 'Lớp 12', 'Nguyên hàm và tích phân', 'Phương pháp đổi biến số'],
    explanationParts: [
      {
        type: 'text',
        content: 'Đặt u = x² + 1 ⇒ du = 2x dx. Đổi cận: x = 0 ⇒ u = 1; x = 1 ⇒ u = 2.',
      },
      {
        type: 'conclusion',
        content: 'Do đó I = ∫₁² u³ du.',
      },
    ],
    tip: 'Đổi biến nhớ phải đổi vi phân và đổi cận tích phân.',
  },
  {
    content: 'Tập xác định của hàm số y = (x − 2)⁻³ là:',
    options: [
      { id: 'a', label: 'ℝ \\ {2}' },
      { id: 'b', label: '(2; +∞)' },
      { id: 'c', label: 'ℝ' },
      { id: 'd', label: '[2; +∞)' },
    ],
    correctAnswer: 'a',
    primaryKnowledgeNodeId: 'node-log-power',
    knowledgePath: ['Toán học', 'Lớp 12', 'Mũ và logarit', 'Lũy thừa và hàm số lũy thừa'],
    explanationParts: [
      {
        type: 'text',
        content:
          'Vì số mũ −3 là số nguyên âm, điều kiện xác định là cơ số khác 0: x − 2 ≠ 0 ⇔ x ≠ 2.',
      },
      {
        type: 'conclusion',
        content: 'Vậy tập xác định là D = ℝ \\ {2}.',
      },
    ],
    tip: 'Số mũ nguyên âm: cơ số khác 0. Số mũ không nguyên: cơ số dương.',
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADER_HEIGHT = 64; // px — must match .header height in CSS
const ANSWER_KEYS = ['a', 'b', 'c', 'd'] as const;

// ─── Time helpers ─────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AnswerResult = 'correct' | 'incorrect';
type TimerState = 'normal' | 'warning' | 'critical';
type AIState = 'idle' | 'loading' | 'success' | 'error';

interface AIMessage {
  role: 'user' | 'ai';
  text: string;
}

interface SessionState {
  answeredMap: Record<number, string>;
  resultMap: Record<number, AnswerResult>;
  currentIndex: number;
  pendingAnswer: string;
  submitted: boolean;
  error: string;
}

interface PracticeSessionProps {
  examSet: CurriculumExamSet;
  startQuestion: number;
  restart?: boolean;
  source: string;
  mode: ExamSessionMode;
  knowledgeNodeId?: string;
  questions?: readonly PracticeQuestion[];
  experience?: {
    kind: StudentActivityKind;
    activityId: string;
    title: string;
    rankingEligible: boolean;
  };
}

// ─── Sign table renderer ──────────────────────────────────────────────────────

function SignTable({ table }: { table: SignTableData }) {
  return (
    <div className={styles.signTable} aria-label="Bảng xét dấu f′(x)">
      <div className={styles.signTableLabel}>Bảng xét dấu f\u2032(x):</div>
      <table className={styles.signTableEl}>
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th key={i} className={styles.signTableCell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              <td className={`${styles.signTableCell} ${styles.signTableRowLabel}`}>{row.label}</td>
              {row.values.map((v, vi) => (
                <td
                  key={vi}
                  className={`${styles.signTableCell} ${v === '0' ? styles.signTableZero : v === '+' ? styles.signTablePos : styles.signTableNeg}`}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Explanation renderer ─────────────────────────────────────────────────────

function ExplanationBody({ question }: { question: PracticeQuestion }) {
  if (!question.explanationParts || question.explanationParts.length === 0) {
    return (
      <div className={styles.explanationBody}>
        <p className={styles.explanationText}>
          Đáp án đúng là <strong>{question.correctAnswer.toUpperCase()}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.explanationBody}>
      {question.explanationParts.map((part, i) => {
        if (part.type === 'text' && part.content) {
          return (
            <p key={i} className={styles.explanationText}>
              {part.content}
            </p>
          );
        }
        if (part.type === 'signTable' && question.signTable) {
          return <SignTable key={i} table={question.signTable} />;
        }
        if (part.type === 'conclusion' && part.content) {
          return (
            <div key={i} className={styles.explanationConclusion}>
              {part.content.split('\n').map((line, j) => (
                <p key={j}>{line}</p>
              ))}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  aiState: AIState;
  aiInput: string;
  aiMessages: AIMessage[];
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onQuickPrompt: (prompt: string) => void;
  selectedAnswerId: string;
  submitted: boolean;
  question: PracticeQuestion;
}

function AIPanel({
  isOpen,
  onClose,
  aiState,
  aiInput,
  aiMessages,
  onInputChange,
  onSend,
  onKeyDown,
  onQuickPrompt,
  selectedAnswerId,
  question,
}: AIPanelProps) {
  const wrongLabel = question.options.find((o) => o.id === selectedAnswerId)?.label ?? '';

  const quickPrompts = [
    {
      label: 'Giải thích đơn giản hơn',
      icon: <Sparkles size={12} aria-hidden="true" />,
      prompt:
        'Giải thích bài này theo cách đơn giản nhất, dùng ngôn ngữ dễ hiểu cho học sinh lớp 12.',
    },
    {
      label: `Vì sao ${selectedAnswerId.toUpperCase()} sai?`,
      icon: <X size={12} aria-hidden="true" />,
      prompt: `Tại sao đáp án ${selectedAnswerId.toUpperCase()} (${wrongLabel}) lại sai?`,
    },
    {
      label: 'Cho ví dụ tương tự',
      icon: <BookOpen size={12} aria-hidden="true" />,
      prompt: 'Cho em một ví dụ bài toán tương tự để luyện tập thêm.',
    },
    {
      label: 'Nhắc lại kiến thức nền',
      icon: <FileText size={12} aria-hidden="true" />,
      prompt:
        'Nhắc lại quy tắc xét dấu của đạo hàm và cách xác định khoảng đồng biến, nghịch biến.',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className={styles.aiBackdrop} onClick={onClose} aria-hidden="true" />}

      {/* Drawer panel */}
      <div
        className={`${styles.aiDrawer} ${isOpen ? styles['aiDrawer--open'] : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="AI trợ giảng"
      >
        <div className={styles.aiDrawerHeader}>
          <div className={styles.aiDrawerTitle}>
            <Sparkles size={15} aria-hidden="true" />
            AI trợ giảng
          </div>
          <button
            type="button"
            className={styles.aiDrawerClose}
            onClick={onClose}
            aria-label="Đóng AI trợ giảng"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.aiDrawerBody}>
          <p className={styles.aiDrawerDesc}>Hỏi thêm về câu này</p>

          {/* Quick prompts */}
          <div className={styles.aiQuickList}>
            {quickPrompts.map((q) => (
              <button
                key={q.label}
                type="button"
                className={styles.aiQuickBtn}
                onClick={() => onQuickPrompt(q.prompt)}
                disabled={aiState === 'loading'}
                aria-label={q.label}
              >
                {q.icon}
                {q.label}
              </button>
            ))}
          </div>

          {/* Response area */}
          {aiState === 'loading' && (
            <div className={styles.aiLoading} aria-live="polite">
              <div className={styles.aiLoadingDot} />
              <div className={styles.aiLoadingDot} />
              <div className={styles.aiLoadingDot} />
              <span>AI đang giải thích...</span>
            </div>
          )}
          {aiState === 'error' && (
            <div className={styles.aiError} role="alert">
              Không thể tải giải thích lúc này. Thử lại nhé.
            </div>
          )}
          {aiMessages.length > 0 && (
            <div className={styles.aiResponse} aria-label="Câu trả lời từ AI" aria-live="polite">
              {aiMessages
                .filter((m) => m.role === 'ai')
                .slice(-1)
                .map((m, i) => (
                  <p key={i} className={styles.aiResponseText}>
                    {m.text}
                  </p>
                ))}
            </div>
          )}

          {/* Input row */}
          <div className={styles.aiInputRow}>
            <textarea
              className={styles.aiTextarea}
              value={aiInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Em chưa hiểu phần nào?"
              aria-label="Câu hỏi gửi cho AI"
              rows={3}
              disabled={aiState === 'loading'}
            />
            <button
              type="button"
              className={styles.aiSendBtn}
              onClick={onSend}
              disabled={!aiInput.trim() || aiState === 'loading'}
              aria-label="Gửi câu hỏi"
            >
              {aiState === 'loading' ? (
                <Loader2 size={15} aria-hidden="true" className={styles.spinning} />
              ) : (
                <SendHorizontal size={15} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Question List Popover ────────────────────────────────────────────────────

interface QuestionListPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  totalQuestions: number;
  currentIndex: number;
  answeredMap: Record<number, string>;
  resultMap: Record<number, AnswerResult>;
  onNavigate: (idx: number) => void;
}

function QuestionListPopover({
  isOpen,
  onClose,
  totalQuestions,
  currentIndex,
  answeredMap,
  resultMap,
  onNavigate,
}: QuestionListPopoverProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.popoverBackdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.questionPopover} role="dialog" aria-label="Danh sách câu hỏi">
        <div className={styles.questionPopoverHeader}>
          <span className={styles.questionPopoverTitle}>Danh sách câu</span>
          <button
            type="button"
            className={styles.popoverClose}
            onClick={onClose}
            aria-label="Đóng danh sách câu"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.questionPopoverGrid}>
          {Array.from({ length: totalQuestions }, (_, i) => {
            let cls = styles.popoverNum;
            if (i === currentIndex) cls += ` ${styles['popoverNum--current']}`;
            else if (resultMap[i] === 'correct') cls += ` ${styles['popoverNum--correct']}`;
            else if (resultMap[i] === 'incorrect') cls += ` ${styles['popoverNum--incorrect']}`;
            else if (answeredMap[i] !== undefined) cls += ` ${styles['popoverNum--answered']}`;
            return (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => {
                  onNavigate(i);
                  onClose();
                }}
                aria-label={`Câu ${i + 1}${i === currentIndex ? ' (đang làm)' : ''}`}
                aria-current={i === currentIndex ? 'step' : undefined}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PracticeSession({
  examSet,
  startQuestion,
  restart,
  source,
  mode,
  knowledgeNodeId,
  questions,
  experience,
}: PracticeSessionProps) {
  const sessionQuestions = useMemo(() => {
    let pool = questions && questions.length > 0 ? questions : DEFAULT_FIXTURE_QUESTIONS;
    if (knowledgeNodeId) {
      const filtered = pool.filter((q) => q.primaryKnowledgeNodeId === knowledgeNodeId);
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    return pool;
  }, [questions, knowledgeNodeId]);

  const storageKey = `tutai-practice-${examSet.id}${knowledgeNodeId ? `-${knowledgeNodeId}` : ''}`;
  const totalQuestions = Math.min(examSet.questionCount, sessionQuestions.length);
  const totalSeconds = examSet.durationMinutes * 60;

  // ── Session state ──
  const [session, setSession] = useState<SessionState>(() => ({
    answeredMap: {},
    resultMap: {},
    currentIndex: Math.max(0, Math.min(startQuestion - 1, totalQuestions - 1)),
    pendingAnswer: '',
    submitted: false,
    error: '',
  }));

  // ── Timer ──
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [sessionEnded, setSessionEnded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UI state ──
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showQuestionList, setShowQuestionList] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiState, setAiState] = useState<AIState>('idle');
  const aiRequestInFlight = useRef(false);
  const recordedSubmission = useRef(false);

  // ── Scroll / sticky toolbar refs ──
  const questionCardRef = useRef<HTMLElement>(null);
  const questionToolbarRef = useRef<HTMLDivElement>(null);
  const [stickyToolbarVisible, setStickyToolbarVisible] = useState(false);

  // ── Derived values ──
  const currentIndex = session.currentIndex;
  const activeQuestion = sessionQuestions[currentIndex] ?? sessionQuestions[0];
  const answeredCount = Object.keys(session.answeredMap).length;
  const correctCount = Object.values(session.resultMap).filter((r) => r === 'correct').length;
  const incorrectCount = Object.values(session.resultMap).filter((r) => r === 'incorrect').length;
  const remainingCount = totalQuestions - answeredCount;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);
  const timerState: TimerState =
    remainingSeconds <= 60 ? 'critical' : remainingSeconds <= 300 ? 'warning' : 'normal';
  const sourceLabel =
    experience?.kind === 'exam'
      ? 'Luyện thi'
      : experience?.kind === 'arena'
        ? 'Đấu trường'
        : experience?.kind === 'practice'
          ? 'Luyện đề'
          : 'Lộ trình';
  const sessionLabel =
    experience?.kind === 'exam'
      ? 'Phiên luyện thi'
      : experience?.kind === 'arena'
        ? 'Phiên Đấu trường'
        : 'Phiên luyện tập';

  const selectedAnswerId = session.submitted
    ? (session.answeredMap[currentIndex] ?? session.pendingAnswer)
    : session.pendingAnswer;
  const isCorrect = session.submitted && selectedAnswerId === activeQuestion.correctAnswer;

  // ── Timer effect ──
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleEndSession = useCallback(() => {
    stopTimer();
    setSessionEnded(true);
    setShowSubmitConfirm(false);
  }, [stopTimer]);

  useEffect(() => {
    if (sessionEnded) return;
    if (timerRef.current !== null) return;
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          stopTimer();
          setSessionEnded(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEnded]);

  useEffect(() => {
    if (!sessionEnded || !experience || recordedSubmission.current) return;
    recordedSubmission.current = true;
    const evidenceByKnowledgePoint = new Map<
      string,
      { knowledgePointId: string; title: string; correct: number; total: number }
    >();
    for (let index = 0; index < totalQuestions; index += 1) {
      const question = sessionQuestions[index] ?? sessionQuestions[0];
      const knowledgePointId = question.primaryKnowledgeNodeId ?? 'unmapped';
      const current = evidenceByKnowledgePoint.get(knowledgePointId) ?? {
        knowledgePointId,
        title: question.knowledgePath?.at(-1) ?? 'Kiến thức chưa phân loại',
        correct: 0,
        total: 0,
      };
      current.total += 1;
      if (session.resultMap[index] === 'correct') current.correct += 1;
      evidenceByKnowledgePoint.set(knowledgePointId, current);
    }
    recordAssessmentSubmission({
      kind: experience.kind,
      activityId: experience.activityId,
      title: experience.title,
      correct: correctCount,
      total: totalQuestions,
      rankingEligible: experience.rankingEligible,
      evidence: Array.from(evidenceByKnowledgePoint.values()),
    });
  }, [correctCount, experience, session.resultMap, sessionEnded, sessionQuestions, totalQuestions]);

  // ── Restore progress ──
  useEffect(() => {
    if (restart) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    let frame: number | undefined;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as {
        question?: number;
        answeredMap?: Record<number, string>;
        resultMap?: Record<number, AnswerResult>;
      };
      if (
        typeof saved.question === 'number' &&
        saved.question >= 1 &&
        saved.question <= totalQuestions
      ) {
        frame = window.requestAnimationFrame(() => {
          setSession((s) => {
            const pending = saved.answeredMap?.[saved.question! - 1] ?? '';
            return {
              ...s,
              currentIndex: saved.question! - 1,
              answeredMap: saved.answeredMap ?? {},
              resultMap: saved.resultMap ?? {},
              pendingAnswer: pending,
              submitted: mode === 'PRACTICE' ? pending !== '' : false,
            };
          });
        });
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [restart, storageKey, totalQuestions, mode]);

  // ── Sticky toolbar observer ──
  useEffect(() => {
    const toolbar = questionToolbarRef.current;
    if (!toolbar) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyToolbarVisible(!entry.isIntersecting),
      { rootMargin: `-${HEADER_HEIGHT}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'textarea' || tag === 'input' || showSubmitConfirm || aiOpen || showQuestionList)
        return;
      if (session.submitted) {
        if (e.key === 'ArrowRight') navigateTo(currentIndex + 1);
        if (e.key === 'ArrowLeft') navigateTo(currentIndex - 1);
        return;
      }
      const key = e.key.toLowerCase();
      if (ANSWER_KEYS.includes(key as (typeof ANSWER_KEYS)[number])) {
        handleSelectAnswer(key);
      }
      if (e.key === 'ArrowRight') navigateTo(currentIndex + 1);
      if (e.key === 'ArrowLeft') navigateTo(currentIndex - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.submitted, currentIndex, showSubmitConfirm, aiOpen, showQuestionList]);

  // ── Scroll to question on navigation ──
  function scrollToQuestion() {
    const el = questionCardRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  // ── Save progress ──
  function saveProgress(
    index: number,
    answeredMap: Record<number, string>,
    resultMap: Record<number, AnswerResult>
  ) {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ question: index + 1, answeredMap, resultMap })
      );
    } catch {
      /* ignore */
    }
  }

  // ── Answer actions ──
  function handleSelectAnswer(id: string) {
    if (session.submitted) return;
    const currentQ = sessionQuestions[currentIndex] ?? sessionQuestions[0];
    setSession((s) => {
      if (mode === 'EXAM_SIMULATION') {
        const newAnsweredMap = { ...s.answeredMap, [currentIndex]: id };
        const newResultMap = {
          ...s.resultMap,
          [currentIndex]: id === currentQ.correctAnswer ? 'correct' : 'incorrect',
        } as Record<number, AnswerResult>;
        saveProgress(currentIndex, newAnsweredMap, newResultMap);
        return {
          ...s,
          pendingAnswer: id,
          error: '',
          answeredMap: newAnsweredMap,
          resultMap: newResultMap,
        };
      }
      return { ...s, pendingAnswer: id, error: '' };
    });
  }

  function handleSubmitAnswer() {
    if (!session.pendingAnswer) {
      setSession((s) => ({ ...s, error: 'Chọn một đáp án để tiếp tục nhé.' }));
      return;
    }
    const currentQ = sessionQuestions[currentIndex] ?? sessionQuestions[0];
    const result: AnswerResult =
      session.pendingAnswer === currentQ.correctAnswer ? 'correct' : 'incorrect';
    const newAnsweredMap = { ...session.answeredMap, [currentIndex]: session.pendingAnswer };
    const newResultMap = { ...session.resultMap, [currentIndex]: result };
    setSession((s) => ({
      ...s,
      submitted: true,
      error: '',
      answeredMap: newAnsweredMap,
      resultMap: newResultMap,
    }));
    saveProgress(currentIndex, newAnsweredMap, newResultMap);
    setAiMessages([]);
    setAiState('idle');
    setAiOpen(false);
  }

  function navigateTo(index: number) {
    if (index < 0 || index >= totalQuestions) return;
    const alreadyAnswered = session.answeredMap[index];
    setSession((s) => ({
      ...s,
      currentIndex: index,
      pendingAnswer: alreadyAnswered ?? '',
      submitted: mode === 'PRACTICE' ? alreadyAnswered !== undefined : false,
      error: '',
    }));
    setAiMessages([]);
    setAiState('idle');
    setAiInput('');
    setAiOpen(false);
    requestAnimationFrame(() => scrollToQuestion());
  }

  // ── Submit ──
  function handleSubmitClick() {
    if (totalQuestions - answeredCount > 0) {
      setShowSubmitConfirm(true);
    } else {
      handleEndSession();
    }
  }

  // ── AI ──
  async function sendAIMessage(message: string) {
    if (!message.trim() || aiRequestInFlight.current) return;
    const currentQ = sessionQuestions[currentIndex] ?? sessionQuestions[0];
    const chosenOptionId = session.answeredMap[currentIndex] ?? session.pendingAnswer ?? '';
    const chosenOption = currentQ.options.find((o) => o.id === chosenOptionId);
    const correctOption = currentQ.options.find((o) => o.id === currentQ.correctAnswer);
    setAiMessages((prev) => [...prev, { role: 'user', text: message }]);
    setAiState('loading');
    setAiInput('');
    aiRequestInFlight.current = true;
    try {
      const res = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Toán ${examSet.grade}`,
          lessonTitle: examSet.title,
          questionContent: currentQ.content,
          options: currentQ.options,
          correctAnswer: currentQ.correctAnswer,
          selectedAnswer: chosenOptionId,
          explanation: currentQ.explanationParts
            ? currentQ.explanationParts.map((p) => ('content' in p ? p.content : '')).join('\n')
            : '',
          userMessage: message,
          selectedAnswerLabel: chosenOption?.label ?? '',
          correctAnswerLabel: correctOption?.label ?? '',
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = (await res.json()) as { answer?: string; error?: string };
      if (data.error || !data.answer) throw new Error(data.error ?? 'Empty response');
      setAiMessages((prev) => [...prev, { role: 'ai', text: data.answer! }]);
      setAiState('success');
    } catch {
      setAiState('error');
    } finally {
      aiRequestInFlight.current = false;
    }
  }

  function handleAISend() {
    if (aiInput.trim()) void sendAIMessage(aiInput);
  }

  function handleAIKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAISend();
    }
  }

  // ── Progress circle math ──
  const circleR = 26;
  const circleC = 2 * Math.PI * circleR;
  const circleDash = circleC - (progressPercent / 100) * circleC;

  // ─── End session view ───────────────────────────────────────────────────────
  if (sessionEnded) {
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const weakAreas = Array.from({ length: totalQuestions }, (_, index) => index)
      .filter((index) => session.resultMap[index] === 'incorrect')
      .reduce((areas, index) => {
        const q = sessionQuestions[index] ?? sessionQuestions[0];
        const nodeId = q.primaryKnowledgeNodeId || 'unmapped';
        const existing = areas.get(nodeId);
        if (existing) {
          existing.count += 1;
          existing.questions.push(index);
        } else {
          areas.set(nodeId, {
            nodeId,
            title: q.knowledgePath?.at(-1) ?? 'Chưa phân loại kiến thức',
            path: q.knowledgePath ? [...q.knowledgePath] : ['Chưa phân loại kiến thức'],
            count: 1,
            questions: [index],
          });
        }
        return areas;
      }, new Map<string, { nodeId: string; title: string; path: string[]; count: number; questions: number[] }>());
    const sortedWeakAreas = Array.from(weakAreas.values()).sort(
      (a, b) => b.count - a.count || a.title.localeCompare(b.title, 'vi')
    );
    const experienceQuery = experience
      ? `&experience=${experience.kind}&experienceId=${encodeURIComponent(experience.activityId)}&experienceTitle=${encodeURIComponent(experience.title)}&rankingEligible=${experience.rankingEligible ? '1' : '0'}`
      : '';
    const practiceAgainHref = `/exam-sets/${examSet.slug}/practice?source=${encodeURIComponent(source)}&mode=${encodeURIComponent(mode)}&restart=1${experienceQuery}`;
    const resultLabel =
      experience?.kind === 'exam'
        ? 'Kết quả bài thi'
        : experience?.kind === 'arena'
          ? 'Kết quả đấu trường'
          : 'Kết quả luyện tập';

    return (
      <div className={styles.pageShell}>
        <div
          className={styles.endState}
          style={{ maxWidth: 860, margin: '0 auto', textAlign: 'left' }}
        >
          <div style={{ textAlign: 'center' }}>
            <p className={styles.endTitle}>{resultLabel}</p>
            <p className={styles.endSub}>
              <strong>
                {correctCount} / {totalQuestions} câu đúng
              </strong>{' '}
              · {accuracy}%
            </p>
            <p className={styles.endSub}>
              {totalQuestions - correctCount} câu cần xem lại · {totalQuestions - answeredCount} câu
              chưa trả lời
            </p>
          </div>

          {sortedWeakAreas.length > 0 ? (
            <section aria-labelledby="weak-knowledge-heading" style={{ marginTop: 28 }}>
              <h2 id="weak-knowledge-heading" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
                Bạn cần cải thiện
              </h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {sortedWeakAreas.map((area) => (
                  <div
                    key={area.nodeId}
                    style={{
                      border: '1px solid #DCE5F2',
                      borderRadius: 12,
                      padding: 14,
                      background: '#fff',
                    }}
                  >
                    <strong>{area.title}</strong>
                    <div style={{ color: '#64748B', fontSize: '0.8rem', marginTop: 4 }}>
                      {area.path.join(' › ')} · {area.count} câu sai
                    </div>
                    <Link
                      href={`${practiceAgainHref}&knowledgeNodeId=${encodeURIComponent(area.nodeId)}`}
                      style={{
                        display: 'inline-flex',
                        marginTop: 10,
                        color: '#1768FF',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      Luyện phần này
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section
              aria-labelledby="perfect-result-heading"
              style={{ marginTop: 28, padding: 16, borderRadius: 12, background: '#F0FDF4' }}
            >
              <h2 id="perfect-result-heading" style={{ fontSize: '1.05rem', margin: 0 }}>
                Bạn đã hoàn thành tốt lượt luyện tập này.
              </h2>
              <p style={{ margin: '8px 0 0', color: '#166534' }}>
                Chưa phát hiện phần kiến thức nào cần ưu tiên ôn lại từ kết quả hiện tại.
              </p>
            </section>
          )}

          <section aria-labelledby="question-review-heading" style={{ marginTop: 28 }}>
            <h2 id="question-review-heading" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
              Review câu hỏi
            </h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {Array.from({ length: totalQuestions }, (_, index) => {
                const q = sessionQuestions[index] ?? sessionQuestions[0];
                const selected = session.answeredMap[index];
                const result = session.resultMap[index];
                const status = !selected ? 'Chưa trả lời' : result === 'correct' ? 'Đúng' : 'Sai';
                const statusColor =
                  status === 'Đúng' ? '#15803D' : status === 'Sai' ? '#B91C1C' : '#64748B';
                return (
                  <article
                    key={index}
                    style={{
                      border: '1px solid #DCE5F2',
                      borderRadius: 12,
                      padding: 14,
                      background: '#fff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong>Câu {index + 1}</strong>
                      <strong style={{ color: statusColor }}>{status}</strong>
                    </div>
                    <p style={{ margin: '8px 0 0' }}>{q.content}</p>
                    {selected && (
                      <p style={{ margin: '8px 0 0', color: '#475569' }}>
                        Bạn chọn: <strong>{selected.toUpperCase()}</strong> · Đáp án đúng:{' '}
                        <strong>{q.correctAnswer.toUpperCase()}</strong>
                      </p>
                    )}
                    {selected && q.explanationParts && q.explanationParts.length > 0 && (
                      <p style={{ margin: '8px 0 0', color: '#475569' }}>
                        Giải thích:{' '}
                        {q.explanationParts
                          .map((part) => ('content' in part ? part.content : ''))
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: 24,
            }}
          >
            <Link
              href={practiceAgainHref}
              className={styles.btnPrimary}
              style={{ textDecoration: 'none' }}
            >
              {experience?.kind === 'practice' ? 'Luyện lại' : 'Làm lại'}
            </Link>
            <Link
              href={source}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                borderRadius: 11,
                color: '#1768FF',
                fontWeight: 750,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={16} /> Quay lại {sourceLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Dark nav header ── */}
      <header className={styles.header} role="banner">
        <Link href={source} className={styles.headerBack} aria-label={`Quay lại ${sourceLabel}`}>
          <ChevronLeft size={16} aria-hidden="true" />
          Quay lại {sourceLabel}
        </Link>
        <span className={styles.headerCenter}>{sessionLabel}</span>
        <div className={styles.headerRight} aria-hidden="true" />
      </header>

      {/* ── Sticky question toolbar (appears when main toolbar scrolls out) ── */}
      <div
        className={`${styles.stickyToolbar} ${stickyToolbarVisible ? styles['stickyToolbar--visible'] : ''}`}
        aria-hidden={!stickyToolbarVisible}
      >
        <span className={styles.stickyToolbarLabel}>
          Câu {currentIndex + 1}/{totalQuestions}
        </span>
        <div className={styles.stickyToolbarActions}>
          <button
            type="button"
            className={styles.toolbarIconBtn}
            onClick={() => setShowQuestionList(true)}
            aria-label="Mở danh sách câu"
            tabIndex={stickyToolbarVisible ? 0 : -1}
          >
            <Grid2x2 size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.toolbarIconBtn}
            onClick={() => navigateTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            aria-label="Câu trước"
            tabIndex={stickyToolbarVisible ? 0 : -1}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.toolbarIconBtn}
            onClick={() => navigateTo(currentIndex + 1)}
            disabled={currentIndex >= totalQuestions - 1}
            aria-label="Câu tiếp theo"
            tabIndex={stickyToolbarVisible ? 0 : -1}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Page shell ── */}
      <div className={styles.pageShell}>
        <div className={styles.workspace}>
          {/* ══════════════ LEFT SIDEBAR ══════════════ */}
          <aside className={styles.leftSidebar} aria-label="Thông tin học tập">
            {/* Progress */}
            <div className={`${styles.card} ${styles.cardPad}`}>
              <h2 className={styles.cardTitle}>
                <TrendingUp size={14} aria-hidden="true" />
                Tiến độ bài
              </h2>
              <div className={styles.progressRow}>
                <div className={styles.progressCircleWrap} aria-hidden="true">
                  <svg width="60" height="60" className={styles.progressCircle}>
                    <circle className={styles.progressCircleBg} cx="30" cy="30" r={circleR} />
                    <circle
                      className={styles.progressCircleFill}
                      cx="30"
                      cy="30"
                      r={circleR}
                      strokeDasharray={circleC}
                      strokeDashoffset={circleDash}
                    />
                  </svg>
                  <div className={styles.progressCircleText}>
                    <span className={styles.progressCirclePercent}>{progressPercent}%</span>
                  </div>
                </div>
                <div className={styles.progressMeta}>
                  <div className={styles.progressFraction}>
                    {answeredCount}/{totalQuestions}
                  </div>
                  <span className={styles.progressFractionLabel}>câu</span>
                </div>
              </div>
              <div className={styles.progressStats} role="list">
                <div
                  className={`${styles.progressStat} ${styles['progressStat--correct']}`}
                  role="listitem"
                  aria-label={`${correctCount} câu đúng`}
                >
                  <span className={styles.progressStatNum}>{correctCount}</span>
                  <span className={styles.progressStatLabel}>Đúng</span>
                </div>
                <div
                  className={`${styles.progressStat} ${styles['progressStat--incorrect']}`}
                  role="listitem"
                  aria-label={`${incorrectCount} câu sai`}
                >
                  <span className={styles.progressStatNum}>{incorrectCount}</span>
                  <span className={styles.progressStatLabel}>Sai</span>
                </div>
                <div
                  className={`${styles.progressStat} ${styles['progressStat--skipped']}`}
                  role="listitem"
                  aria-label={`${remainingCount} câu còn lại`}
                >
                  <span className={styles.progressStatNum}>{remainingCount}</span>
                  <span className={styles.progressStatLabel}>Còn lại</span>
                </div>
              </div>
            </div>
          </aside>

          {/* ══════════════ MAIN CONTENT ══════════════ */}
          <main className={styles.mainContent} id="main-content" tabIndex={-1}>
            {/* ── Compact Lesson Header ── */}
            <div className={`${styles.card} ${styles.lessonHeaderCard}`}>
              <p className={styles.lessonEyebrow}>Toán · {examSet.difficultyLabel}</p>
              <h1 className={styles.lessonTitle}>{examSet.title}</h1>
              <span className={styles.lessonDesc}>{examSet.description}</span>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressBarTrack}
                  role="progressbar"
                  aria-label={`Tiến độ: câu ${currentIndex + 1} trên ${totalQuestions}`}
                  aria-valuemin={0}
                  aria-valuemax={totalQuestions}
                  aria-valuenow={answeredCount}
                >
                  <div
                    className={styles.progressBarFill}
                    style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                  />
                </div>
                <span className={styles.progressBarLabel}>
                  Câu {currentIndex + 1}/{totalQuestions}
                </span>
              </div>
            </div>

            {/* ── Question Card ── */}
            <section
              ref={questionCardRef}
              className={`${styles.card} ${styles.questionCard}`}
              aria-labelledby="question-heading"
            >
              {/* ── In-card question toolbar (primary nav) ── */}
              <div ref={questionToolbarRef} className={styles.questionToolbar}>
                <span className={styles.questionToolbarLabel}>
                  CÂU {currentIndex + 1} / {totalQuestions}
                </span>
                <div className={styles.questionToolbarActions}>
                  <button
                    type="button"
                    className={styles.toolbarTextBtn}
                    onClick={() => setShowQuestionList((v) => !v)}
                    aria-label="Mở danh sách câu"
                    aria-expanded={showQuestionList}
                  >
                    <Grid2x2 size={14} aria-hidden="true" />
                    Danh sách câu
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarIconBtn}
                    onClick={() => navigateTo(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    aria-label="Câu trước"
                  >
                    <ChevronLeft size={17} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.toolbarIconBtn}
                    onClick={() => navigateTo(currentIndex + 1)}
                    disabled={currentIndex >= totalQuestions - 1}
                    aria-label="Câu tiếp theo"
                  >
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Question list popover */}
              <QuestionListPopover
                isOpen={showQuestionList}
                onClose={() => setShowQuestionList(false)}
                totalQuestions={totalQuestions}
                currentIndex={currentIndex}
                answeredMap={session.answeredMap}
                resultMap={session.resultMap}
                onNavigate={navigateTo}
              />

              {/* Question text */}
              <h2 id="question-heading" className={styles.questionText}>
                {activeQuestion.content}
              </h2>

              {/* ── Answer grid ── */}
              <fieldset className={styles.answersGrid}>
                <legend className="sr-only">Chọn một đáp án</legend>
                {activeQuestion.options.map((opt) => {
                  const isSelected = selectedAnswerId === opt.id;
                  const isCorrectOpt = session.submitted && opt.id === activeQuestion.correctAnswer;
                  const isIncorrectOpt =
                    session.submitted && isSelected && opt.id !== activeQuestion.correctAnswer;
                  const optClass = [
                    styles.answerOption,
                    isSelected && !session.submitted ? styles['answerOption--selected'] : '',
                    isCorrectOpt ? styles['answerOption--correct'] : '',
                    isIncorrectOpt ? styles['answerOption--incorrect'] : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <label key={opt.id} className={optClass}>
                      <input
                        type="radio"
                        name={`answer-q${currentIndex}`}
                        value={opt.id}
                        checked={isSelected}
                        disabled={session.submitted}
                        onChange={() => handleSelectAnswer(opt.id)}
                        aria-label={`Đáp án ${opt.id.toUpperCase()}: ${opt.label}`}
                      />
                      <span className={styles.answerKey} aria-hidden="true">
                        {opt.id.toUpperCase()}
                      </span>
                      <span>{opt.label}</span>
                      {isCorrectOpt && (
                        <Check
                          size={17}
                          className={styles.answerStateIcon}
                          aria-label="Đáp án đúng"
                          strokeWidth={2.5}
                        />
                      )}
                      {isIncorrectOpt && (
                        <X
                          size={17}
                          className={styles.answerStateIcon}
                          aria-label="Đáp án sai"
                          strokeWidth={2.5}
                        />
                      )}
                    </label>
                  );
                })}
              </fieldset>

              {/* Validation error */}
              {session.error && (
                <p className={styles.answerError} role="alert">
                  <X size={14} aria-hidden="true" />
                  {session.error}
                </p>
              )}

              {/* Feedback banner */}
              {session.submitted && (
                <div
                  className={[
                    styles.feedbackBanner,
                    isCorrect
                      ? styles['feedbackBanner--correct']
                      : styles['feedbackBanner--incorrect'],
                  ].join(' ')}
                  role="status"
                  aria-live="polite"
                >
                  {isCorrect ? (
                    <Check size={16} className={styles.feedbackIcon} aria-hidden="true" />
                  ) : (
                    <X size={16} className={styles.feedbackIcon} aria-hidden="true" />
                  )}
                  <span>
                    {isCorrect ? (
                      'Chính xác! Câu trả lời của bạn hoàn toàn đúng.'
                    ) : (
                      <>
                        Bạn đã chọn <strong>{selectedAnswerId.toUpperCase()}</strong>. Câu trả lời
                        đúng là <strong>{activeQuestion.correctAnswer.toUpperCase()}</strong>.
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Explanation */}
              {session.submitted && (
                <div className={styles.explanationSection}>
                  <h3 className={styles.explanationTitle}>
                    <BookOpen size={15} aria-hidden="true" />
                    Giải thích chi tiết
                  </h3>
                  <ExplanationBody question={activeQuestion} />

                  {/* Subtle Hỏi thêm — only after explanation */}
                  <div className={styles.askMoreRow}>
                    <span className={styles.askMoreHint}>Vẫn chưa hiểu phần này?</span>
                    <button
                      type="button"
                      className={styles.askMoreBtn}
                      onClick={() => setAiOpen(true)}
                      aria-label="Hỏi thêm với AI trợ giảng"
                    >
                      <Sparkles size={13} aria-hidden="true" />
                      Hỏi thêm
                    </button>
                  </div>
                </div>
              )}

              {/* Primary action */}
              <div className={styles.questionActions}>
                {session.submitted ? (
                  <button
                    type="button"
                    className={styles.btnContinue}
                    onClick={() => navigateTo(currentIndex + 1)}
                    disabled={currentIndex >= totalQuestions - 1}
                    aria-label="Đã hiểu, sang câu tiếp theo"
                  >
                    Đã hiểu → Sang câu tiếp theo
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                ) : mode === 'PRACTICE' ? (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={handleSubmitAnswer}
                    aria-label="Kiểm tra đáp án"
                  >
                    Kiểm tra đáp án
                    <Check size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => navigateTo(currentIndex + 1)}
                    disabled={currentIndex >= totalQuestions - 1}
                    aria-label="Câu tiếp theo"
                  >
                    Câu tiếp theo
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </section>
          </main>

          {/* ══════════════ RIGHT SIDEBAR ══════════════ */}
          <aside className={styles.rightSidebar} aria-label="Tổng quan phiên học">
            <div className={`${styles.card} ${styles.cardPad}`}>
              <h2 className={styles.cardTitle}>
                <Target size={14} aria-hidden="true" />
                Phiên học
              </h2>

              {/* Countdown — primary right sidebar element */}
              <div
                className={[
                  styles.timerRow,
                  timerState === 'warning' ? styles['timerRow--warning'] : '',
                  timerState === 'critical' ? styles['timerRow--critical'] : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="timer"
                aria-label={`Thời gian còn lại: ${formatTime(remainingSeconds)}`}
                aria-live="off"
              >
                <span className={styles.timerRowLabel}>
                  <Clock3
                    size={13}
                    className={[
                      styles.timerRowIcon,
                      timerState === 'critical' ? styles['timerRowIcon--pulse'] : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-hidden="true"
                  />
                  Thời gian còn lại
                </span>
                <span className={styles.timerRowValue}>{formatTime(remainingSeconds)}</span>
              </div>

              <div className={styles.overviewRow}>
                <span className={styles.overviewLabel}>
                  <Zap size={13} aria-hidden="true" />
                  Đã hoàn thành
                </span>
                <span className={styles.overviewValue}>
                  {answeredCount}/{totalQuestions}
                </span>
              </div>
              <div className={styles.overviewRow}>
                <span className={styles.overviewLabel}>
                  <FileText size={13} aria-hidden="true" />
                  Còn lại
                </span>
                <span className={styles.overviewValue}>{remainingCount}</span>
              </div>

              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSubmitClick}
                aria-label="Nộp bài"
              >
                Nộp bài
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* ── AI Panel (right drawer) ── */}
      <AIPanel
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        aiState={aiState}
        aiInput={aiInput}
        aiMessages={aiMessages}
        onInputChange={setAiInput}
        onSend={handleAISend}
        onKeyDown={handleAIKeyDown}
        onQuickPrompt={(p) => void sendAIMessage(p)}
        selectedAnswerId={selectedAnswerId || 'a'}
        submitted={session.submitted}
        question={activeQuestion}
      />

      {/* ── Submit confirmation dialog ── */}
      {showSubmitConfirm && (
        <div
          className={styles.dialogOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-dialog-title"
        >
          <div className={styles.dialogBox}>
            <h2 id="submit-dialog-title" className={styles.dialogTitle}>
              Xác nhận nộp bài
            </h2>
            <p className={styles.dialogBody}>
              Bạn còn <strong>{totalQuestions - answeredCount} câu chưa trả lời</strong>. Bạn có
              chắc muốn nộp bài không?
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogBtnSecondary}
                onClick={() => setShowSubmitConfirm(false)}
                autoFocus
              >
                Làm tiếp
              </button>
              <button type="button" className={styles.dialogBtnDanger} onClick={handleEndSession}>
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
