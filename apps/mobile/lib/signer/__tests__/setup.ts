/**
 * Test setup for signer client tests
 * Configures global test environment
 */

import { beforeEach, afterEach, vi } from 'vitest';

const realFetch = global.fetch.bind(globalThis);

beforeEach(() => {
  global.fetch = realFetch as typeof global.fetch;
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = realFetch as typeof global.fetch;
});
