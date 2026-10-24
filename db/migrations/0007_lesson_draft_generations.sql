-- Provenance of AI lesson drafts: which approved textbook extracts were really
-- sent to the model for a draft, under which prompt version and model, and
-- whether the Admin applied and saved it. Additive only. Holds ids, page
-- numbers and content hashes, never the textbook text or the draft itself.

create table tutai.lesson_draft_generations (
  id text primary key,
  knowledge_node_id text not null,
  mode text not null check (mode in ('TEXTBOOK', 'GENERAL')),
  status text not null check (status in ('PROPOSED', 'APPLIED', 'SAVED')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb not null
);
create index lesson_draft_generations_node_idx
  on tutai.lesson_draft_generations (knowledge_node_id, created_at desc);

alter table tutai.lesson_draft_generations enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on tutai.lesson_draft_generations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on tutai.lesson_draft_generations from authenticated;
  end if;
end
$$;
