-- Accounts, sessions and student profiles (previously data/runtime/auth-store.json).
--
-- Tables live in their own schema, not `public`, so Supabase's REST API does
-- not expose them. Only the Next.js server connects, with DATABASE_URL.
-- Ids are text so that ids already issued by the JSON store keep working.

create schema if not exists tutai;

create table tutai.users (
  id text primary key,
  username text unique check (username = lower(username)),
  email text unique check (email = lower(email)),
  email_verified_at timestamptz,
  display_name text,
  avatar_url text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (username is not null or email is not null)
);

create table tutai.identities (
  id text primary key,
  user_id text not null references tutai.users (id) on delete cascade,
  provider text not null check (provider in ('password', 'google')),
  provider_account_id text not null,
  password_hash text,
  created_at timestamptz not null,
  unique (provider, provider_account_id),
  check ((provider = 'password') = (password_hash is not null))
);
create index identities_user_id_idx on tutai.identities (user_id);
create unique index identities_one_password_per_user
  on tutai.identities (user_id) where provider = 'password';

create table tutai.student_profiles (
  id text primary key,
  user_id text not null unique references tutai.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  province_code text,
  province_name text,
  school_id text,
  school_name text,
  school_source text check (school_source in ('dataset', 'custom')),
  grade text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table tutai.learning_profiles (
  student_id text primary key references tutai.student_profiles (id) on delete cascade,
  primary_subject text,
  current_score double precision check (current_score between 0 and 10),
  target_score double precision check (target_score between 0 and 10),
  updated_at timestamptz not null
);

create table tutai.student_acquisitions (
  student_id text primary key references tutai.student_profiles (id) on delete cascade,
  source text not null,
  source_other text,
  recorded_at timestamptz not null
);

-- Legacy consent choices; onboarding no longer writes them but they are kept.
create table tutai.communication_preferences (
  student_id text primary key references tutai.student_profiles (id) on delete cascade,
  consultation_consent boolean not null,
  marketing_consent boolean not null,
  consent_updated_at timestamptz not null
);

create table tutai.sessions (
  id text primary key,
  user_id text not null references tutai.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null
);
create index sessions_user_id_idx on tutai.sessions (user_id);
create index sessions_expires_at_idx on tutai.sessions (expires_at);

create table tutai.password_resets (
  id text primary key,
  user_id text not null references tutai.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null
);
create index password_resets_user_id_idx on tutai.password_resets (user_id);

create table tutai.enrollments (
  id text primary key,
  student_id text not null references tutai.student_profiles (id) on delete cascade,
  program_version_id text not null,
  status text not null check (status in ('active')),
  assigned_at timestamptz not null
);
create unique index enrollments_one_active_per_student
  on tutai.enrollments (student_id) where status = 'active';

create table tutai.assignment_attempts (
  student_id text not null references tutai.student_profiles (id) on delete cascade,
  profile_fingerprint text not null,
  status text not null check (status in ('blocked')),
  code text not null,
  retryable boolean not null,
  incident_id text not null,
  attempted_at timestamptz not null,
  primary key (student_id, profile_fingerprint)
);

-- Defence in depth for Supabase: even if the schema is ever exposed, the
-- browser roles get nothing. Row level security with no policies denies all
-- access to roles that do not bypass it.
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'identities', 'student_profiles', 'learning_profiles', 'student_acquisitions',
    'communication_preferences', 'sessions', 'password_resets', 'enrollments',
    'assignment_attempts'
  ] loop
    execute format('alter table tutai.%I enable row level security', t);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema tutai from anon;
    revoke all on all tables in schema tutai from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on schema tutai from authenticated;
    revoke all on all tables in schema tutai from authenticated;
  end if;
end
$$;
