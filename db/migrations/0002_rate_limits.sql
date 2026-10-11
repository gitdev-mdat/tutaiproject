-- Fixed-window counters for login and password-reset requests. Keys are
-- hashes of the identifier or client address, never the raw values.
create table if not exists tutai.rate_limits (
  key text primary key,
  count integer not null check (count > 0),
  window_started_at timestamptz not null
);

create index if not exists rate_limits_window_started_at_idx
  on tutai.rate_limits (window_started_at);

alter table tutai.rate_limits enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on tutai.rate_limits from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on tutai.rate_limits from authenticated;
  end if;
end
$$;
