-- Practice sets that span a chapter, and exam attempts. Only adds: no data
-- is changed or removed.

-- A practice attempt can now also be a chapter-wide set. For CHAPTER (free
-- chapter review) and SYNTHESIS (the Plus "Tổng hợp" set), lesson_id holds the
-- chapter's knowledge-node id; lesson queries read only LESSON and MISTAKES.
alter table tutai.practice_attempts drop constraint if exists practice_attempts_mode_check;
alter table tutai.practice_attempts
  add constraint practice_attempts_mode_check
  check (mode in ('LESSON', 'MISTAKES', 'CHAPTER', 'SYNTHESIS'));

-- One timed attempt of a student on one published exam. Questions and answer
-- keys come from the exam's published snapshot (exam_published_at says which
-- one); responses are saved as the student goes and graded on submit.
create table if not exists tutai.exam_attempts (
  id text primary key,
  student_id text not null references tutai.student_profiles (id) on delete cascade,
  exam_id text not null,
  exam_published_at timestamptz not null,
  status text not null check (status in ('IN_PROGRESS', 'SUBMITTED')),
  responses jsonb not null default '{}'::jsonb,
  results jsonb,
  correct_count integer,
  total_count integer not null check (total_count > 0),
  duration_minutes integer not null check (duration_minutes > 0),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  auto_submitted boolean not null default false
);

create index if not exists exam_attempts_student_exam_idx
  on tutai.exam_attempts (student_id, exam_id, started_at desc);

-- At most one open attempt per student and exam: starting again resumes it.
create unique index if not exists exam_attempts_one_open_idx
  on tutai.exam_attempts (student_id, exam_id) where status = 'IN_PROGRESS';

alter table tutai.exam_attempts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on tutai.exam_attempts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on tutai.exam_attempts from authenticated;
  end if;
end
$$;
