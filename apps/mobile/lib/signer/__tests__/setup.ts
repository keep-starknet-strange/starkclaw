/**
 * Test setup for signer client tests
 * Configures global test environment
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Setup global fetch mock
beforeAll(() => {
  global.fetch = vi.fn();
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Global teardown
afterAll(() => {
  vi.restoreAllMocks();
});
