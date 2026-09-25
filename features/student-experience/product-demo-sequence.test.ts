import { describe, expect, it } from 'vitest';

import {
  NEXT_PRODUCT_DEMO_SCENE,
  PRODUCT_DEMO_CYCLE,
  type ProductDemoScene,
} from '@/components/home/product-demo-sequence';

function countScene(cycle: readonly ProductDemoScene[], scene: ProductDemoScene) {
  return cycle.filter((candidate) => candidate === scene).length;
}

describe('landing-page product demo sequence', () => {
  it('runs one complete learning journey before returning to the locked roadmap', () => {
    const traversed: ProductDemoScene[] = ['ROADMAP_LOCKED'];
    let scene: ProductDemoScene = 'ROADMAP_LOCKED';

    for (let index = 0; index < PRODUCT_DEMO_CYCLE.length; index += 1) {
      scene = NEXT_PRODUCT_DEMO_SCENE[scene];
      traversed.push(scene);
    }

    expect(traversed.slice(0, -1)).toEqual(PRODUCT_DEMO_CYCLE);
    expect(traversed.at(-1)).toBe('ROADMAP_LOCKED');
    expect(countScene(traversed.slice(0, -1), 'LEARN_PRESS')).toBe(1);
    expect(countScene(traversed.slice(0, -1), 'PRACTICE_PRESS')).toBe(1);
    expect(countScene(traversed.slice(0, -1), 'PRACTICE_ACTIVE')).toBe(1);
    expect(countScene(traversed.slice(0, -1), 'PRACTICE_Q2')).toBe(1);
    expect(countScene(traversed.slice(0, -1), 'PRACTICE_Q3')).toBe(1);
    expect(countScene(traversed.slice(0, -1), 'CELEBRATING')).toBe(1);
  });

  it('cannot restart learning between lesson completion and reset', () => {
    expect(NEXT_PRODUCT_DEMO_SCENE.LESSON_COMPLETE).toBe('ROADMAP_LESSON_COMPLETE');
    expect(NEXT_PRODUCT_DEMO_SCENE.ROADMAP_LESSON_COMPLETE).toBe('PRACTICE_UNLOCKING');

    const afterLesson = PRODUCT_DEMO_CYCLE.slice(
      PRODUCT_DEMO_CYCLE.indexOf('LESSON_COMPLETE') + 1,
      PRODUCT_DEMO_CYCLE.indexOf('RESETTING')
    );

    expect(afterLesson).not.toContain('ROADMAP_LOCKED');
    expect(afterLesson).not.toContain('LEARN_APPROACH');
    expect(afterLesson).not.toContain('LEARN_PRESS');
    expect(afterLesson).toContain('PRACTICE_PRESS');
    expect(afterLesson).toContain('FINAL_SUMMARY');
  });
});
