import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { cleanupExpiredAuthRecords, runDatabaseBackup } from './backup.service.js';

/**
 * Status of one scheduled job, surfaced by the super-admin health endpoint
 * so the console can show what the scheduler is actually doing instead of
 * reporting a hardcoded "healthy".
 */
export interface ScheduledJobStatus {
  name: string;
  schedule: string;
  /** node-cron task state: 'scheduled', 'running', 'stopped', ... */
  state: string;
  lastRunAt: string | null;
  lastResult: 'success' | 'error' | null;
  lastError: string | null;
  nextRunAt: string | null;
}

const jobStatuses = new Map<string, ScheduledJobStatus>();
const scheduledTasks: ScheduledTask[] = [];

/** The schedule used when none is configured, or when the configured one is not a schedule. */
export const DEFAULT_BACKUP_SCHEDULE = '0 2 * * *';

/**
 * The daily backup schedule.
 *
 * The schedule is configuration, so it is read from the environment rather
 * than written down here. A schedule that cannot be parsed is reported and
 * the default is used instead: a mistyped expression must not stop the
 * service from starting, and it must not leave the backups unsaid-for
 * either.
 */
export const backupSchedule = (): string => {
  const configured = (process.env.BACKUP_CRON ?? '').trim();
  if (configured === '') return DEFAULT_BACKUP_SCHEDULE;
  if (cron.validate(configured)) return configured;
  console.error(
    `[cron] BACKUP_CRON ("${configured}") is not a valid schedule. Using ${DEFAULT_BACKUP_SCHEDULE} instead.`
  );
  return DEFAULT_BACKUP_SCHEDULE;
};

/** Snapshot of every job this scheduler owns. */
export const getScheduledJobStatuses = (): ScheduledJobStatus[] =>
  Array.from(jobStatuses.values()).map((job) => ({ ...job }));

const updateJobStatus = (
  name: string,
  patch: Partial<ScheduledJobStatus>
): void => {
  const current = jobStatuses.get(name);
  if (!current) {
    return;
  }
  jobStatuses.set(name, { ...current, ...patch });
};

/**
 * Registers a job and keeps its status up to date.
 *
 * The status is updated after every run so the health endpoint reports the
 * real outcome of the last tick (including its failure), not a constant.
 */
const registerJob = (
  name: string,
  schedule: string,
  handler: () => Promise<void>
): void => {
  jobStatuses.set(name, {
    name,
    schedule,
    state: 'scheduled',
    lastRunAt: null,
    lastResult: null,
    lastError: null,
    nextRunAt: null,
  });

  const task = cron.schedule(
    schedule,
    async () => {
      updateJobStatus(name, { state: 'running', lastRunAt: new Date().toISOString() });
      try {
        await handler();
        updateJobStatus(name, { lastResult: 'success', lastError: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[cron] job "${name}" failed:`, message);
        updateJobStatus(name, { lastResult: 'error', lastError: message });
      } finally {
        updateJobStatus(name, {
          state: 'scheduled',
          nextRunAt: task.getNextRun()?.toISOString() ?? null,
        });
      }
    },
    { name }
  );

  scheduledTasks.push(task);
  updateJobStatus(name, { state: task.getStatus(), nextRunAt: task.getNextRun()?.toISOString() ?? null });
};

/**
 * Schedules the maintenance jobs.
 *
 * The backup used to be scheduled by calling the HTTP controller with a
 * fabricated request/response pair. The fake request had no `ip` and no
 * `user`, so the tick threw inside the controller and no audit row was
 * written. The real work now lives in the backup service, which takes plain
 * parameters, and both the HTTP endpoint and the scheduler call it.
 */
export const scheduleBackups = (): void => {
  registerJob('database-backup', backupSchedule(), async () => {
    console.log('Running daily database backup...');
    const result = await runDatabaseBackup({
      triggeredBy: null,
      ipAddress: null,
      userAgent: 'scheduler',
    });
    if (result.success) {
      console.log(`Daily database backup completed: ${result.fileName}`);
    } else {
      console.error('Daily database backup failed:', result.error);
    }
  });

  registerJob('auth-record-cleanup', '*/15 * * * *', async () => {
    const removed = await cleanupExpiredAuthRecords();
    if (removed.revokedTokens > 0 || removed.passwordResets > 0) {
      console.log(
        `Auth record cleanup removed ${removed.revokedTokens} revoked token(s) and ${removed.passwordResets} password reset row(s)`
      );
    }
  });
};
