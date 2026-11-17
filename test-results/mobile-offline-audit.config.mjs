// Isolated audit: do not load the application Vite config or production env files.
export default {
  envDir: false,
  test: {
    environment: 'node',
    include: ['test-results/mobile-offline-audit.test.ts'],
    fileParallelism: false,
  },
};
