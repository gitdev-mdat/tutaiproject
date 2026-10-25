// @vitest-environment node

/**
 * Runs against a real PostgreSQL database named in TEST_DATABASE_URL (a
 * throwaway "_test" database; the tutai schema is created by the migrations).
 * Skipped when the variable is not set.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { closeSql, getSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { recordLessonCompletion } from './learning-streak-service';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const STUDENT = 'streak-test-student';
// 09:00 in Hà Nội on each day.
const on = (day: string) => new Date(`${day}T02:00:00Z`);

describe.skipIf(!TEST_DATABASE_URL)('learning streak in PostgreSQL', () => {
  const saved = process.env.DATABASE_URL;

  beforeAll(async () => {
    if (!TEST_DATABASE_URL!.split('?')[0].endsWith('_test')) throw new Error('needs a *_test DB');
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    const sql = getSql();
    await runMigrations(sql);
    await sql`
      insert into tutai.users (id, username, display_name, created_at, updated_at)
      values (${STUDENT + '-user'}, ${STUDENT}, 'Streak test', now(), now())
      on conflict do nothing`;
    await sql`
      insert into tutai.student_profiles (id, user_id, created_at, updated_at)
      values (${STUDENT}, ${STUDENT + '-user'}, now(), now())
      on conflict do nothing`;
  });
  beforeEach(async () => {
    const sql = getSql();
    await sql`delete from tutai.lesson_completions where student_id = ${STUDENT}`;
    await sql`delete from tutai.learning_days where student_id = ${STUDENT}`;
  });
  afterAll(async () => {
    const sql = getSql();
    await sql`delete from tutai.lesson_completions where student_id = ${STUDENT}`;
    await sql`delete from tutai.learning_days where student_id = ${STUDENT}`;
    await sql`delete from tutai.users where id = ${STUDENT + '-user'}`;
    await closeSql();
    process.env.DATABASE_URL = saved;
  });

  it('awards one day per day, keeps it for more lessons, never for a repeat', async () => {
    expect(await recordLessonCompletion(STUDENT, 'lesson-a', on('2026-10-23'))).toEqual({
      status: 'awarded',
      previous: 0,
      current: 1,
      today: true,
    });
    expect(await recordLessonCompletion(STUDENT, 'lesson-b', on('2026-10-23'))).toEqual({
      status: 'kept',
      current: 1,
      today: true,
    });
    expect(await recordLessonCompletion(STUDENT, 'lesson-c', on('2026-10-24'))).toEqual({
      status: 'awarded',
      previous: 1,
      current: 2,
      today: true,
    });
    // Repeating lesson A the next day does not count as learning that day.
    expect(await recordLessonCompletion(STUDENT, 'lesson-a', on('2026-10-25'))).toEqual({
      status: 'repeat',
      current: 2,
      today: false,
    });
    // After a missed day the streak starts over.
    expect(await recordLessonCompletion(STUDENT, 'lesson-d', on('2026-10-27'))).toEqual({
      status: 'awarded',
      previous: 0,
      current: 1,
      today: true,
    });
  });

  it('awards a day once when the same completion arrives many times at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => recordLessonCompletion(STUDENT, 'lesson-a', on('2026-10-23')))
    );
    expect(results.filter((result) => result.status === 'awarded')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'repeat')).toHaveLength(5);
    const [{ count }] = await getSql()<{ count: number }[]>`
      select count(*)::int as count from tutai.learning_days where student_id = ${STUDENT}`;
    expect(count).toBe(1);
  });

  it('awards a day once when two lessons finish at once in two tabs', async () => {
    const results = await Promise.all([
      recordLessonCompletion(STUDENT, 'lesson-a', on('2026-10-23')),
      recordLessonCompletion(STUDENT, 'lesson-b', on('2026-10-23')),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['awarded', 'kept']);
  });
});
