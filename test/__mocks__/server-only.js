// No-op stub for server-only in test environment
// The real module throws "This module cannot be imported from a Client Component module."
// This stub prevents that error in vitest (node environment).
const mock = {};
export default mock;
