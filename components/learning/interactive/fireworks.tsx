'use client';

import * as React from 'react';

/**
 * The completion fireworks: confetti fired from both lower corners, then
 * three firework bursts high on the screen, settling within about three
 * seconds. One canvas over the page that never takes a click; nothing runs
 * under reduced motion. Hand-written (about 200 lines, no dependency) so the
 * shapes, colours and timing match the lesson, and it costs nothing until a
 * student finishes.
 *
 * `run` starts a show each time it changes to a new positive number.
 */

const COLORS = ['#0052FF', '#38BDF8', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#FFFFFF'];
// Saturated enough to read on the white page as well as on the blue banner.
const SPARK_COLORS = ['#F59E0B', '#0EA5E9', '#10B981', '#EC4899', '#8B5CF6', '#2563EB'];

const DURATION = 3.2; // seconds until the canvas is removed
const FADE_FROM = 2.3; // everything fades out after this

type Confetti = {
  kind: 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  angle: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  sway: number;
  color: string;
  round: boolean;
  born: number;
};

type Spark = {
  kind: 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
  born: number;
};

type Flash = { kind: 'flash'; x: number; y: number; radius: number; color: string; born: number };

type Particle = Confetti | Spark | Flash;

const random = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function Fireworks({ run, delay = 0.3 }: { run: number; delay?: number }) {
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [active, setActive] = React.useState(0);

  // A new run mounts the canvas; it unmounts itself when the show is over.
  React.useEffect(() => {
    if (!run || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setActive(run), delay * 1000);
    return () => window.clearTimeout(timer);
  }, [run, delay]);

  React.useEffect(() => {
    const element = canvas.current;
    if (!active || !element) return;
    const context = element.getContext('2d');
    if (!context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    // Distances scale with the screen, counts with its area: a phone gets a
    // smaller, still full-looking show.
    const scale = Math.min(Math.max(Math.min(width, height) / 800, 0.55), 1.15);
    const compact = width < 640;
    const particles: Particle[] = [];

    const cannon = (side: 'left' | 'right', at: number, count: number) => {
      const fromLeft = side === 'left';
      for (let i = 0; i < count; i += 1) {
        // Up and inwards, about 62° from the floor, fanned out.
        const angle = ((fromLeft ? -62 : -118) + random(-17, 17)) * (Math.PI / 180);
        const speed = random(1250, 2150) * scale;
        const big = Math.random() < 0.3;
        particles.push({
          kind: 'confetti',
          x: fromLeft ? random(-10, 10) : width + random(-10, 10),
          y: height * random(0.78, 0.9),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          w: (big ? random(9, 12) : random(6, 9)) * Math.max(scale, 0.75),
          h: (big ? random(14, 18) : random(8, 12)) * Math.max(scale, 0.75),
          angle: random(0, Math.PI * 2),
          spin: random(-9, 9),
          flip: random(0, Math.PI * 2),
          flipSpeed: random(6, 13),
          sway: random(0, Math.PI * 2),
          color: pick(COLORS),
          round: Math.random() < 0.18,
          born: at + random(0, 0.12),
        });
      }
    };

    const burst = (x: number, y: number, at: number, count: number) => {
      const color = pick(SPARK_COLORS);
      particles.push({ kind: 'flash', x, y, radius: 90 * scale, color, born: at });
      for (let i = 0; i < count; i += 1) {
        // A ring with a little scatter reads as a firework, not a puff.
        const angle = (i / count) * Math.PI * 2 + random(-0.08, 0.08);
        const speed = random(0.7, 1) * 560 * scale;
        particles.push({
          kind: 'spark',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: random(2.2, 3.4) * Math.max(scale, 0.8),
          life: random(1.0, 1.5),
          color: Math.random() < 0.8 ? color : '#FBBF24',
          born: at,
        });
      }
    };

    cannon('left', 0, compact ? 70 : 120);
    cannon('right', 0.06, compact ? 70 : 120);
    burst(width * 0.27, height * 0.26, 0.2, compact ? 36 : 54);
    burst(width * 0.73, height * 0.2, 0.5, compact ? 36 : 54);
    burst(width * 0.5, height * (compact ? 0.13 : 0.11), 0.85, compact ? 40 : 64);

    let frame = 0;
    let start = 0;
    let last = 0;
    const step = (time: number) => {
      if (!start) start = last = time;
      const t = (time - start) / 1000;
      const dt = Math.min((time - last) / 1000, 1 / 30);
      last = time;
      const fade = t < FADE_FROM ? 1 : Math.max(0, 1 - (t - FADE_FROM) / (DURATION - FADE_FROM));

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (t < p.born) continue;
        const age = t - p.born;
        if (p.kind === 'flash') {
          if (age > 0.35) continue;
          const k = 1 - age / 0.35;
          const glow = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          glow.addColorStop(0, hexAlpha('#FFF7D6', 0.95 * k * fade));
          glow.addColorStop(0.3, hexAlpha(p.color, 0.45 * k * fade));
          glow.addColorStop(1, hexAlpha(p.color, 0));
          context.fillStyle = glow;
          context.beginPath();
          context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          context.fill();
        } else if (p.kind === 'spark') {
          if (age > p.life) continue;
          const drag = Math.exp(-2.1 * dt);
          p.vx *= drag;
          p.vy = p.vy * drag + 260 * scale * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const k = 1 - age / p.life;
          // Twinkle in the last third.
          const twinkle = k < 0.35 ? (Math.sin(age * 40 + p.size * 10) > 0 ? 1 : 0.35) : 1;
          const alpha = k * twinkle * fade;
          // A fading tail behind a bright head.
          const tail = context.createLinearGradient(p.x - p.vx * 0.09, p.y - p.vy * 0.09, p.x, p.y);
          tail.addColorStop(0, hexAlpha(p.color, 0));
          tail.addColorStop(1, hexAlpha(p.color, alpha));
          context.strokeStyle = tail;
          context.lineWidth = p.size;
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(p.x - p.vx * 0.09, p.y - p.vy * 0.09);
          context.lineTo(p.x, p.y);
          context.stroke();
          context.fillStyle = hexAlpha('#FFFBEB', alpha);
          context.beginPath();
          context.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2);
          context.fill();
        } else {
          if (p.y > height + 40) continue;
          // Air slows the confetti quickly, then it flutters down.
          const drag = Math.exp(-2.3 * dt);
          p.vx *= drag;
          p.vy = p.vy * drag + 1100 * scale * dt;
          p.vy = Math.min(p.vy, 260 * scale);
          p.sway += dt * 4;
          p.x += (p.vx + Math.sin(p.sway) * 40 * scale) * dt;
          p.y += p.vy * dt;
          p.angle += p.spin * dt;
          p.flip += p.flipSpeed * dt;
          context.save();
          context.translate(p.x, p.y);
          context.rotate(p.angle);
          context.scale(1, Math.cos(p.flip));
          context.globalAlpha = fade;
          context.fillStyle = p.color;
          if (p.round) {
            context.beginPath();
            context.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
            context.fill();
          } else {
            context.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          }
          context.restore();
        }
      }

      if (t < DURATION) frame = window.requestAnimationFrame(step);
      else setActive(0);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      data-testid="fireworks"
      className="pointer-events-none fixed inset-0 z-[70] h-full w-full"
    />
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}
