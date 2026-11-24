#!/bin/bash
# (Re)start local QA servers: 3401 = pp_qa, 3402 = pp_empty. Never Production.
pkill -f "next-serve[r]"; pkill -f "nex[t] start"; sleep 1
cd /home/user/tutaiproject
if [ "$1" = "build" ]; then DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/pp_qa npx next build > /tmp/claude-0/pp/build.log 2>&1 || { echo build failed; tail -30 /tmp/claude-0/pp/build.log; exit 1; }; git checkout -q next-env.d.ts 2>/dev/null; fi
[ -f /tmp/claude-0/pp/subs.json ] || echo '[]' > /tmp/claude-0/pp/subs.json
for p in "3401 pp_qa" "3402 pp_empty"; do set -- $p
  DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/$2 ADMIN_EMAILS=qa-admin@tutai.invalid TUTAI_SUBSCRIPTIONS_FILE=/tmp/claude-0/pp/subs.json TUTAI_ROADMAPS_FILE=/tmp/claude-0/pp/roadmaps-$2.json setsid nohup npx next start -p $1 > /tmp/claude-0/pp/server-$2.log 2>&1 < /dev/null &
done
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3401/ && curl -s -o /dev/null http://localhost:3402/ && break; sleep 1; done
curl -s -o /dev/null -w "%{http_code} " http://localhost:3401/; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3402/
