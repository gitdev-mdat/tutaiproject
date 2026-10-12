-- Each student's roadmap state (roadmap, assignment, diagnostic attempts,
-- competencies, activity outcomes) as one JSON record, so it survives on
-- Vercel, where the data/roadmaps file cannot be written.
create table if not exists tutai.student_roadmaps (
  student_id text primary key references tutai.student_profiles (id) on delete cascade,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

-- Only the server's database roles read it, as with the other tutai tables.
alter table tutai.student_roadmaps enable row level security;
