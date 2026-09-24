/**
 * Vitest setup — runs before any test module is evaluated.
 *
 * Stubbing `server-only` at the Node.js module level so that
 * lib/pipeline/pipeline-orchestrator.ts can be imported in tests.
 * The real server-only guard (throwing in client environments) is bypassed here.
 */

// Stub the server-only module in the Node.js module cache
// so that any import of 'server-only' (including the one inside
// lib/pipeline/pipeline-orchestrator.ts) resolves to a no-op.
import Module from 'node:module';

const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: unknown, id: string, ...args: unknown[]) {
  if (id === 'server-only' || id.endsWith('/server-only')) {
    // Return an empty object — the guard never runs
    return {};
  }
  return originalRequire.apply(this, [id, ...args] as [id: string]);
};
