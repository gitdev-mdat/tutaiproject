import type { KeyId, MODEL, Screen } from './fx570vn-plus';
import type { CalculatorDetection } from './detect';

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
  /** Generated lessons: where the step comes from, shown when it is not simply the source. */
  origin?: StepOrigin;
};

/**
 * A calculator lesson the simulation can run key by key (level A). Either
 * written and reviewed by people (the x/ln x reference), or generated from the
 * question by `generate.ts`, in which case every step was replayed on the
 * simulation and its screen recorded before it is shown.
 */
export type CalculatorTutorial = {
  id: string;
  model: typeof MODEL;
  /** `$…$` formula of the function entered. */
  functionLatex: string;
  /** Shown before the lesson starts. May contain `$…$`. */
  intro?: string;
  /** Suggestion for free practice after the lesson. */
  freeHint?: string;
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
  /**
   * Which questions this reviewed guide replaces the generated one for, by content: the
   * function of the TABLE method and the answer choices (in any order). Never by id.
   */
  match: { functionLatex: string; options: string[] };
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

// ------------------------------------------------------------ generated guides

/** How much of a calculator method Tú Tài can show: see `generate.ts`. */
export type GuideLevel = 'A' | 'B' | 'C';

/**
 * Where a step comes from. Only SOURCE and CORRECTED steps are in the book;
 * every other kind is labelled for the student and checked by Admin.
 */
export type StepOrigin =
  /** Written in the source. */
  | 'SOURCE'
  /** In the source, but wrong there (a wrong key, a value outside the domain); fixed and explained. */
  | 'CORRECTED'
  /** Not in the source, but how the declared calculator works (g(X) after f(X)). */
  | 'MODEL'
  /** Taken from the question itself (the function in the stem), because the source shows it as a missing picture. */
  | 'FROM_QUESTION'
  /** Proposed by Tú Tài (a range the source does not give): needs Admin review. */
  | 'PROPOSED'
  /** Values computed by Tú Tài from the formula, not a calculator screen. */
  | 'COMPUTED'
  /** The source refers to something that is not there (a missing picture). */
  | 'MISSING'
  /** The source is unclear: shown as written, with a warning. */
  | 'UNCERTAIN';

/** One learning step of any level. Keys and screens are optional: level C has neither. */
export type GuideStep = {
  id: string;
  title: string;
  /** What the student does. May contain `$…$`. */
  instruction: string;
  /** A formula to show with the step, `$…$`. */
  math?: string;
  explanation?: string;
  /** Keys to highlight (B) or press (A). */
  keys?: KeyId[];
  /** Level A only: the screen the simulation leaves. */
  expect?: StepExpectation;
  /** Values computed from the formula (B), to show as a table instead of a calculator screen. */
  values?: { x: string; y: string }[];
  checkpoint?: TutorialStep['checkpoint'];
  origin: StepOrigin;
  /** The sentence of the source this step comes from, verbatim. */
  source?: string;
};

export type GuideWarning = {
  code: string;
  /** `review`: students do not see the guide until Admin accepts it. */
  severity: 'info' | 'review';
  text: string;
};

/** Admin's decision on a generated guide, stored on the question (no schema change). */
export type CalculatorGuideReview = {
  status: 'ACCEPTED' | 'DISABLED' | 'ORIGINAL_ONLY';
  /** Corrected instructions, by step id. Keys and values are never edited by hand. */
  corrections?: Record<string, string>;
  /** `sourceHash` of the guide reviewed: a later edit of the question resets the decision. */
  sourceHash: string;
  by?: string;
  at: string;
};

/** The guide as sent with the feedback of a graded answer: notes already filtered. */
export type SolutionGuidePayload = {
  id: string;
  level: GuideLevel;
  /** `reference`: the reviewed x/ln x lesson; `generated`: built from the question by `generate.ts`. */
  origin: 'reference' | 'generated';
  /** The first, mathematical method, when the guide has one written out (reference only). */
  derivative?: SolutionGuide['derivative'];
  /** The source text before the calculator method (Cách 1), shown as it is. */
  mathText?: string;
  calculator?: CalculatorTutorial;
  /** Levels B and C: the steps, without a simulation. */
  steps: GuideStep[];
  operation: { id: string; label: string };
  model: { name: string; named: boolean; note: string };
  source: { label: string; notes: SourceNote[] };
  verification: {
    status: 'VERIFIED' | 'GENERATED' | 'ACCEPTED';
    by: string;
    on: string;
    checks: string[];
  };
  /** Admin only. */
  admin?: {
    detection: CalculatorDetection;
    warnings: GuideWarning[];
    sourceHash: string;
    review: CalculatorGuideReview | null;
    visibleToStudents: boolean;
  };
};
