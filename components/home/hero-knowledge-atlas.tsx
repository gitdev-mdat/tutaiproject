'use client';

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './hero-knowledge-atlas.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'scan' | 'route' | 'ready' | 'done';

interface ChapterNode {
  id: number;
  label: string;
  sublabel: string;
  status: 'completed' | 'current' | 'future';
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const CHAPTERS: ChapterNode[] = [
  { id: 0, label: 'Chương 1', sublabel: 'Đạo hàm', status: 'completed' },
  { id: 1, label: 'Chương 3', sublabel: 'Tích phân', status: 'completed' },
  { id: 2, label: 'Chương 5', sublabel: 'Hàm số mũ', status: 'current' },
  { id: 3, label: 'Chương 6', sublabel: 'Xác suất', status: 'future' },
  { id: 4, label: 'Chương 8', sublabel: 'Hình không gian', status: 'future' },
  { id: 5, label: 'Chương 9', sublabel: 'Phương trình', status: 'future' },
];

// ─── SVG Path geometry ────────────────────────────────────────────────────────

const PATH_PTS = [
  { x: 0, y: 180 },
  { x: 130, y: 135 },
  { x: 260, y: 195 },
  { x: 410, y: 100 },
  { x: 540, y: 165 },
  { x: 670, y: 118 },
  { x: 810, y: 185 },
  { x: 960, y: 95 },
  { x: 1100, y: 150 },
  { x: 1240, y: 170 },
];

function buildPath(): string {
  let d = `M ${PATH_PTS[0].x} ${PATH_PTS[0].y}`;
  for (let i = 1; i < PATH_PTS.length; i++) {
    const a = PATH_PTS[i - 1];
    const b = PATH_PTS[i];
    d += ` C ${a.x + (b.x - a.x) * 0.5} ${a.y}, ${b.x - (b.x - a.x) * 0.5} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

function samplePath(t: number): { x: number; y: number } {
  const segs = PATH_PTS.length - 1;
  const s = Math.min(Math.floor(t * segs), segs - 1);
  const lt = t * segs - s;
  const p0 = PATH_PTS[Math.max(0, s - 1)];
  const p1 = PATH_PTS[s];
  const p2 = PATH_PTS[Math.min(PATH_PTS.length - 1, s + 1)];
  const p3 = PATH_PTS[Math.min(PATH_PTS.length - 1, s + 2)];
  const c1x = p1.x + (p2.x - p0.x) / 6;
  const c1y = p1.y + (p2.y - p0.y) / 6;
  const c2x = p2.x - (p3.x - p1.x) / 6;
  const c2y = p2.y - (p3.y - p1.y) / 6;
  const mt = 1 - lt;
  return {
    x: mt ** 3 * p1.x + 3 * mt ** 2 * lt * c1x + 3 * mt * lt ** 2 * c2x + lt ** 3 * p2.x,
    y: mt ** 3 * p1.y + 3 * mt ** 2 * lt * c1y + 3 * mt * lt ** 2 * c2y + lt ** 3 * p2.y,
  };
}

const NODE_T = [0.04, 0.22, 0.42, 0.6, 0.78, 0.92];
const NODES = CHAPTERS.map((ch, i) => {
  const pt = samplePath(NODE_T[i]);
  return { ...ch, x: pt.x, y: pt.y };
});
const DEST = samplePath(1.0);

// ─── Atlas background ─────────────────────────────────────────────────────────

const ATLAS_PATHS = [
  `M -20 70  C 100 25, 230 100, 350 55  C 480 10, 610 80, 740 35  C 870 -10, 1000 60, 1260 25`,
  `M -20 125 C 90 80, 200 155, 340 110 C 480 65, 600 135, 750 90  C 900 45, 1020 115, 1260 80`,
  `M -20 190 C 130 145, 240 220, 400 175 C 560 130, 690 200, 850 155 C 1010 110, 1130 180, 1260 145`,
  `M -20 255 C 70 210, 180 285, 340 240 C 500 195, 630 265, 790 220 C 950 175, 1070 245, 1260 210`,
  `M 0 55   C 160 12, 280 90, 450 45  C 620 0,  730 65, 900 25  C 1070 -15, 1180 45, 1280 15`,
];

const PARTICLES = Array.from({ length: 58 }, (_, i) => ({
  id: i,
  x: (i * 73 + 23) % 1260,
  y: (i * 41 + 31) % 360,
  r: 0.8 + (i % 3) * 0.45,
  op: 0.16 + (i % 5) * 0.07,
}));

const EQUATIONS = [
  { text: '∫f(x)dx', x: 65, y: 38, op: 0.03, sz: 12 },
  { text: '∂²y/∂x²', x: 1100, y: 68, op: 0.026, sz: 11 },
  { text: 'P(A∪B)', x: 200, y: 265, op: 0.022, sz: 10 },
  { text: 'lim x→0', x: 880, y: 235, op: 0.026, sz: 10 },
  { text: 'Σₖ₌₁ⁿ', x: 580, y: 28, op: 0.024, sz: 11 },
  { text: 'V = 4/3πr³', x: 1030, y: 215, op: 0.02, sz: 9 },
];

// ─── Easing ────────────────────────────────────────────────────────────────────

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}
function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}
function easeInOutQuart(t: number) {
  return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2;
}

// ─── Reduced motion hook ───────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange: () => void) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', onStoreChange);
      return () => mq.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  );
}

// ─── Animation timeline constants ──────────────────────────────────────────────

const REVEAL_MS = {
  ATLAS: 0,
  ATLAS_END: 350,
  LINE1: 400,
  LINE1_END: 750,
  LINE2: 800,
  LINE2_END: 1150,
  UNDERLINE: 1600,
  UNDERLINE_END: 2100,
  SCAN_START: 200,
  SCAN_END: 1500,
  ROUTE_START: 1300,
  ROUTE_END: 3000,
  READY: 2800,
  DONE: 3500,
  LIGHT_START: 3800,
};

// ─── Feature flag ──────────────────────────────────────────────────────────────
// Toggle between "path" (animated SVG learning path) and "graduated" (hero image).
// Change to "path" to restore the old visualization instantly.
const HERO_VISUAL_VARIANT: 'path' | 'graduated' = 'graduated';

// ─── Sub-components ────────────────────────────────────────────────────────────

function PathVisualization({
  visibleNodes,
  scanPt,
  scanT,
  drawT,
  lightT,
  showDest,
  hoveredIdx,
  setHoveredIdx,
  phase,
}: {
  visibleNodes: ReturnType<typeof NODES.slice>;
  scanPt: { x: number; y: number };
  scanT: number;
  drawT: number;
  lightT: number;
  showDest: boolean;
  hoveredIdx: number | null;
  setHoveredIdx: (id: number | null) => void;
  phase: Phase;
}) {
  const PATH = buildPath();
  const lightPt = samplePath(lightT);

  return (
    <svg
      viewBox="0 0 1280 360"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      style={{ overflow: 'visible' }}
      aria-label="Lộ trình học cá nhân hoá — hệ thống đang phân tích và tạo lộ trình"
    >
      <defs>
        <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0052FF" stopOpacity="0.2" />
          <stop offset="30%" stopColor="#0052FF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0052FF" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0052FF" stopOpacity="0" />
          <stop offset="40%" stopColor="#0052FF" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#0052FF" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="sg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0052FF" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0052FF" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#0052FF" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0052FF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
        </radialGradient>
        <filter id="bloom" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nglow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <mask id="lightMask">
          <rect x="0" y="0" width="1280" height="360" fill="black" />
          <circle cx={lightPt.x} cy={lightPt.y} r="100" fill="white" />
        </mask>
      </defs>

      <path
        d={PATH}
        stroke="rgba(0,82,255,0.04)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={PATH}
        stroke="url(#pg)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="2800"
        strokeDashoffset={2800 * (1 - drawT)}
        style={{ transition: drawT === 0 ? 'none' : 'stroke-dashoffset 0.05s linear' }}
      />

      {phase === 'done' && (
        <path
          d={PATH}
          stroke="url(#lg)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          mask="url(#lightMask)"
          opacity="0.55"
        />
      )}

      {scanT > 0.01 && scanT < 0.99 && (
        <>
          <ellipse cx={scanPt.x} cy={scanPt.y} rx="55" ry="40" fill="url(#sg)" opacity="0.9" />
          <circle cx={scanPt.x} cy={scanPt.y} r="4" fill="#0052FF" opacity="0.95" />
          <line
            x1="0"
            y1={scanPt.y}
            x2={scanPt.x}
            y2={scanPt.y}
            stroke="#0052FF"
            strokeWidth="0.75"
            strokeDasharray="5 6"
            opacity="0.18"
          />
          <g opacity={0.78}>
            <rect
              x={scanPt.x - 68}
              y={scanPt.y - 28}
              width="136"
              height="22"
              rx="11"
              fill="rgba(0,82,255,0.07)"
              stroke="rgba(0,82,255,0.14)"
              strokeWidth="0.75"
            />
            <text
              x={scanPt.x}
              y={scanPt.y - 11}
              textAnchor="middle"
              fontSize="9"
              fill="#0052FF"
              fontWeight="500"
            >
              hệ thống đang phân tích lộ trình…
            </text>
          </g>
        </>
      )}

      {visibleNodes.map((ch) => {
        const isHov = hoveredIdx === ch.id;
        const isDone = ch.status === 'completed';
        const isCurr = ch.status === 'current';
        const isFut = ch.status === 'future';

        return (
          <g
            key={ch.id}
            style={{
              cursor: 'pointer',
              transform: `scale(${isHov ? 1.25 : 1})`,
              transformOrigin: `${ch.x}px ${ch.y}px`,
              transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onMouseEnter={() => setHoveredIdx(ch.id)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {isHov && <circle cx={ch.x} cy={ch.y} r="22" fill="url(#hg)" opacity="0.7" />}
            {isCurr && (
              <circle
                cx={ch.x}
                cy={ch.y}
                r="18"
                fill="rgba(0,82,255,0.1)"
                className={phase === 'done' ? 'animate-node-pulse' : 'animate-node-pulse-active'}
              />
            )}
            {isCurr && (
              <g>
                <rect
                  x={ch.x - 26}
                  y={ch.y + 16}
                  width="52"
                  height="15"
                  rx="7.5"
                  fill="rgba(0,82,255,0.08)"
                  stroke="rgba(0,82,255,0.15)"
                  strokeWidth="0.75"
                />
                <text
                  x={ch.x}
                  y={ch.y + 27}
                  textAnchor="middle"
                  fontSize="7.5"
                  fill="#0052FF"
                  fontWeight="600"
                >
                  Đang học
                </text>
              </g>
            )}
            <circle
              cx={ch.x}
              cy={ch.y}
              r={isCurr ? 8 : 6}
              fill={isDone ? '#00C896' : isCurr ? '#0052FF' : '#FFFFFF'}
              stroke={isDone ? '#00C896' : isCurr ? '#0052FF' : '#B8D4FF'}
              strokeWidth={isFut ? 1.75 : 0}
              filter={isCurr ? 'url(#nglow)' : undefined}
            />
            {isDone && (
              <path
                d={`M ${ch.x - 3.5} ${ch.y} l 3 3 l 6 -6`}
                stroke="white"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
            {isCurr && <circle cx={ch.x} cy={ch.y} r="3" fill="white" />}
            {isHov || isCurr ? (
              <>
                <text
                  x={ch.x}
                  y={ch.y - 15}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={isCurr ? '#0052FF' : '#091224'}
                >
                  {ch.label}
                </text>
                <text x={ch.x} y={ch.y - 4} textAnchor="middle" fontSize="9" fill="#5F6E8A">
                  {ch.sublabel}
                </text>
              </>
            ) : (
              <>
                <text
                  x={ch.x}
                  y={ch.y - 12}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="#091224"
                  opacity="0.55"
                >
                  {ch.label}
                </text>
                <text
                  x={ch.x}
                  y={ch.y - 1}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#5F6E8A"
                  opacity="0.5"
                >
                  {ch.sublabel}
                </text>
              </>
            )}
          </g>
        );
      })}

      {showDest && (
        <g>
          <circle
            cx={DEST.x}
            cy={DEST.y}
            r="48"
            fill="url(#dg)"
            filter="url(#bloom)"
            className="animate-dest-breathe"
          />
          <circle cx={DEST.x} cy={DEST.y} r="28" fill="rgba(0,82,255,0.06)" />
          <circle cx={DEST.x} cy={DEST.y} r="14" fill="#0052FF" filter="url(#nglow)" />
          <path
            d={`M ${DEST.x - 6} ${DEST.y} l 3 4.5 l 5 0.5 l -5 1.5 l -3 4.5 l -3 -4.5 l -5 -1.5 l 5 -0.5 z`}
            fill="white"
            opacity="0.95"
          />
          <text
            x={DEST.x}
            y={DEST.y + 32}
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fill="#0052FF"
            letterSpacing="0.05em"
          >
            ĐẠT 8.5+
          </text>
        </g>
      )}
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function HeroKnowledgeAtlas() {
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [scanT, setScanT] = useState(0);
  const [drawT, setDrawT] = useState(0);
  const [nodeMask, setNodeMask] = useState(0);
  const [showDest, setShowDest] = useState(false);
  const [atlasOp, setAtlasOp] = useState(0);
  const [lightT, setLightT] = useState(0);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lightRafRef = useRef<number>(0);
  const isMounted = useRef(false);

  const scanPt = samplePath(scanT);
  const visibleNodes = NODES.slice(0, nodeMask);
  const hoverNode = hoveredIdx !== null ? NODES[hoveredIdx] : null;

  // Mark mounted
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ── Main animation timeline ──
  const startAnim = useCallback(() => {
    const t0 = performance.now();

    function tick(now: number) {
      const ms = now - t0;

      if (ms < REVEAL_MS.ATLAS_END) {
        setAtlasOp(easeOutCubic(ms / REVEAL_MS.ATLAS_END));
      }

      if (ms >= REVEAL_MS.SCAN_START && ms < REVEAL_MS.SCAN_END) {
        const t = (ms - REVEAL_MS.SCAN_START) / (REVEAL_MS.SCAN_END - REVEAL_MS.SCAN_START);
        setScanT(easeOutExpo(t));
        setPhase('scan');
      }

      if (ms >= REVEAL_MS.ROUTE_START && ms < REVEAL_MS.ROUTE_END) {
        const t = (ms - REVEAL_MS.ROUTE_START) / (REVEAL_MS.ROUTE_END - REVEAL_MS.ROUTE_START);
        setDrawT(easeInOutCubic(t));
        setPhase('route');
        setNodeMask(Math.min(Math.floor(easeInOutCubic(t) * 7), 6));
      }

      if (ms >= REVEAL_MS.READY) {
        setNodeMask(6);
        if (ms >= REVEAL_MS.READY + 200) {
          setShowDest(true);
          setPhase(ms >= REVEAL_MS.DONE ? 'done' : 'ready');
        }
      }

      if (ms >= REVEAL_MS.DONE) {
        setPhase('done');
        cancelAnimationFrame(rafRef.current);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Ambient traveling light animation ──
  const startLightAnim = useCallback(() => {
    let dir = 1;
    let t = 0;
    let lastTime = performance.now();

    function tickLight(now: number) {
      const dt = Math.min((now - lastTime) / 4000, 0.05);
      lastTime = now;
      t += dt * dir;
      if (t >= 1) {
        t = 1;
        dir = -1;
      }
      if (t <= 0) {
        t = 0;
        dir = 1;
      }
      setLightT(easeInOutQuart(t));
      lightRafRef.current = requestAnimationFrame(tickLight);
    }

    lightRafRef.current = requestAnimationFrame(tickLight);
  }, []);

  // ── Trigger on intersection ──
  useEffect(() => {
    if (!isMounted.current) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          timerRef.current.push(setTimeout(startAnim, 80));
          timerRef.current.push(setTimeout(startLightAnim, REVEAL_MS.LIGHT_START));
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(lightRafRef.current);
      const timers = timerRef.current;
      timerRef.current = [];
      timers.forEach(clearTimeout);
    };
  }, [startAnim, startLightAnim]);

  // ── Mouse parallax ──
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      setParallax({
        x: ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 8,
        y: ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 8,
      });
    };
    el.addEventListener('mousemove', onMove as EventListener);
    return () => el.removeEventListener('mousemove', onMove as EventListener);
  }, []);

  return (
    <div ref={containerRef} className={`${styles.hero} relative w-full overflow-hidden`}>
      {/* ── Layer 1: Ambient radial glow ── */}
      <div
        className={`${styles.ambientGlow} pointer-events-none absolute inset-0 z-0`}
        aria-hidden="true"
        style={{
          transform: `translate(${parallax.x * 0.45}px, ${parallax.y * 0.45}px)`,
          transition: 'transform 1.6s cubic-bezier(0.22,1,0.36,1)',
        }}
      />

      {/* ── Layer 2: Atlas background ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
        style={{
          transform: `translate(${parallax.x * 0.1}px, ${parallax.y * 0.1}px)`,
          transition: 'transform 2.5s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <svg viewBox="0 0 1280 360" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
          <defs>
            <linearGradient id="hlFade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#071426" stopOpacity="0.85" />
              <stop offset="48%" stopColor="#071426" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#071426" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ATLAS_PATHS.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="#0052FF"
              strokeWidth={i < 2 ? 0.45 : 0.28}
              fill="none"
              strokeLinecap="round"
              opacity={0.025}
            />
          ))}
          {PARTICLES.map((p) => (
            <circle key={p.id} cx={p.x} cy={p.y} r={p.r} fill="#0052FF" opacity={p.op * atlasOp} />
          ))}
          {EQUATIONS.map((eq, i) => (
            <text
              key={i}
              x={eq.x}
              y={eq.y}
              textAnchor="middle"
              fontSize={eq.sz}
              fill="#0052FF"
              fontFamily="Georgia,serif"
              opacity={eq.op * atlasOp}
              style={{ userSelect: 'none' }}
            >
              {eq.text}
            </text>
          ))}
          <rect x="0" y="0" width="480" height="360" fill="url(#hlFade)" />
        </svg>
      </div>

      {/* ── Main layout ── */}
      <div className={`${styles.inner} relative z-10 mx-auto w-full`}>
        <div className={styles.layout}>
          {/* ── Left column ── */}
          <div
            className={`${styles.copy} flex flex-col`}
            style={{
              transform: `translateY(${parallax.y * -0.55}px)`,
              transition: 'transform 2.2s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            {/* Badge */}
            <div className={`${styles.badge} ${!reducedMotion ? 'hero-badge' : ''}`}>
              <span className={styles.badgeDot} />
              <span className={styles.badgeText}>Lộ trình cá nhân hoá cho học sinh lớp 12</span>
            </div>

            {/* Headline — 3-line premium composition */}
            <div className={styles.headlineClip}>
              <h1 className={styles.headline}>
                {/* Line 1: Chinh phục */}
                <span className={`${styles.headlineLine} ${!reducedMotion ? 'hero-line-1' : ''}`}>
                  Chinh phục
                </span>

                {/* Line 2: mục tiêu 9+ */}
                <span className={`${styles.headlineLine} ${!reducedMotion ? 'hero-line-2' : ''}`}>
                  mục tiêu <span className={`${styles.gradientText} ${styles.score}`}>9+</span>
                </span>

                {/* Line 3: THPT Quốc Gia */}
                <span
                  className={`${styles.headlineLine} ${styles.gradientText} ${!reducedMotion ? 'hero-line-3' : ''}`}
                >
                  THPT Quốc Gia
                </span>
              </h1>
            </div>

            {/* Description */}
            <p className={styles.description}>
              Tú Tài xây dựng lộ trình học theo năng lực và mục tiêu của từng em, giúp việc ôn tập
              rõ ràng, đúng trọng tâm và tiến bộ từng ngày.
            </p>

            {/* CTAs */}
            <div className={styles.actions}>
              <Link
                href="/auth/register"
                className={`${styles.primaryCta} group flex items-center gap-3 rounded-full font-semibold text-white`}
                style={{
                  height: '52px',
                  paddingLeft: '30px',
                  paddingRight: '30px',
                  background: 'linear-gradient(135deg, #0052FF 0%, #1448E0 100%)',
                  boxShadow: '0 8px 24px rgba(0,82,255,0.16), 0 2px 8px rgba(0,82,255,0.08)',
                  fontSize: '15px',
                  transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s ease',
                  letterSpacing: '-0.01em',
                  willChange: 'transform',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 14px 36px rgba(0,82,255,0.22), 0 4px 12px rgba(0,82,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 8px 24px rgba(0,82,255,0.16), 0 2px 8px rgba(0,82,255,0.08)';
                }}
              >
                Xây lộ trình của em
                <ArrowRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>

              <a
                href="#roadmap"
                className={`${styles.secondaryCta} group flex items-center gap-1.5 text-sm font-medium`}
                style={{
                  color: 'rgba(160,190,230,0.75)',
                  transition: 'color 0.18s ease',
                  padding: '6px 2px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#7BB3FF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(160,190,230,0.75)';
                }}
              >
                Xem lộ trình mẫu
                <ArrowRight
                  size={13}
                  className="transition-transform duration-150 group-hover:translate-x-0.5"
                />
              </a>
            </div>

            {/* Trust principles */}
            <div className={styles.trustRow}>
              {['Theo chương trình Bộ GD&ĐT', 'Không kiểm tra phần chưa học'].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <svg
                    viewBox="0 0 14 14"
                    fill="none"
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  >
                    <circle cx="7" cy="7" r="6.5" fill="rgba(0,200,150,0.15)" />
                    <path
                      d="M4 7l2.5 2.5 4.5-5"
                      stroke="#00C896"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className={styles.trustText}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: visual column ── */}
          <div
            className={styles.visual}
            style={{
              transform: `translate(${parallax.x * 0.3}px, ${parallax.y * 0.3}px)`,
              transition: 'transform 2.4s cubic-bezier(0.22,1,0.36,1)',
            }}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {HERO_VISUAL_VARIANT === 'path' ? (
              /* ── Animated SVG path ── */
              <PathVisualization
                visibleNodes={visibleNodes}
                scanPt={scanPt}
                scanT={scanT}
                drawT={drawT}
                lightT={lightT}
                showDest={showDest}
                hoveredIdx={hoveredIdx}
                setHoveredIdx={setHoveredIdx}
                phase={phase}
              />
            ) : (
              /* ── Knowledge Graph Hero Illustration — desktop ── */
              <div className={styles.visualCluster}>
                {/* ── Layer 0: Outer atmospheric glow ── */}
                <div
                  className={`${styles.clusterGlow} pointer-events-none absolute inset-0 z-0`}
                  aria-hidden="true"
                  style={{
                    background:
                      'radial-gradient(ellipse 90% 90% at 50% 50%, rgba(0,82,255,0.09) 0%, rgba(0,82,255,0.03) 45%, transparent 70%)',
                  }}
                />

                {/* ── Layer 1: Knowledge constellation SVG ── */}
                <svg
                  viewBox="0 0 520 480"
                  className="pointer-events-none absolute z-[1]"
                  style={{
                    width: '82%',
                    height: '85%',
                    left: '9%',
                    top: '7%',
                    opacity: atlasOp * 0.6,
                  }}
                  aria-hidden="true"
                  fill="none"
                >
                  <defs>
                    <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#0052FF" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="nodeGlowGreen" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#00C896" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#00C896" stopOpacity="0" />
                    </radialGradient>
                    <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="4" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* ── Connection lines (all subtle, low opacity) ── */}
                  {/* Network from left area */}
                  <line
                    x1="38"
                    y1="95"
                    x2="145"
                    y2="180"
                    stroke="#0052FF"
                    strokeWidth="1"
                    strokeOpacity="0.18"
                    strokeLinecap="round"
                  />
                  <line
                    x1="38"
                    y1="95"
                    x2="82"
                    y2="310"
                    stroke="#0052FF"
                    strokeWidth="0.75"
                    strokeOpacity="0.14"
                    strokeLinecap="round"
                  />
                  <line
                    x1="145"
                    y1="180"
                    x2="82"
                    y2="310"
                    stroke="#0052FF"
                    strokeWidth="1"
                    strokeOpacity="0.16"
                    strokeLinecap="round"
                  />
                  <line
                    x1="145"
                    y1="180"
                    x2="235"
                    y2="120"
                    stroke="#0052FF"
                    strokeWidth="0.75"
                    strokeOpacity="0.12"
                    strokeLinecap="round"
                  />
                  <line
                    x1="145"
                    y1="180"
                    x2="285"
                    y2="240"
                    stroke="#0052FF"
                    strokeWidth="1.25"
                    strokeOpacity="0.2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="82"
                    y1="310"
                    x2="195"
                    y2="380"
                    stroke="#0052FF"
                    strokeWidth="0.75"
                    strokeOpacity="0.12"
                    strokeLinecap="round"
                  />
                  <line
                    x1="195"
                    y1="380"
                    x2="285"
                    y2="240"
                    stroke="#0052FF"
                    strokeWidth="1"
                    strokeOpacity="0.16"
                    strokeLinecap="round"
                  />
                  <line
                    x1="285"
                    y1="240"
                    x2="195"
                    y2="380"
                    stroke="#0052FF"
                    strokeWidth="1"
                    strokeOpacity="0.14"
                    strokeLinecap="round"
                  />

                  {/* Network right side */}
                  <line
                    x1="380"
                    y1="78"
                    x2="285"
                    y2="240"
                    stroke="#0052FF"
                    strokeWidth="0.75"
                    strokeOpacity="0.12"
                    strokeLinecap="round"
                  />
                  <line
                    x1="380"
                    y1="78"
                    x2="440"
                    y2="195"
                    stroke="#0052FF"
                    strokeWidth="1"
                    strokeOpacity="0.16"
                    strokeLinecap="round"
                  />
                  <line
                    x1="440"
                    y1="195"
                    x2="285"
                    y2="240"
                    stroke="#0052FF"
                    strokeWidth="1.25"
                    strokeOpacity="0.2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="440"
                    y1="195"
                    x2="390"
                    y2="350"
                    stroke="#0052FF"
                    strokeWidth="0.75"
                    strokeOpacity="0.12"
                    strokeLinecap="round"
                  />
                  <line
                    x1="285"
                    y1="240"
                    x2="390"
                    y2="350"
                    stroke="#0052FF"
                    strokeWidth="1"
                    strokeOpacity="0.14"
                    strokeLinecap="round"
                  />
                  <line
                    x1="390"
                    y1="350"
                    x2="195"
                    y2="380"
                    stroke="#0052FF"
                    strokeWidth="0.75"
                    strokeOpacity="0.1"
                    strokeLinecap="round"
                  />

                  {/* Animated travel highlights — one or two paths fire occasionally */}
                  {!reducedMotion && (
                    <>
                      <path
                        d="M 145 180 Q 215 155 285 240"
                        stroke="#5B9BFF"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray="4 8"
                        style={{
                          animation: 'hero-path-travel 8s ease-in-out infinite 4s',
                          opacity: 0.6,
                        }}
                      />
                    </>
                  )}

                  {/* ── Nodes (pulsing at different intervals) ── */}
                  {/* Top-left node cluster */}
                  <circle
                    cx="38"
                    cy="95"
                    r="6"
                    fill="url(#nodeGlow)"
                    opacity="0.55"
                    style={
                      !reducedMotion
                        ? { animation: 'hero-node-pulse 5.5s ease-in-out infinite 0.3s' }
                        : undefined
                    }
                  />
                  <circle cx="38" cy="95" r="2.5" fill="#0052FF" opacity="0.9" />

                  <circle
                    cx="145"
                    cy="180"
                    r="9"
                    fill="url(#nodeGlowGreen)"
                    opacity="0.45"
                    style={
                      !reducedMotion
                        ? { animation: 'hero-node-pulse 6.5s ease-in-out infinite 1.2s' }
                        : undefined
                    }
                  />
                  <circle cx="145" cy="180" r="3.5" fill="#00C896" opacity="0.95" />
                  {/* Checkmark inside completed node */}
                  <path
                    d={`M ${145 - 3} ${180} l 2.5 2.5 4.5-4.5`}
                    stroke="white"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity="0.9"
                  />

                  <circle cx="82" cy="310" r="7" fill="url(#nodeGlow)" opacity="0.4" />
                  <circle cx="82" cy="310" r="3" fill="#0052FF" opacity="0.85" />

                  <circle cx="235" cy="120" r="5" fill="url(#nodeGlow)" opacity="0.35" />
                  <circle cx="235" cy="120" r="2" fill="#0052FF" opacity="0.7" />

                  {/* Center-ish: current learning node (larger, pulsing) */}
                  <circle
                    cx="285"
                    cy="240"
                    r="18"
                    fill="url(#nodeGlow)"
                    opacity="0.35"
                    style={
                      !reducedMotion
                        ? { animation: 'hero-node-pulse 4s ease-in-out infinite 0s' }
                        : undefined
                    }
                  />
                  <circle cx="285" cy="240" r="12" fill="rgba(0,82,255,0.08)" />
                  <circle cx="285" cy="240" r="7" fill="#0052FF" opacity="0.95" />
                  <circle cx="285" cy="240" r="3" fill="white" opacity="0.9" />

                  {/* Top-right cluster */}
                  <circle cx="380" cy="78" r="5" fill="url(#nodeGlow)" opacity="0.4" />
                  <circle cx="380" cy="78" r="2" fill="#0052FF" opacity="0.75" />

                  {/* Bottom cluster */}
                  <circle cx="195" cy="380" r="5.5" fill="url(#nodeGlow)" opacity="0.38" />
                  <circle cx="195" cy="380" r="2.2" fill="#0052FF" opacity="0.8" />

                  <circle cx="390" cy="350" r="4.5" fill="url(#nodeGlow)" opacity="0.32" />
                  <circle cx="390" cy="350" r="1.8" fill="#0052FF" opacity="0.7" />

                  {/* Floating mini-nodes (ambient particles) — some drift slowly */}
                  <circle
                    cx="160"
                    cy="60"
                    r="3"
                    fill="#0052FF"
                    opacity="0.25"
                    style={
                      !reducedMotion
                        ? { animation: 'hero-particle-drift 12s ease-in-out infinite 0s' }
                        : undefined
                    }
                  />
                  <circle
                    cx="310"
                    cy="55"
                    r="2"
                    fill="#0052FF"
                    opacity="0.2"
                    style={
                      !reducedMotion
                        ? { animation: 'hero-particle-drift 15s ease-in-out infinite 2s' }
                        : undefined
                    }
                  />
                  <circle cx="480" cy="280" r="2.5" fill="#0052FF" opacity="0.18" />
                  <circle cx="20" cy="240" r="2" fill="#0052FF" opacity="0.18" />
                  <circle cx="500" cy="430" r="2" fill="#0052FF" opacity="0.15" />
                  <circle
                    cx="55"
                    cy="420"
                    r="2.5"
                    fill="#0052FF"
                    opacity="0.18"
                    style={
                      !reducedMotion
                        ? { animation: 'hero-particle-drift 10s ease-in-out infinite 4s' }
                        : undefined
                    }
                  />

                  {/* Dashed orbital ring around current node */}
                  <circle
                    cx="285"
                    cy="240"
                    r="24"
                    stroke="#0052FF"
                    strokeWidth="0.75"
                    strokeOpacity="0.3"
                    strokeDasharray="3 4"
                    fill="none"
                  />
                </svg>

                {/* ── Layer 2: Student image ── */}
                <div className={`${styles.studentWrap} ${!reducedMotion ? 'hero-float' : ''}`}>
                  {/* Light aura behind the image */}
                  <div
                    className={`${styles.studentAura} ${!reducedMotion ? 'hero-aura-breathe' : ''}`}
                    aria-hidden="true"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/graduated.png"
                    alt="Học sinh hoàn thành lộ trình cá nhân trên Tú Tài"
                    className={styles.studentImage}
                  />
                </div>

                {/* ── Layer 3: Insight floating widgets ── */}

                {/* Widget 1: Đánh giá kiến thức */}
                <div
                  className={`${styles.glassCard} ${styles.cardAssessment} ${!reducedMotion ? 'hero-card-1 hero-card-f1' : ''}`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    {/* Star icon */}
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M6 1L7.2 4.4L10.5 4.5L8.2 6.9L9.1 10.3L6 8.3L2.9 10.3L3.8 6.9L1.5 4.5L4.8 4.4L6 1Z"
                        fill="#6BAAFF"
                      />
                    </svg>
                    <span
                      className="text-[10px] font-semibold uppercase"
                      style={{ color: '#6BAAFF', letterSpacing: '0.07em' }}
                    >
                      Đã đánh giá
                    </span>
                  </div>
                  <div
                    className="text-[14px] font-bold tracking-tight leading-tight"
                    style={{ color: '#FFFFFF' }}
                  >
                    12 chương
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'rgba(160,190,230,0.7)' }}>
                    kiến thức lớp 12
                  </div>
                  <div
                    className="mt-3 h-1 w-full overflow-hidden rounded-full"
                    style={{ background: 'rgba(0,82,255,0.18)' }}
                  >
                    <div
                      className="h-full rounded-full animate-progress-slow"
                      style={{
                        width: '78%',
                        background: 'linear-gradient(90deg, #0052FF, #6BAAFF)',
                      }}
                    />
                  </div>
                </div>

                {/* Widget 2: Mục tiêu học tập */}
                <div
                  className={`${styles.glassCard} ${styles.cardGoal} ${!reducedMotion ? 'hero-card-2 hero-card-f2' : ''}`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M6 1L7.2 4.4L10.5 4.5L8.2 6.9L9.1 10.3L6 8.3L2.9 10.3L3.8 6.9L1.5 4.5L4.8 4.4L6 1Z"
                        fill="#00C896"
                      />
                    </svg>
                    <span
                      className="text-[10px] font-semibold uppercase"
                      style={{ color: '#00C896', letterSpacing: '0.07em' }}
                    >
                      Mục tiêu học tập
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-[22px] font-bold tracking-tight"
                      style={{ color: '#FFFFFF' }}
                    >
                      8.5+
                    </span>
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: 'rgba(160,190,230,0.7)' }}
                    >
                      điểm thi
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="size-1 rounded-full" style={{ background: '#00C896' }} />
                    <span className="text-[10px]" style={{ color: '#00C896' }}>
                      Phù hợp với lực học hiện tại
                    </span>
                  </div>
                </div>

                {/* Widget 3: Lộ trình tiếp theo */}
                <div
                  className={`${styles.glassCard} ${styles.cardRoadmap} ${!reducedMotion ? 'hero-card-3 hero-card-f3' : ''}`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M6 1L7.2 4.4L10.5 4.5L8.2 6.9L9.1 10.3L6 8.3L2.9 10.3L3.8 6.9L1.5 4.5L4.8 4.4L6 1Z"
                        fill="#6BAAFF"
                      />
                    </svg>
                    <span
                      className="text-[10px] font-semibold uppercase"
                      style={{ color: '#6BAAFF', letterSpacing: '0.07em' }}
                    >
                      Lộ trình tiếp theo
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="flex size-5 items-center justify-center rounded-full border-2 border-white/20 text-[7px] font-bold text-white"
                          style={{ background: ['#0052FF', '#00C896', '#4F8EF7'][i] }}
                        >
                          {['', 'ĐH', 'HN'][i]}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div
                        className="text-[13px] font-semibold leading-tight"
                        style={{ color: '#FFFFFF' }}
                      >
                        3 chủ đề mới
                      </div>
                      <div
                        className="text-[10px] mt-0.5"
                        style={{ color: 'rgba(160,190,230,0.7)' }}
                      >
                        Gợi ý hôm nay
                      </div>
                    </div>
                  </div>
                </div>

                {/* Widget 4: Kiến thức cần ôn (right-bottom, smaller) */}
                <div
                  className={`${styles.glassCard} ${styles.cardReview} ${!reducedMotion ? 'hero-card-4 hero-card-f4' : ''}`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M6 1L7.2 4.4L10.5 4.5L8.2 6.9L9.1 10.3L6 8.3L2.9 10.3L3.8 6.9L1.5 4.5L4.8 4.4L6 1Z"
                        fill="#F59E0B"
                      />
                    </svg>
                    <span
                      className="text-[10px] font-semibold uppercase"
                      style={{ color: '#F59E0B', letterSpacing: '0.07em' }}
                    >
                      Cần ôn lại
                    </span>
                  </div>
                  <div className="text-[12px] font-medium" style={{ color: '#FFFFFF' }}>
                    Chương 3 · Tích phân
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'rgba(160,190,230,0.7)' }}>
                    Nội dung cần củng cố
                  </div>
                </div>
              </div>
            )}

            {/* Phase status label — only shown for path variant */}
            {HERO_VISUAL_VARIANT === 'path' && phase !== 'done' && phase !== 'idle' && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                <p
                  className="text-[10.5px] transition-opacity"
                  style={{ color: '#5F6E8A', opacity: 0.5 }}
                >
                  {phase === 'scan' && 'Đang phân tích lực học của em…'}
                  {phase === 'route' && 'Đang tạo lộ trình cá nhân…'}
                  {phase === 'ready' && 'Lộ trình đã sẵn sàng'}
                </p>
              </div>
            )}

            {/* Chapter hover card — only shown for path variant */}
            {HERO_VISUAL_VARIANT === 'path' && hoverNode && (
              <div
                className="pointer-events-none absolute z-20 rounded-2xl px-5 py-4"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(0,82,255,0.09)',
                  boxShadow: '0 16px 48px rgba(0,82,255,0.1), 0 2px 8px rgba(0,82,255,0.05)',
                  top: '44%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  minWidth: '195px',
                }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[11.5px] font-semibold" style={{ color: '#091224' }}>
                    {hoverNode.label}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                    style={{
                      background:
                        hoverNode.status === 'completed'
                          ? 'rgba(0,200,150,0.1)'
                          : hoverNode.status === 'current'
                            ? 'rgba(0,82,255,0.08)'
                            : 'rgba(0,0,0,0.04)',
                      color:
                        hoverNode.status === 'completed'
                          ? '#00C896'
                          : hoverNode.status === 'current'
                            ? '#0052FF'
                            : '#5F6E8A',
                    }}
                  >
                    {hoverNode.status === 'completed'
                      ? 'Hoàn thành'
                      : hoverNode.status === 'current'
                        ? 'Đang học'
                        : 'Sắp tới'}
                  </span>
                </div>
                <div className="mb-2.5 text-[12.5px]" style={{ color: '#374151' }}>
                  {hoverNode.sublabel}
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: 'rgba(0,82,255,0.07)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:
                        hoverNode.status === 'completed'
                          ? '100%'
                          : hoverNode.status === 'current'
                            ? '55%'
                            : '0%',
                      background: hoverNode.status === 'completed' ? '#00C896' : '#0052FF',
                    }}
                  />
                </div>
                <div className="mt-1.5 text-[10.5px]" style={{ color: '#5F6E8A' }}>
                  {hoverNode.status === 'completed'
                    ? 'Đã hoàn thành'
                    : hoverNode.status === 'current'
                      ? '55% hoàn thành'
                      : 'Chưa bắt đầu'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom fade — fades to heroFrame dark navy, not white */}
      <div className={styles.bottomFade} aria-hidden="true" />

      {/* Keyframes — progress bar only (others moved to globals.css) */}
      <style>{`
        @keyframes progress-slow {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        .animate-progress-slow { animation: progress-slow 2.8s ease-in-out infinite; }

        /* Knowledge graph node pulses (used in path visualizer) */
        @keyframes node-pulse-active {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
        @keyframes node-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.7; }
        }
        .animate-node-pulse-active { animation: node-pulse-active 3s ease-in-out infinite; }
        .animate-node-pulse        { animation: node-pulse 4s ease-in-out infinite; }
        @keyframes dest-breathe {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
