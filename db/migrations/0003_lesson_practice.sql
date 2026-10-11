-- Content the admin edits (knowledge tree, lesson articles, question bank) as
-- whole JSON documents, so edits made on Vercel survive redeploys. Each key
-- replaces one file under data/; a missing key falls back to that file.
create table if not exists tutai.content_documents (
  key text primary key,
  body jsonb not null,
  updated_at timestamptz not null default now()
);

-- One practice session of a student on one lesson. question_ids is the set
-- picked when the session started, in the order shown.
create table if not exists tutai.practice_attempts (
  id text primary key,
  student_id text not null references tutai.student_profiles (id) on delete cascade,
  lesson_id text not null,
  mode text not null check (mode in ('LESSON', 'MISTAKES')),
  question_ids text[] not null check (cardinality(question_ids) > 0),
  status text not null check (status in ('IN_PROGRESS', 'COMPLETED')),
  correct_count integer,
  total_count integer not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists practice_attempts_student_lesson_idx
  on tutai.practice_attempts (student_id, lesson_id, started_at desc);

-- One graded answer per question per attempt; answers are never overwritten.
create table if not exists tutai.practice_answers (
  attempt_id text not null references tutai.practice_attempts (id) on delete cascade,
  question_id text not null,
  response jsonb not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

alter table tutai.content_documents enable row level security;
alter table tutai.practice_attempts enable row level security;
alter table tutai.practice_answers enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on tutai.content_documents, tutai.practice_attempts, tutai.practice_answers from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on tutai.content_documents, tutai.practice_attempts, tutai.practice_answers from authenticated;
  end if;
end
$$;
