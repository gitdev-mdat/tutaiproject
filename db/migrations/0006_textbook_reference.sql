-- Private source-document index and extraction review state. PDF bytes stay in
-- private object storage; these tables contain metadata and structured JSON only.
create table tutai.textbook_documents (
  id text primary key,
  sha256 char(64) not null unique,
  metadata jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tutai.textbook_page_anchors (
  document_id text not null references tutai.textbook_documents(id) on delete cascade,
  printed_page integer not null check (printed_page > 0),
  pdf_page integer not null check (pdf_page > 0),
  payload jsonb not null,
  primary key (document_id, printed_page)
);

create table tutai.textbook_toc_entries (
  document_id text not null references tutai.textbook_documents(id) on delete cascade,
  id text not null,
  parent_id text,
  payload jsonb not null,
  primary key (document_id, id),
  foreign key (document_id, parent_id)
    references tutai.textbook_toc_entries(document_id, id) deferrable initially deferred
);
create index textbook_toc_heading_idx on tutai.textbook_toc_entries using gin (payload jsonb_path_ops);

create table tutai.textbook_knowledge_mappings (
  id text primary key,
  document_id text not null references tutai.textbook_documents(id) on delete cascade,
  entry_id text not null,
  knowledge_node_id text not null,
  status text not null check (status in ('CANDIDATE', 'CONFIRMED', 'REJECTED')),
  payload jsonb not null,
  updated_at timestamptz not null,
  unique (document_id, entry_id, knowledge_node_id),
  foreign key (document_id, entry_id)
    references tutai.textbook_toc_entries(document_id, id) deferrable initially deferred
);

create table tutai.textbook_extraction_jobs (
  id text primary key,
  document_id text not null references tutai.textbook_documents(id) on delete cascade,
  extraction_key char(64) not null,
  status text not null check (status in ('QUEUED', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED')),
  payload jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  worker_lease_until timestamptz
);
create index textbook_jobs_queue_idx on tutai.textbook_extraction_jobs (created_at)
  where status in ('QUEUED', 'RUNNING', 'PARTIAL');
create unique index textbook_jobs_one_active_extraction_idx
  on tutai.textbook_extraction_jobs (extraction_key)
  where status in ('QUEUED', 'RUNNING', 'PARTIAL');

create table tutai.textbook_artifacts (
  id text primary key,
  document_id text not null references tutai.textbook_documents(id) on delete cascade,
  entry_id text not null,
  extraction_key char(64) not null,
  review_status text not null check (review_status in ('NEEDS_REVIEW', 'APPROVED', 'REJECTED')),
  payload jsonb not null,
  created_at timestamptz not null,
  foreign key (document_id, entry_id)
    references tutai.textbook_toc_entries(document_id, id) deferrable initially deferred
);
create index textbook_artifact_cache_idx on tutai.textbook_artifacts (extraction_key);
create index textbook_artifact_review_idx on tutai.textbook_artifacts (review_status, document_id);

do $$
declare t text;
begin
  foreach t in array array[
    'textbook_documents', 'textbook_page_anchors', 'textbook_toc_entries',
    'textbook_knowledge_mappings', 'textbook_extraction_jobs', 'textbook_artifacts'
  ] loop
    execute format('alter table tutai.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on tutai.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on tutai.%I from authenticated', t);
    end if;
  end loop;
end
$$;
