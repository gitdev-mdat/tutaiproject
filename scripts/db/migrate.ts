// Applies pending SQL migrations. Usage: DATABASE_URL=... pnpm db:migrate [--dry-run]
import { runMigrations } from '@/lib/db/migrations';
import { connect } from './connect';

async function main() {
  const sql = connect();
  const dryRun = process.argv.includes('--dry-run');
  try {
    const result = await runMigrations(sql, { dryRun });
    console.log(JSON.stringify({ dryRun, ...result }, null, 2));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
