import { NextResponse } from 'next/server';
import { commitImportSession } from '@/lib/knowledge-graph/kg-import-service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const simulateFail = req.headers.get('x-simulate-commit-fail') === 'true';
    if (simulateFail) {
      process.env.SIMULATE_COMMIT_FAIL = 'true';
    } else {
      delete process.env.SIMULATE_COMMIT_FAIL;
    }
    await commitImportSession(resolvedParams.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  } finally {
    delete process.env.SIMULATE_COMMIT_FAIL;
  }
}
