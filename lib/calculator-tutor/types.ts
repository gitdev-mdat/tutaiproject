import type { KeyId, MODEL, Screen } from './fx570vn-plus';

/** What a step leaves on the screen; checked by the tutorial tests before anything ships. */
export type StepExpectation = {
  screen: Screen;
  /** `screenText` of the state after the step. */
  text: string;
};

export type TutorialStep = {
  id: string;
  title: string;
  /** What the student does, in one sentence. */
  instruction: string;
  keys: KeyId[];
  /** Why, in mathematical terms. May contain `$…$`. */
  explanation: string;
  /** Extra help offered on request or after a wrong key. */
  hint?: string;
  /** A pause after the step: something to notice before going on. */
  checkpoint?: { tone: 'observe' | 'warning'; title: string; body: string };
  expect: StepExpectation;
};

/**
 * A verified, hand-reviewed calculator lesson. It is configuration, written and
 * checked by people (and by `tutorials.test.ts`), never generated from
 * extracted text: AI output is not turned into calculator commands.
 */
export type CalculatorTutorial = {
  id: string;
  model: typeof MODEL;
  /** `$…$` formula of the function entered. */
  functionLatex: string;
  domainLatex: string;
  objective: string;
  steps: TutorialStep[];
  /** What the student may conclude, and what not. May contain `$…$`. */
  conclusion: string[];
  /** Official documents the key sequence was checked against. */
  references: { label: string; url: string }[];
};

/** One line of a worked solution; `emphasis` marks the line that decides the answer. */
export type SolutionLine = { text: string; emphasis?: boolean };

/** A difference between the imported source text and what the tutorial teaches. */
export type SourceNote = {
  tone: 'error' | 'caution' | 'missing';
  text: string;
  /** Only shown when the imported explanation contains this text. */
  when?: string;
};

/**
 * The structured solution of one question: the methods shown separately, and
 * notes on the imported source, which itself stays untouched.
 */
export type SolutionGuide = {
  id: string;
  /** Matching a question bank question to this guide. Any one rule is enough. */
  match: {
    questionIds: string[];
    /** All must hold: same textbook, question number and a stem with this formula. */
    textbook?: { documentTitle: string; questionNumber: string; stemIncludes: string };
  };
  derivative: {
    title: string;
    lines: SolutionLine[];
    /** Sign of y' on each interval of the domain, as a small table. */
    signTable?: {
      /** The x values bounding the intervals, as `$…$`-free LaTeX. */
      breaks: string[];
      /** What y' shows at each break: '' (nothing), '0', or '‖' (undefined). */
      marks: string[];
      signs: ('+' | '−')[];
      trend: ('↗' | '↘')[];
    };
  };
  calculator: CalculatorTutorial;
  source: { label: string; notes: SourceNote[] };
  /** Who verified the guide and against what: shown to Admin. */
  verification: { status: 'VERIFIED'; by: string; on: string; checks: string[] };
};

/** The guide as sent with the feedback of a graded answer: notes already filtered. */
export type SolutionGuidePayload = Omit<SolutionGuide, 'match'>;
