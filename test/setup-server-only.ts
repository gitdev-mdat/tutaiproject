// Stub server-only before any test file imports it.
// This runs before module resolution, so server-only/index.js never throws.
const mock = {};
export default mock;
