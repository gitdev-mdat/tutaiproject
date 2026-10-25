-- The daily learning streak. A lesson counts once per student, on the day it
-- is first completed (repeating it never counts again); a learning day is a
-- day with at least one such first completion. The primary keys make a
-- repeated or concurrent completion a no-op, so a day is never awarded twice.
create table if not exists tutai.lesson_completions (
  student_id text not null references tutai.student_profiles (id) on delete cascade,
  lesson_id text not null,
  completed_day date not null,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create table if not exists tutai.learning_days (
  student_id text not null references tutai.student_profiles (id) on delete cascade,
  day date not null,
  -- The lesson that earned the day.
  lesson_id text not null,
  created_at timestamptz not null default now(),
  primary key (student_id, day)
);

-- Only the server's database roles read them, as with the other tutai tables.
alter table tutai.lesson_completions enable row level security;
alter table tutai.learning_days enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on tutai.lesson_completions, tutai.learning_days from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on tutai.lesson_completions, tutai.learning_days from authenticated;
  end if;
end
$$;
