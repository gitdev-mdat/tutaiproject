/**
 * Placeholder — Sprint 0
 * Route: /api/auth/[...nextauth]
 *
 * Authentication will be implemented in a future sprint.
 * Do not add authentication logic here.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Auth API — to be implemented' }, { status: 501 });
}
