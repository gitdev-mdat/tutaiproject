// Vitest auto-mock for @/lib/ai/gemini-client
// Actual implementations are set per-test via vi.mock mocks.

export const gemini = {
  files: {
    upload: () => {},
    get: () => {},
    delete: () => {},
  },
  models: {
    generateContent: () => {},
  },
};
