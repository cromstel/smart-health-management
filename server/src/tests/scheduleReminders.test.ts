import { describe, it, expect, vi, afterEach, type Mock } from 'vitest';

// Mock the database pool before importing the module under test
vi.mock('../config/database.js', () => {
  const mockGetConnection = vi.fn();
  return {
    default: {
      getConnection: mockGetConnection,
    },
  };
});

// Import the module under test after mocks
import { scheduleReminders } from '../controllers/appointment.controller.js';

// Helper to create a fake DB connection
function createMockConnection(queryImpl: any) {
  return {
    query: queryImpl,
    release: vi.fn(),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('scheduleReminders', () => {
  it('should handle ECONNREFUSED error without throwing', async () => {
    const error: any = new Error('connect ECONNREFUSED');
    error.code = 'ECONNREFUSED';
    // Access mockGetConnection from the mocked module
    const { default: { getConnection } } = await import('../config/database.js');
    (getConnection as Mock).mockRejectedValueOnce(error);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(scheduleReminders()).resolves.not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls.some(call => (call[0] as string).includes('Database connection refused'))).toBe(true);

    consoleErrorSpy.mockRestore();
  });

  it('should execute successfully when there are no appointments', async () => {
    // Access mockGetConnection from the mocked module
    const { default: { getConnection } } = await import('../config/database.js');
    (getConnection as Mock).mockResolvedValueOnce(
      createMockConnection(async () => [[]])
    );

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(scheduleReminders()).resolves.not.toThrow();

    // Expect log indicating zero appointments
    expect(consoleLogSpy.mock.calls.some(call => (call[0] as string).includes('Retrieved 0 appointments'))).toBe(true);

    consoleLogSpy.mockRestore();
  });
});