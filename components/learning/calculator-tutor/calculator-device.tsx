'use client';

import * as React from 'react';
import { Pointer } from 'lucide-react';
import {
  formatCell,
  KEYS,
  selectedValue,
  VISIBLE_ROWS,
  formatFull,
  type CalcState,
  type KeyId,
  tokenText,
  type Token,
} from '@/lib/calculator-tutor/fx570vn-plus';

/**
 * The Tú Tài teaching calculator: an LCD and a keypad laid out like a common
 * scientific calculator, with no manufacturer branding or artwork. Only the
 * keys of the TABLE mode do something; the others answer that they are outside
 * the simulation. `highlight` marks keys without simulating them (guided
 * illustrations).
 */

type Layout = { keys: KeyId[]; small?: boolean };

const FUNCTION_ROWS: Layout[] = [
  { keys: ['CALC', 'INTEG', 'POWER', 'SIN', 'COS', 'TAN'], small: true },
  { keys: ['FRAC', 'SQRT', 'SQUARE', 'LOG', 'LN', 'NEG'], small: true },
  { keys: ['RCL', 'ENG', 'LPAREN', 'RPAREN', 'SD', 'MPLUS'], small: true },
];
const MAIN_ROWS: KeyId[][] = [
  ['7', '8', '9', 'DEL', 'AC'],
  ['4', '5', '6', 'TIMES', 'DIVIDE'],
  ['1', '2', '3', 'PLUS', 'MINUS'],
  ['0', 'DOT', 'EXP', 'ANS', 'EQ'],
];

/** Keys of the physical keyboard that press a calculator key. */
export const KEYBOARD: Record<string, KeyId> = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '.': 'DOT',
  ',': 'DOT',
  '+': 'PLUS',
  '-': 'MINUS',
  '*': 'TIMES',
  '/': 'DIVIDE',
  '(': 'LPAREN',
  ')': 'RPAREN',
  Enter: 'EQ',
  '=': 'EQ',
  Backspace: 'DEL',
  Delete: 'DEL',
  Escape: 'AC',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  m: 'MODE',
  M: 'MODE',
  s: 'SHIFT',
  S: 'SHIFT',
  a: 'ALPHA',
  A: 'ALPHA',
  l: 'LN',
  L: 'LN',
  r: 'SQRT',
  R: 'SQRT',
  '^': 'POWER',
  q: 'SQUARE',
  Q: 'SQUARE',
};

const ACCENT: Partial<Record<KeyId, string>> = {
  DEL: 'bg-[#2F5BD3] text-white shadow-[0_2px_0_#1E3F9E]',
  AC: 'bg-[#2F5BD3] text-white shadow-[0_2px_0_#1E3F9E]',
  EQ: 'bg-[#E9EEF7] text-slate-900 shadow-[0_2px_0_#9AA7BD]',
};

function Key({
  id,
  small,
  labels,
  target,
  pointer,
  pressed,
  onPress,
}: {
  id: KeyId;
  small?: boolean;
  /** Whether the row has SHIFT/ALPHA labels above its keys. */
  labels: boolean;
  target: boolean;
  pointer: boolean;
  pressed: boolean;
  onPress: (key: KeyId) => void;
}) {
  const face = KEYS[id];
  const tone =
    ACCENT[id] ??
    (small || ['SHIFT', 'ALPHA', 'MODE', 'ON'].includes(id)
      ? 'bg-[#2A3140] text-slate-100 shadow-[0_2px_0_#11151D]'
      : 'bg-[#E9EEF7] text-slate-900 shadow-[0_2px_0_#9AA7BD]');
  return (
    <div className="relative flex min-w-0 flex-col items-center">
      {labels && (
        <span
          className="flex h-3.5 w-full items-end justify-between px-0.5 text-[9px] leading-none font-bold"
          aria-hidden="true"
        >
          <span className="text-amber-300">{face.shift ?? ''}</span>
          <span className="text-rose-300">{face.alpha ?? ''}</span>
        </span>
      )}
      <button
        type="button"
        onClick={() => onPress(id)}
        aria-label={face.aria}
        data-key={id}
        data-target={target || undefined}
        className={`relative w-full touch-manipulation rounded-[9px] font-semibold transition-[transform,box-shadow,background-color] duration-100 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1B2130] active:translate-y-[2px] active:shadow-none ${
          small ? 'h-8 text-[12px] max-sm:h-7' : 'h-10 text-[15px] max-sm:h-9'
        } ${tone} ${pressed ? 'translate-y-[2px] shadow-none brightness-110' : ''} ${
          target
            ? 'z-10 ring-[3px] ring-amber-300 ring-offset-2 ring-offset-[#1B2130] motion-safe:animate-[calc-glow_1.4s_ease-in-out_infinite]'
            : ''
        }`}
      >
        {face.label}
      </button>
      {pointer && (
        <Pointer
          className="pointer-events-none absolute -right-1.5 -bottom-4 z-20 size-6 rotate-[-18deg] fill-white text-slate-900 drop-shadow motion-safe:animate-[calc-tap_0.9s_ease-in-out_infinite]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function Expression({
  tokens,
  cursor,
  blink,
}: {
  tokens: Token[];
  cursor: number;
  blink: boolean;
}) {
  const parts = tokens.map(tokenText);
  return (
    <span className="break-all">
      {parts.slice(0, cursor).join('')}
      {blink && (
        <span className="inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-slate-900 motion-safe:animate-[calc-blink_1s_steps(1)_infinite]" />
      )}
      {parts.slice(cursor).join('')}
    </span>
  );
}

function Lcd({ state, compact }: { state: CalcState; compact: boolean }) {
  const indicators = (
    <div
      className="flex h-3 items-center gap-2 text-[10px] leading-none font-bold text-slate-700"
      aria-hidden="true"
    >
      <span className={state.shift ? '' : 'opacity-0'}>S</span>
      <span className={state.alpha ? '' : 'opacity-0'}>A</span>
      <span className="ml-auto">Math</span>
    </div>
  );
  let body: React.ReactNode;
  switch (state.screen) {
    case 'COMP':
      body = <div className="mt-auto text-right text-2xl">0</div>;
      break;
    case 'MODE_MENU':
      body = (
        <div className="grid grid-cols-2 gap-x-3 text-[14px] leading-[1.35]">
          {[
            '1:COMP',
            '2:CMPLX',
            '3:STAT',
            '4:BASE-N',
            '5:EQN',
            '6:MATRIX',
            '7:TABLE',
            '8:VECTOR',
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      );
      break;
    case 'F':
    case 'G':
      body = (
        <div className="text-[19px] leading-snug">
          {state.screen === 'F' ? 'f(X)=' : 'g(X)='}
          <Expression
            tokens={state.screen === 'F' ? state.f : state.g}
            cursor={state.cursor}
            blink
          />
        </div>
      );
      break;
    case 'START':
    case 'END':
    case 'STEP': {
      const field = ({ START: 'start', END: 'end', STEP: 'step' } as const)[state.screen];
      body = (
        <>
          <div className="text-[18px]">
            {({ START: 'Start?', END: 'End?', STEP: 'Step?' } as const)[state.screen]}
          </div>
          <div className="mt-auto text-right text-[22px]">
            {state.entry.length ? (
              <Expression tokens={state.entry} cursor={state.cursor} blink />
            ) : (
              formatFull(state[field])
            )}
          </div>
        </>
      );
      break;
    }
    case 'TABLE': {
      const columns = state.hasG ? 3 : 2;
      const visible = state.rows.slice(state.top, state.top + VISIBLE_ROWS);
      body = (
        <div className="flex h-full flex-col">
          <div
            className="grid text-[13px] leading-[1.25]"
            style={{ gridTemplateColumns: `14px repeat(${columns}, minmax(0, 1fr))` }}
            data-testid="calc-table"
          >
            <span />
            {['X', 'F(X)', 'G(X)'].slice(0, columns).map((head) => (
              <span key={head} className="border-b border-slate-700/40 text-center">
                {head}
              </span>
            ))}
            {visible.map((row, offset) => {
              const index = state.top + offset;
              const values = [String(row.x), formatCell(row.f), formatCell(row.g)].slice(
                0,
                columns
              );
              return (
                <React.Fragment key={index}>
                  <span className="text-[9px] text-slate-600 tabular-nums">{index + 1}</span>
                  {values.map((value, col) => {
                    const selected = index === state.row && col === state.col;
                    return (
                      <span
                        key={col}
                        data-row={index}
                        data-col={col}
                        className={`border-l border-slate-700/30 pr-0.5 text-right tabular-nums ${
                          selected ? 'bg-slate-900 text-[#CBD8C3]' : ''
                        } ${value === 'ERROR' ? 'font-bold' : ''}`}
                      >
                        {value}
                      </span>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
          <div className="mt-auto text-right text-[17px] tabular-nums" data-testid="calc-selected">
            {selectedValue(state)}
          </div>
        </div>
      );
      break;
    }
    case 'ERROR':
      body = (
        <div className="text-[14px] leading-snug">
          <div className="text-[17px] font-bold">{state.error}</div>
          <div>[AC] :Cancel</div>
          <div>[◀][▶]:Goto</div>
        </div>
      );
      break;
  }
  return (
    <div
      className={`flex flex-col rounded-lg ${compact ? 'h-[96px]' : 'h-[132px]'} bg-[#CBD8C3] px-3 py-2 font-mono text-slate-900 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]`}
      data-testid="calc-lcd"
      data-screen={state.screen}
    >
      {indicators}
      <div className="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
    </div>
  );
}

export function CalculatorDevice({
  state,
  target,
  pointer,
  pressed,
  onPress,
  caption,
  compact = false,
  highlights = [],
  screen,
  label = 'TABLE',
}: {
  compact?: boolean;
  state: CalcState;
  /** Keys marked without being simulated (guided illustration). */
  highlights?: KeyId[];
  /** Replaces the simulated LCD: an illustration never draws a calculator screen it does not compute. */
  screen?: React.ReactNode;
  /** What the device is, top right. */
  label?: string;
  /** The key to press next, highlighted. */
  target: KeyId | null;
  /** Show the demonstration pointer on the target key. */
  pointer: boolean;
  pressed: KeyId | null;
  onPress: (key: KeyId) => void;
  caption?: React.ReactNode;
}) {
  const key = (id: KeyId, small?: boolean, labels = true) => (
    <Key
      key={id}
      id={id}
      small={small}
      labels={labels}
      target={target === id || highlights.includes(id)}
      pointer={pointer && target === id}
      pressed={pressed === id}
      onPress={onPress}
    />
  );
  const arrow = (id: KeyId, className: string) => (
    <button
      type="button"
      onClick={() => onPress(id)}
      aria-label={KEYS[id].aria}
      data-key={id}
      data-target={target === id || highlights.includes(id) || undefined}
      className={`absolute grid touch-manipulation place-items-center text-[11px] text-slate-200 transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${className} ${
        pressed === id ? 'bg-white/25' : 'hover:bg-white/10'
      } ${target === id || highlights.includes(id) ? 'z-10 rounded-md bg-amber-300/30 ring-[3px] ring-amber-300 motion-safe:animate-[calc-glow_1.4s_ease-in-out_infinite]' : ''}`}
    >
      {KEYS[id].label}
      {pointer && target === id && (
        <Pointer
          className="pointer-events-none absolute -right-3 -bottom-4 z-20 size-6 rotate-[-18deg] fill-white text-slate-900 drop-shadow motion-safe:animate-[calc-tap_0.9s_ease-in-out_infinite]"
          aria-hidden="true"
        />
      )}
    </button>
  );
  return (
    <div
      className={`mx-auto w-full max-w-[340px] bg-gradient-to-b from-[#252C3B] to-[#171C27] ${compact ? 'rounded-[20px] p-2.5 pb-3' : 'rounded-[26px] p-3.5 pb-4'} shadow-[0_18px_40px_-18px_rgba(15,23,42,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] outline-none focus-visible:ring-4 focus-visible:ring-sky-300/60`}
      data-testid="calculator"
      tabIndex={0}
      role="group"
      aria-label="Máy tính mô phỏng. Có thể bấm bằng bàn phím: số, Enter là =, Esc là AC, mũi tên, M là MODE, A là ALPHA, L là ln."
    >
      {!compact && (
        <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold tracking-wide text-slate-400">
          <span>Tú Tài · {screen ? 'Minh hoạ bàn phím' : 'Máy tính mô phỏng'}</span>
          <span>{label}</span>
        </div>
      )}
      {screen ? (
        <div
          className={`flex flex-col justify-center rounded-lg ${compact ? 'min-h-[72px]' : 'min-h-[104px]'} border border-dashed border-slate-500/60 bg-[#1F2633] px-3 py-2 text-slate-100`}
          data-testid="calc-illustration-screen"
        >
          {screen}
        </div>
      ) : (
        <Lcd state={state} compact={compact} />
      )}
      <div
        className="mt-2 min-h-[1.25rem] px-1 text-[11px] leading-snug text-sky-200"
        aria-live="polite"
        data-testid="calc-caption"
      >
        {caption}
      </div>
      <div className="mt-1 grid grid-cols-[1fr_1fr_1.5fr_1fr_1fr] items-center gap-x-2">
        {key('SHIFT')}
        {key('ALPHA')}
        <div className="relative mx-auto mt-2 size-[68px] max-sm:size-[60px] rounded-full bg-[#2A3140] shadow-[0_2px_0_#11151D,inset_0_1px_0_rgba(255,255,255,0.06)]">
          {arrow('UP', 'top-0 left-1/2 h-6 w-9 -translate-x-1/2 rounded-t-full')}
          {arrow('DOWN', 'bottom-0 left-1/2 h-6 w-9 -translate-x-1/2 rounded-b-full')}
          {arrow('LEFT', 'top-1/2 left-0 h-9 w-6 -translate-y-1/2 rounded-l-full')}
          {arrow('RIGHT', 'top-1/2 right-0 h-9 w-6 -translate-y-1/2 rounded-r-full')}
          <span className="absolute inset-[22px] rounded-full bg-[#1B2130]" aria-hidden="true" />
        </div>
        {key('MODE')}
        {key('ON')}
      </div>
      <div className="mt-1.5 space-y-0.5">
        {FUNCTION_ROWS.map((row, index) => (
          <div key={index} className="grid grid-cols-6 gap-x-1.5">
            {row.keys.map((id) => key(id, row.small))}
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-0.5">
        {MAIN_ROWS.map((row, index) => (
          <div key={index} className={`grid grid-cols-5 gap-x-2 ${index ? 'mt-1.5' : ''}`}>
            {row.map((id) =>
              key(
                id,
                false,
                row.some((k) => KEYS[k].shift || KEYS[k].alpha)
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
