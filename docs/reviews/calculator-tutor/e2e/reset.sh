set -e
psql -q postgres://postgres:postgres@127.0.0.1:5432/postgres -c "drop database if exists calc_tutor_e2e with (force)" -c "create database calc_tutor_e2e"
S=${QA_DIR:-$(cd "$(dirname "$0")" && pwd)}
cd "${APP_DIR:-$S/../../../..}" && QA_DIR=$S pnpm vitest run --config "$S/vitest.e2e.config.ts" seed 2>&1 | tail -4
