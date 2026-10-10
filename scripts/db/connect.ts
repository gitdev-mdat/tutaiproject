import postgres from 'postgres';

/** A short-lived client for command-line scripts. Prints where it connects, never the password. */
export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(2);
  }
  const { hostname, port, pathname } = new URL(url);
  console.error(`Database: ${hostname}:${port || 5432}${pathname}`);
  return postgres(url, { max: 1, prepare: false, onnotice: () => {} });
}
