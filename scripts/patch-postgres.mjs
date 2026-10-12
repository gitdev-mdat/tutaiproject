// Next.js replaces the global setImmediate while it renders and can drop a
// callback queued right at the end of a render. postgres.js flushes queued
// protocol messages with setImmediate, so a query could be left half-sent
// (parsed by the server, never bound or executed) until our socket watchdog
// in lib/db/postgres.ts killed it 12 s later. This switches postgres.js to the
// native timers that Next keeps under a global symbol. Remove it once
// postgres.js or Next no longer needs it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const MARKER = 'tutaiNativeImmediate';
const HELPER = `  function ${MARKER}() {
    return globalThis[Symbol.for('next.fast-set-immediate.originals')] || { setImmediate, clearImmediate }
  }

  function write(x, fn) {`;

// The default export is cjs/src/index.js; the package root is two levels up.
const root = join(dirname(createRequire(import.meta.url).resolve('postgres')), '..', '..');
for (const file of ['src/connection.js', 'cjs/src/connection.js']) {
  const path = join(root, file);
  let source = readFileSync(path, 'utf8');
  if (source.includes(MARKER)) continue;
  if (!source.includes('  function write(x, fn) {')) {
    throw new Error(`patch-postgres: unexpected source in ${path}; check the postgres.js version.`);
  }
  source = source
    .replace('  function write(x, fn) {', HELPER)
    .replace(
      '(nextWriteTimer = setImmediate(nextWrite))',
      `(nextWriteTimer = ${MARKER}().setImmediate(nextWrite))`
    )
    .replaceAll('clearImmediate(nextWriteTimer)', `${MARKER}().clearImmediate(nextWriteTimer)`);
  writeFileSync(path, source);
}
