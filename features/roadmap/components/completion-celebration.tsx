'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import styles from './completion-celebration.module.css';

const PARTICLES = [
  ['12%', '-22px', '0ms', '#2563eb'],
  ['20%', '18px', '90ms', '#10b981'],
  ['29%', '-14px', '35ms', '#7c3aed'],
  ['38%', '24px', '150ms', '#3b82f6'],
  ['47%', '-28px', '60ms', '#14b8a6'],
  ['55%', '20px', '120ms', '#2563eb'],
  ['64%', '-18px', '20ms', '#8b5cf6'],
  ['72%', '26px', '175ms', '#10b981'],
  ['81%', '-20px', '75ms', '#3b82f6'],
  ['89%', '16px', '135ms', '#14b8a6'],
] as const;

export function CompletionCelebration({ eventId }: { eventId: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const key = `tutai:celebration:${eventId}`;
    if (window.sessionStorage.getItem(key)) {
      const timeout = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(timeout);
    }
    window.sessionStorage.setItem(key, 'seen');
    const timeout = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [eventId]);

  if (!visible) return null;

  return (
    <div className={styles.celebration} aria-hidden="true">
      {PARTICLES.map(([x, drift, delay, color], index) => (
        <span
          key={`${x}-${index}`}
          className={styles.particle}
          style={
            {
              '--particle-x': x,
              '--particle-drift': drift,
              '--particle-delay': delay,
              '--particle-color': color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
