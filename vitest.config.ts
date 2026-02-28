import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Run test files sequentially — they all share the ruin_test database and
    // truncate tables in beforeEach/afterAll. Parallel execution causes race
    // conditions where one file's truncation deletes rows another file is using.
    fileParallelism: false,
  },
});
