const EXECUTION_LOCK_KEY = Symbol.for('tutai.pipeline.execution-locks');

type PipelineGlobals = typeof globalThis & {
  [EXECUTION_LOCK_KEY]?: Set<string>;
};

function locks(): Set<string> {
  const globals = globalThis as PipelineGlobals;
  globals[EXECUTION_LOCK_KEY] ??= new Set<string>();
  return globals[EXECUTION_LOCK_KEY];
}

export function acquirePipelineExecutionLock(pipelineDocumentId: string): boolean {
  const active = locks();
  if (active.has(pipelineDocumentId)) return false;
  active.add(pipelineDocumentId);
  return true;
}

export function releasePipelineExecutionLock(pipelineDocumentId: string): void {
  locks().delete(pipelineDocumentId);
}

export function hasPipelineExecutionLock(pipelineDocumentId: string): boolean {
  return locks().has(pipelineDocumentId);
}
