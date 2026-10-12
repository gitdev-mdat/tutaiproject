// Copies data/runtime/auth-store.json (or --file) into PostgreSQL.
// Dry run by default; --apply commits. The JSON file is only read, never changed.
// Usage: DATABASE_URL=... pnpm db:import-auth [--file path] [--apply] [--report out.json]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { countAuthTables, importAuthSnapshot, parseSnapshot } from '@/lib/auth/import-json';
import { connect } from './connect';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const file = path.resolve(option('--file') ?? 'data/runtime/auth-store.json');
const apply = process.argv.includes('--apply');
const reportPath = option('--report');

async function main() {
  const sql = connect();
  try {
    const snapshot = parseSnapshot(await readFile(file, 'utf8'));
    const report = await importAuthSnapshot(sql, snapshot, { dryRun: !apply });
    const output = { file, ...report, databaseCounts: await countAuthTables(sql) };
    console.log(JSON.stringify(output, null, 2));
    if (reportPath) await writeFile(reportPath, `${JSON.stringify(output, null, 2)}\n`);
    if (report.errors.length) process.exitCode = 1;
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
