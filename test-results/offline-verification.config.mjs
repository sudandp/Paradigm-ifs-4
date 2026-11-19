// Reproduce the 2026-11-19 verification without loading production Vite/env config.
export default {
  envDir: false,
  test: {
    environment: 'node',
    include: ['services/offline/**/*.test.ts', 'test-results/**/*.test.ts'],
    // Historical audit tests assert the old defects, not the required fixed behavior.
    exclude: ['test-results/mobile-offline-audit.test.ts'],
    fileParallelism: false,
  },
};
