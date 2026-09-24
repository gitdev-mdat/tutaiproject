'use client';

import { useEffect, useRef, type RefObject } from 'react';

import styles from './product-demo-cursor.module.css';

export const productDemoHostClassName = styles.demoHost;

interface ProductDemoCursorProps {
  hostRef: RefObject<HTMLDivElement | null>;
}

interface DemoPosition {
  x: number;
  y: number;
  startX: number;
  startY: number;
  exitX: number;
  exitY: number;
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

export function ProductDemoCursor({ hostRef }: ProductDemoCursorProps) {
  const cursorRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const cursor = cursorRef.current;
    const action = host?.querySelector<HTMLElement>("[data-demo-action='primary']");

    if (!host || !cursor || !action) return;

    const desktopQuery = window.matchMedia(
      '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
    );
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let sectionVisible = false;
    let pointerInside = false;
    let focusInside = false;
    let clickedInside = false;
    let pageVisible = !document.hidden;
    let startTimer: number | undefined;
    let cycleController: AbortController | null = null;
    let position: DemoPosition | null = null;

    const canPlay = () =>
      desktopQuery.matches &&
      !reducedMotionQuery.matches &&
      sectionVisible &&
      pageVisible &&
      !pointerInside &&
      !focusInside &&
      !clickedInside;

    const measure = () => {
      const hostRect = host.getBoundingClientRect();
      const actionRect = action.getBoundingClientRect();

      if (hostRect.width === 0 || hostRect.height === 0) {
        position = null;
        return;
      }

      const x = actionRect.left - hostRect.left + actionRect.width * 0.66;
      const y = actionRect.top - hostRect.top + actionRect.height * 0.55;
      const startX = Math.min(hostRect.width - 30, Math.max(x + 96, hostRect.width * 0.84));
      const startY = Math.min(hostRect.height - 36, Math.max(y + 128, hostRect.height * 0.72));

      position = {
        x,
        y,
        startX,
        startY,
        exitX: Math.min(hostRect.width - 30, x + 34),
        exitY: Math.min(hostRect.height - 36, y + 24),
      };
    };

    const resetVisuals = () => {
      host.removeAttribute('data-demo-state');
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
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      if (!canPlay()) return;

      startTimer = window.setTimeout(() => {
        startTimer = undefined;
        void playCycle();
      }, delay);
    };

    const playCycle = async () => {
      if (!canPlay()) return;

      measure();
      if (!position) return;

      const controller = new AbortController();
      const { signal } = controller;
      cycleController = controller;

      const { x, y, startX, startY, exitX, exitY } = position;
      const approach = cursor.animate(
        [
          {
            opacity: 0,
            transform: `translate3d(${startX}px, ${startY}px, 0) rotate(1.5deg)`,
          },
          {
            offset: 0.14,
            opacity: 1,
            transform: `translate3d(${startX - 8}px, ${startY - 10}px, 0) rotate(1deg)`,
          },
          {
            offset: 0.68,
            opacity: 1,
            transform: `translate3d(${x + 38}px, ${y + 24}px, 0) rotate(0.35deg)`,
          },
          { opacity: 1, transform: `translate3d(${x}px, ${y}px, 0) rotate(0deg)` },
        ],
        {
          duration: 1200,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        }
      );

      host.dataset.demoState = 'moving';
      await approach.finished.catch(() => undefined);
      if (signal.aborted || !canPlay()) return;

      host.dataset.demoState = 'hover';
      if (!(await waitFor(380, signal)) || !canPlay()) return;

      host.dataset.demoState = 'press';
      const press = cursor.animate(
        [
          { opacity: 1, transform: `translate3d(${x}px, ${y}px, 0)` },
          { opacity: 1, transform: `translate3d(${x + 1}px, ${y + 2}px, 0)` },
          { opacity: 1, transform: `translate3d(${x}px, ${y}px, 0)` },
        ],
        { duration: 140, easing: 'ease-out', fill: 'forwards' }
      );
      await press.finished.catch(() => undefined);
      if (signal.aborted || !canPlay()) return;

      host.dataset.demoState = 'confirm';
      if (!(await waitFor(920, signal)) || !canPlay()) return;

      host.dataset.demoState = 'exit';
      const exit = cursor.animate(
        [
          { opacity: 1, transform: `translate3d(${x}px, ${y}px, 0)` },
          {
            opacity: 0,
            transform: `translate3d(${exitX}px, ${exitY}px, 0) rotate(1deg)`,
          },
        ],
        {
          duration: 650,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards',
        }
      );
      await exit.finished.catch(() => undefined);
      if (signal.aborted) return;

      cycleController = null;
      resetVisuals();
      schedule(6500);
    };

    const pauseForInteraction = () => {
      stop();
    };

    const handlePointerEnter = () => {
      pointerInside = true;
      pauseForInteraction();
    };

    const handlePointerLeave = () => {
      pointerInside = false;
      clickedInside = false;
      schedule(3000);
    };

    const handleFocusIn = () => {
      focusInside = true;
      pauseForInteraction();
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        focusInside = host.contains(document.activeElement);
        if (!focusInside) {
          clickedInside = false;
          schedule(3000);
        }
      }, 0);
    };

    const handlePointerDown = () => {
      clickedInside = true;
      pauseForInteraction();
    };

    const handleVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible) schedule(900);
      else stop();
    };

    const handleMediaChange = () => {
      if (desktopQuery.matches && !reducedMotionQuery.matches) {
        host.dataset.demoEnabled = 'true';
        measure();
        schedule(900);
      } else {
        host.removeAttribute('data-demo-enabled');
        stop();
      }
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        sectionVisible = entry.isIntersecting && entry.intersectionRatio >= 0.4;
        if (sectionVisible) schedule(800);
        else stop();
      },
      { threshold: [0, 0.4, 0.5] }
    );
    const resizeObserver = new ResizeObserver(measure);

    host.addEventListener('pointerenter', handlePointerEnter);
    host.addEventListener('pointerleave', handlePointerLeave);
    host.addEventListener('pointerdown', handlePointerDown);
    host.addEventListener('focusin', handleFocusIn);
    host.addEventListener('focusout', handleFocusOut);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    desktopQuery.addEventListener('change', handleMediaChange);
    reducedMotionQuery.addEventListener('change', handleMediaChange);
    intersectionObserver.observe(host);
    resizeObserver.observe(host);
    handleMediaChange();

    return () => {
      stop();
      host.removeAttribute('data-demo-enabled');
      host.removeAttribute('data-demo-state');
      host.removeEventListener('pointerenter', handlePointerEnter);
      host.removeEventListener('pointerleave', handlePointerLeave);
      host.removeEventListener('pointerdown', handlePointerDown);
      host.removeEventListener('focusin', handleFocusIn);
      host.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      desktopQuery.removeEventListener('change', handleMediaChange);
      reducedMotionQuery.removeEventListener('change', handleMediaChange);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
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
