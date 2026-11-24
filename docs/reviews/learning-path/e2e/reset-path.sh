#!/bin/bash
# Fresh pp_path (copy of pp_one) and restarted servers.
pkill -f "nex[t] start"; sleep 1
sleep 1; PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -qAtc "select pg_terminate_backend(pid) from pg_stat_activity where datname in ('pp_path','pp_one') and pid <> pg_backend_pid()" >/dev/null
PGPASSWORD=postgres dropdb -h 127.0.0.1 -U postgres --if-exists pp_path
PGPASSWORD=postgres createdb -h 127.0.0.1 -U postgres -T pp_one pp_path
bash /tmp/claude-0/pp/restart.sh | tail -1
