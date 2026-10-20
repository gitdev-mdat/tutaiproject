-- Private source textbooks used as authoring references for the Knowledge Tree.
-- Additive only: new tables in the server-only tutai schema. PDF bytes stay in
-- a private Storage bucket; these tables hold metadata and structured JSON.
-- Nothing here is read by student-facing routes.

create table tutai.textbook_documents (
  id text primary key,
  sha256 char(64) not null unique,
  status text not null check (status in ('VERIFYING', 'REGISTERED', 'INDEXING', 'INDEXED', 'FAILED')),
  metadata jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per browser upload attempt. The object key is derived from the
-- declared SHA-256, so a retried upload resumes the same object.
create table tutai.textbook_uploads (
  id text primary key,
  sha256 char(64) not null,
  byte_size bigint not null check (byte_size > 0),
  original_filename text not null,
  title text not null,
  storage_key text not null,
  status text not null check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  document_id text references tutai.textbook_documents(id) on delete set null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create unique index textbook_uploads_one_pending_idx
  on tutai.textbook_uploads (sha256) where status = 'PENDING';

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
  position integer not null default 0,
  payload jsonb not null,
  primary key (document_id, id),
  foreign key (document_id, parent_id)
    references tutai.textbook_toc_entries(document_id, id) deferrable initially deferred
);

create table tutai.textbook_knowledge_mappings (
  id text primary key,
  document_id text not null references tutai.textbook_documents(id) on delete cascade,
  entry_id text not null,
  knowledge_node_id text not null,
  status text not null check (status in ('CONFIRMED', 'REJECTED')),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique (document_id, entry_id, knowledge_node_id),
  foreign key (document_id, entry_id)
    references tutai.textbook_toc_entries(document_id, id) on delete cascade
);
create index textbook_mappings_node_idx
  on tutai.textbook_knowledge_mappings (knowledge_node_id) where status = 'CONFIRMED';

-- Work for the textbook worker: VERIFY (checksum, page count), INDEX_TOC
-- (read the printed table of contents) and EXTRACT (bounded page batches).
create table tutai.textbook_jobs (
  id text primary key,
  document_id text not null references tutai.textbook_documents(id) on delete cascade,
  kind text not null check (kind in ('VERIFY', 'INDEX_TOC', 'EXTRACT')),
  job_key char(64) not null,
  status text not null check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  attempts integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lease_owner text,
  lease_until timestamptz
);
create index textbook_jobs_queue_idx on tutai.textbook_jobs (created_at)
  where status in ('QUEUED', 'RUNNING');
create unique index textbook_jobs_one_active_idx
  on tutai.textbook_jobs (job_key) where status in ('QUEUED', 'RUNNING');

create table tutai.textbook_artifacts (
  id text primary key,
  document_id text not null references tutai.textbook_documents(id) on delete cascade,
  entry_id text not null,
  extraction_key char(64) not null,
  review_status text not null check (review_status in ('NEEDS_REVIEW', 'APPROVED', 'REJECTED')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  foreign key (document_id, entry_id)
    references tutai.textbook_toc_entries(document_id, id)
);
create index textbook_artifact_cache_idx on tutai.textbook_artifacts (extraction_key);
create index textbook_artifact_review_idx on tutai.textbook_artifacts (document_id, review_status);

-- Liveness of worker processes, so the Admin sees whether anything is
-- processing the queue instead of an assumed background service.
create table tutai.textbook_workers (
  id text primary key,
  hostname text not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  current_job_id text
);

do $$
declare t text;
begin
  foreach t in array array[
    'textbook_documents', 'textbook_uploads', 'textbook_page_anchors', 'textbook_toc_entries',
    'textbook_knowledge_mappings', 'textbook_jobs', 'textbook_artifacts', 'textbook_workers'
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
