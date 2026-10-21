import { describe, it, expect, afterEach, vi } from 'vitest';
import { backupSchedule, DEFAULT_BACKUP_SCHEDULE } from '../services/cron.service.js';

describe('the daily backup schedule', () => {
  const original = process.env.BACKUP_CRON;

  afterEach(() => {
    if (original === undefined) delete process.env.BACKUP_CRON;
    else process.env.BACKUP_CRON = original;
    vi.restoreAllMocks();
  });

  it('is the configured schedule when it is a schedule', () => {
    process.env.BACKUP_CRON = '15 3 * * *';
    expect(backupSchedule()).toBe('15 3 * * *');
  });

  it('is the default when nothing is configured', () => {
    delete process.env.BACKUP_CRON;
    expect(backupSchedule()).toBe(DEFAULT_BACKUP_SCHEDULE);
  });

  it('is the default, and says so, when the configured schedule is not one', () => {
    // A mistyped expression must not stop the service from starting, and it
    // must not leave the backups unsaid-for either.
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.BACKUP_CRON = '0 0 31 2 *';

    expect(backupSchedule()).toBe(DEFAULT_BACKUP_SCHEDULE);
    expect(error).toHaveBeenCalled();
    expect(String(error.mock.calls[0][0])).toContain('BACKUP_CRON');
  });
});
