set -e
psql -q postgres://postgres:postgres@127.0.0.1:5432/postgres -c "drop database if exists tb_flow_e2e with (force)" -c "create database tb_flow_e2e"
S=${QA_DIR:-$(cd "$(dirname "$0")" && pwd)}
cd "$S/../../../.." && pnpm vitest run --config "$S/vitest.e2e.config.ts" seed 2>&1 | tail -4
