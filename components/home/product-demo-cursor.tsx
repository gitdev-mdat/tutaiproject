'use client';

import { useEffect, useRef, type RefObject } from 'react';

import styles from './product-demo-cursor.module.css';
import { NEXT_PRODUCT_DEMO_SCENE, type ProductDemoScene } from './product-demo-sequence';

export type { ProductDemoScene } from './product-demo-sequence';

export const productDemoHostClassName = styles.demoHost;

interface ProductDemoCursorProps {
  hostRef: RefObject<HTMLDivElement | null>;
  onSceneChange: (scene: ProductDemoScene) => void;
}

interface Point {
  x: number;
  y: number;
}

function waitFor(ms: number, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve(true);
    }, ms);

    function cancel() {
      window.clearTimeout(timer);
      resolve(false);
    }

    signal.addEventListener('abort', cancel, { once: true });
  });
}

export function ProductDemoCursor({ hostRef, onSceneChange }: ProductDemoCursorProps) {
  const cursorRef = useRef<SVGSVGElement>(null);
  const sceneChangeRef = useRef(onSceneChange);

  useEffect(() => {
    sceneChangeRef.current = onSceneChange;
  }, [onSceneChange]);

  useEffect(() => {
    const host = hostRef.current;
    const cursor = cursorRef.current;
    if (!host || !cursor) return;

    const desktopQuery = window.matchMedia(
      '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
    );
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let sectionVisible = false;
    let focusInside = false;
    let clickedInside = false;
    let pageVisible = !document.hidden;
    let startTimer: number | undefined;
    let cycleController: AbortController | null = null;
    let currentScene: ProductDemoScene = 'ROADMAP_LOCKED';

    const canStart = () =>
      sectionVisible && pageVisible && !focusInside && !clickedInside && cycleController === null;
    const canContinue = () => !focusInside && !clickedInside;

    const applyScene = (scene: ProductDemoScene) => {
      host.dataset.demoState = scene;
      sceneChangeRef.current(scene);
    };

    const advanceTo = (scene: ProductDemoScene) => {
      if (NEXT_PRODUCT_DEMO_SCENE[currentScene] !== scene) return false;
      currentScene = scene;
      applyScene(scene);
      return true;
    };

    const measureTarget = (selector: string): Point | null => {
      const target = host.querySelector<HTMLElement>(selector);
      if (!target) return null;
      const hostRect = host.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (!hostRect.width || !hostRect.height) return null;

      return {
        x: targetRect.left - hostRect.left + targetRect.width * 0.62,
        y: targetRect.top - hostRect.top + targetRect.height * 0.55,
      };
    };

    const resetVisuals = () => {
      currentScene = 'ROADMAP_LOCKED';
      applyScene('ROADMAP_LOCKED');
      cursor.getAnimations().forEach((animation) => animation.cancel());
      cursor.style.opacity = '0';
      cursor.style.transform = '';
    };

    const stop = () => {
      if (startTimer !== undefined) {
        window.clearTimeout(startTimer);
        startTimer = undefined;
      }
      cycleController?.abort();
      cycleController = null;
      resetVisuals();
    };

    const schedule = (delay: number) => {
      if (cycleController) return;
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      if (!canStart()) return;

      startTimer = window.setTimeout(() => {
        startTimer = undefined;
        void playCycle();
      }, delay);
    };

    const animateCursor = async (
      from: Point,
      to: Point,
      duration: number,
      signal: AbortSignal,
      fadeIn = false
    ) => {
      const movement = cursor.animate(
        [
          {
            opacity: fadeIn ? 0 : 1,
            transform: `translate3d(${from.x}px, ${from.y}px, 0) rotate(1deg)`,
          },
          {
            offset: 0.72,
            opacity: 1,
            transform: `translate3d(${to.x + 18}px, ${to.y + 12}px, 0) rotate(0.3deg)`,
          },
          { opacity: 1, transform: `translate3d(${to.x}px, ${to.y}px, 0) rotate(0deg)` },
        ],
        {
          duration: reducedMotionQuery.matches ? 1 : duration,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        }
      );
      await movement.finished.catch(() => undefined);
      return !signal.aborted && canContinue();
    };

    const pressCursor = async (point: Point, signal: AbortSignal) => {
      const press = cursor.animate(
        [
          { opacity: 1, transform: `translate3d(${point.x}px, ${point.y}px, 0) scale(1)` },
          {
            opacity: 1,
            transform: `translate3d(${point.x + 1}px, ${point.y + 2}px, 0) scale(0.94)`,
          },
          { opacity: 1, transform: `translate3d(${point.x}px, ${point.y}px, 0) scale(1)` },
        ],
        {
          duration: reducedMotionQuery.matches ? 1 : 140,
          easing: 'ease-out',
          fill: 'forwards',
        }
      );
      await press.finished.catch(() => undefined);
      return !signal.aborted && canContinue();
    };

    const hideCursor = async (point: Point) => {
      const fade = cursor.animate(
        [
          { opacity: 1, transform: `translate3d(${point.x}px, ${point.y}px, 0)` },
          { opacity: 0, transform: `translate3d(${point.x + 16}px, ${point.y + 10}px, 0)` },
        ],
        {
          duration: reducedMotionQuery.matches ? 1 : 260,
          easing: 'ease-out',
          fill: 'forwards',
        }
      );
      await fade.finished.catch(() => undefined);
    };

    const hold = async (scene: ProductDemoScene, duration: number, signal: AbortSignal) => {
      if (!advanceTo(scene)) return false;
      const adjusted = reducedMotionQuery.matches ? Math.min(duration, 500) : duration;
      return (await waitFor(adjusted, signal)) && canContinue();
    };

    const playCycle = async () => {
      if (!canStart()) return;

      const learnTarget = measureTarget("[data-demo-action='primary']");
      const hostRect = host.getBoundingClientRect();
      if (!learnTarget || !hostRect.width || !hostRect.height) return;

      const controller = new AbortController();
      const { signal } = controller;
      cycleController = controller;
      const start = {
        x: Math.min(hostRect.width - 34, Math.max(learnTarget.x + 104, hostRect.width * 0.84)),
        y: Math.min(hostRect.height - 42, Math.max(learnTarget.y + 132, hostRect.height * 0.76)),
      };

      if (!advanceTo('LEARN_APPROACH')) return;
      if (!(await animateCursor(start, learnTarget, 900, signal, true))) return;
      if (!(await hold('LEARN_HOVER', 750, signal))) return;
      if (!advanceTo('LEARN_PRESS')) return;
      if (!(await pressCursor(learnTarget, signal))) return;
      await hideCursor(learnTarget);
      if (!canContinue() || signal.aborted) return;

      if (!(await hold('LESSON_ENTERING', 450, signal))) return;
      if (!(await hold('LESSON_STEP_1', 700, signal))) return;
      if (!(await hold('LESSON_STEP_2', 750, signal))) return;
      if (!(await hold('LESSON_STEP_3', 800, signal))) return;
      if (!(await hold('LESSON_COMPLETE', 1300, signal))) return;
      if (!(await hold('ROADMAP_LESSON_COMPLETE', 900, signal))) return;
      if (!(await hold('PRACTICE_UNLOCKING', 1200, signal))) return;
      if (!(await hold('PRACTICE_READY', 900, signal))) return;

      const practiceTarget = measureTarget("[data-demo-action='secondary']");
      if (!practiceTarget) return;
      if (!advanceTo('PRACTICE_APPROACH')) return;
      if (
        !(await animateCursor(
          { x: learnTarget.x - 22, y: learnTarget.y - 10 },
          practiceTarget,
          850,
          signal,
          true
        ))
      )
        return;
      if (!(await hold('PRACTICE_HOVER', 700, signal))) return;
      if (!advanceTo('PRACTICE_PRESS')) return;
      if (!(await pressCursor(practiceTarget, signal))) return;
      await hideCursor(practiceTarget);
      if (!canContinue() || signal.aborted) return;

      if (!(await hold('PRACTICE_ACTIVE', 650, signal))) return;
      const answerOneTarget = measureTarget("[data-demo-answer='correct']");
      if (!answerOneTarget) return;
      if (!advanceTo('PRACTICE_Q1_APPROACH')) return;
      if (
        !(await animateCursor(
          { x: answerOneTarget.x + 70, y: answerOneTarget.y + 52 },
          answerOneTarget,
          450,
          signal,
          true
        ))
      )
        return;
      if (!(await hold('PRACTICE_Q1_HOVER', 320, signal))) return;
      if (!advanceTo('PRACTICE_Q1_PRESS')) return;
      if (!(await pressCursor(answerOneTarget, signal))) return;
      if (!(await hold('PRACTICE_Q1_FEEDBACK', 1000, signal))) return;

      if (!(await hold('PRACTICE_Q2', 350, signal))) return;
      const answerTwoTarget = measureTarget("[data-demo-answer='correct']");
      if (!answerTwoTarget) return;
      if (!advanceTo('PRACTICE_Q2_APPROACH')) return;
      if (!(await animateCursor(answerOneTarget, answerTwoTarget, 500, signal))) return;
      if (!(await hold('PRACTICE_Q2_HOVER', 300, signal))) return;
      if (!advanceTo('PRACTICE_Q2_PRESS')) return;
      if (!(await pressCursor(answerTwoTarget, signal))) return;
      if (!(await hold('PRACTICE_Q2_FEEDBACK', 950, signal))) return;

      if (!(await hold('PRACTICE_Q3', 350, signal))) return;
      const answerThreeTarget = measureTarget("[data-demo-answer='correct']");
      if (!answerThreeTarget) return;
      if (!advanceTo('PRACTICE_Q3_APPROACH')) return;
      if (!(await animateCursor(answerTwoTarget, answerThreeTarget, 550, signal))) return;
      if (!(await hold('PRACTICE_Q3_HOVER', 320, signal))) return;
      if (!advanceTo('PRACTICE_Q3_PRESS')) return;
      if (!(await pressCursor(answerThreeTarget, signal))) return;
      if (!(await hold('PRACTICE_Q3_FEEDBACK', 1100, signal))) return;

      if (!(await hold('PRACTICE_COMPLETE', 650, signal))) return;
      if (!(await hold('CELEBRATING', 1800, signal))) return;
      if (!(await hold('FINAL_SUMMARY', 1600, signal))) return;

      if (!advanceTo('RESETTING')) return;
      await hideCursor(answerThreeTarget);
      if (!(await waitFor(reducedMotionQuery.matches ? 120 : 700, signal)) || signal.aborted)
        return;

      cycleController = null;
      if (!advanceTo('ROADMAP_LOCKED')) return;
      cursor.getAnimations().forEach((animation) => animation.cancel());
      cursor.style.opacity = '0';
      cursor.style.transform = '';
      schedule(1400);
    };

    const handlePointerLeave = () => {
      clickedInside = false;
      schedule(3000);
    };
    const handleFocusIn = () => {
      focusInside = true;
      stop();
    };
    const handleFocusOut = () => {
      window.queueMicrotask(() => {
        focusInside = host.contains(document.activeElement);
        if (!focusInside) {
          clickedInside = false;
          schedule(3000);
        }
      });
    };
    const handlePointerDown = () => {
      clickedInside = true;
      stop();
    };
    const handleVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible) schedule(900);
    };
    const handleMediaChange = () => {
      if (desktopQuery.matches) host.dataset.demoEnabled = 'true';
      else host.removeAttribute('data-demo-enabled');
      schedule(900);
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        sectionVisible = entry.isIntersecting && entry.intersectionRatio >= 0.4;
        if (sectionVisible) schedule(1600);
      },
      { threshold: [0, 0.4, 0.5] }
    );

    host.addEventListener('pointerleave', handlePointerLeave);
    host.addEventListener('pointerdown', handlePointerDown);
    host.addEventListener('focusin', handleFocusIn);
    host.addEventListener('focusout', handleFocusOut);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    desktopQuery.addEventListener('change', handleMediaChange);
    reducedMotionQuery.addEventListener('change', handleMediaChange);
    intersectionObserver.observe(host);
    resetVisuals();
    handleMediaChange();

    return () => {
      stop();
      host.removeAttribute('data-demo-enabled');
      host.removeAttribute('data-demo-state');
      host.removeEventListener('pointerleave', handlePointerLeave);
      host.removeEventListener('pointerdown', handlePointerDown);
      host.removeEventListener('focusin', handleFocusIn);
      host.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      desktopQuery.removeEventListener('change', handleMediaChange);
      reducedMotionQuery.removeEventListener('change', handleMediaChange);
      intersectionObserver.disconnect();
    };
  }, [hostRef]);

  return (
    <div className={styles.cursorLayer} aria-hidden="true">
      <svg
        ref={cursorRef}
        className={styles.cursor}
        viewBox="0 0 22 30"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2 1.8 2.4 23.9l5.7-5.4 4.3 9.5 4.5-2.1-4.3-9.2 8-.2L2 1.8Z"
          fill="#0b0f19"
          stroke="#ffffff"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
