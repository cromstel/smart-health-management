/**
 * Retention service.
 *
 * Four tables in the platform only ever grow:
 *
 *  - `audit_logs` -- the security trail. Every write to a clinical record
 *    adds a row, so this is the largest of the four.
 *  - `analytics_events` -- the product analytics sink.
 *  - `notification_dedupe` -- the marker that stops the notification scanner
 *    from raising the same alert twice.
 *  - `shared_summaries` -- the time-limited share links.
 *
 * None of them had a purge, so an installation that ran for a year carried a
 * year of rows that nothing would ever read again. The purge is the
 * counterpart of `cleanupExpiredAuthRecords()` in the backup service: the
 * same idea, the same shape, the same place in the schedule.
 *
 * The window is configuration, in days, per table, read from the environment
 * so that an operator with a different record-keeping obligation can set it
 * without a code change. A value that is not a positive whole number of days
 * is reported and the default is used instead: a mistyped window must not
 * purge the audit trail, and it must not leave the table growing either.
 *
 * The cutoff is computed by the database's own clock (`TIMESTAMPADD` against
 * `NOW()`) rather than by the API host, so the window does not shift with the
 * timezone the service happens to run in, and the day count stays a bound
 * parameter rather than text spliced into the statement.
 */
import pool from '../config/database.js';
import type { ResultSetHeader } from 'mysql2/promise';
import { getAuditReportSchedule } from './auditLog.service.js';

/** The tables the purge keeps a window for. */
export type RetentionTable =
  | 'audit_logs'
  | 'analytics_events'
  | 'notification_dedupe'
  | 'shared_summaries';

/**
 * The default window for each table, and the environment variable that
 * overrides it.
 *
 * The audit trail is kept for seven years by default. It is the record of
 * what happened to a patient's data, and a record-keeping obligation is not
 * something the platform gets to shorten on its own.
 *
 * The analytics sink is kept for a year, which is longer than any product
 * report needs and short enough that a busy installation does not carry an
 * unbounded event log.
 *
 * The notification markers are kept for a month. Their only job is to stop
 * the same alert being raised twice; once a month has passed the alert they
 * were suppressing is no longer current, and the marker that suppresses it
 * again is not needed.
 *
 * The share links are kept for a quarter. A link has already stopped working
 * when it expires, so the row is kept for a while afterwards as the record
 * that a link was issued and has expired.
 */
export const RETENTION_DEFAULTS: Record<
  RetentionTable,
  { envVar: string; days: number }
> = {
  audit_logs: { envVar: 'AUDIT_LOG_RETENTION_DAYS', days: 2555 },
  analytics_events: { envVar: 'ANALYTICS_EVENT_RETENTION_DAYS', days: 365 },
  notification_dedupe: { envVar: 'NOTIFICATION_DEDUPE_RETENTION_DAYS', days: 30 },
  shared_summaries: { envVar: 'SHARED_SUMMARY_RETENTION_DAYS', days: 90 },
};

/**
 * How much history the audit trail has to keep for the reporting schedule.
 *
 * The schedule is stored by the operator (`audit_report_schedule`) and can be
 * daily, weekly, monthly or quarterly. A trail that was purged before the
 * period it is supposed to be reported over had closed would produce a report
 * with a hole in it, so the window the purge uses is never shorter than the
 * reporting period. The extra day is the day the report is produced on.
 *
 * A frequency that is not one of these is treated as the longest one that is
 * known, because an unrecognised value must not be the reason a report comes
 * out short.
 */
const REPORTING_PERIOD_DAYS: Record<string, number> = {
  daily: 2,
  weekly: 8,
  monthly: 32,
  quarterly: 93,
};

/** The period used when the schedule cannot be read. */
export const DEFAULT_REPORTING_PERIOD_DAYS = 32;

/**
 * Reads a retention window from the environment.
 *
 * The value has to be a positive whole number of days. Anything else is
 * reported and the default is used: a window of zero would purge the whole
 * table, and a window that is not a number cannot be turned into a cutoff.
 */
export const retentionDays = (table: RetentionTable): number => {
  const { envVar, days } = RETENTION_DEFAULTS[table];
  const configured = (process.env[envVar] ?? '').trim();
  if (configured === '') return days;

  const parsed = Number(configured);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(
      `[retention] ${envVar} ("${configured}") is not a positive whole number of days. Using ${days} instead.`
    );
    return days;
  }

  return parsed;
};

/**
 * How many days of audit history the reporting schedule needs.
 *
 * The schedule is read from the database, so a failure to read it must not
 * become a failure of the purge: the longest known period is used instead,
 * which is the safe direction to fail in.
 */
export const reportingPeriodDays = async (): Promise<number> => {
  try {
    const schedule = await getAuditReportSchedule();
    const frequency = String(schedule.frequency ?? '').trim().toLowerCase();
    return REPORTING_PERIOD_DAYS[frequency] ?? DEFAULT_REPORTING_PERIOD_DAYS;
  } catch (error) {
    console.error(
      '[retention] could not read the audit report schedule:',
      error instanceof Error ? error.message : String(error)
    );
    return DEFAULT_REPORTING_PERIOD_DAYS;
  }
};

/**
 * The window the audit trail is purged with.
 *
 * It is the configured window, raised to the reporting period when the
 * configured window is shorter than the period the schedule needs. A purge
 * must never remove an audit row that is still inside the window the
 * reporting schedule depends on.
 */
export const auditRetentionDays = async (): Promise<number> => {
  const configured = retentionDays('audit_logs');
  const required = await reportingPeriodDays();

  if (configured < required) {
    console.error(
      `[retention] AUDIT_LOG_RETENTION_DAYS (${configured}) is shorter than the reporting period (${required} days). Using ${required} days so the report is not produced from a trail with a hole in it.`
    );
    return required;
  }

  return configured;
};

/** What the purge removed, and the window each table was purged with. */
export interface RetentionPurgeResult {
  auditLogs: number;
  analyticsEvents: number;
  notificationDedupe: number;
  sharedSummaries: number;
  /** The window, in days, each table was purged with. */
  windows: Record<RetentionTable, number>;
}

/**
 * Removes the rows that are past their window.
 *
 * Every statement is bounded by its own cutoff, so a row that is still
 * inside its window is never removed. The window is the only thing that
 * decides what goes: there is no "keep the most recent N rows" rule that
 * would remove a row that is still inside its window.
 *
 * The audit trail is read from the reporting schedule before it is purged,
 * so the window it is purged with is the longer of the configured window and
 * the reporting period.
 */
export const purgeExpiredRecords = async (): Promise<RetentionPurgeResult> => {
  const auditDays = await auditRetentionDays();
  const analyticsDays = retentionDays('analytics_events');
  const dedupeDays = retentionDays('notification_dedupe');
  const sharedDays = retentionDays('shared_summaries');

  const [audit] = await pool.query<ResultSetHeader>(
    'DELETE FROM audit_logs WHERE created_at < TIMESTAMPADD(DAY, -?, NOW())',
    [auditDays]
  );

  // The analytics rows are aged by when the event happened, not by when it
  // was written: an event that happened long ago and arrived late is still an
  // old event.
  const [analytics] = await pool.query<ResultSetHeader>(
    'DELETE FROM analytics_events WHERE occurred_at < TIMESTAMPADD(DAY, -?, NOW())',
    [analyticsDays]
  );

  const [dedupe] = await pool.query<ResultSetHeader>(
    'DELETE FROM notification_dedupe WHERE created_at < TIMESTAMPADD(DAY, -?, NOW())',
    [dedupeDays]
  );

  // A share link stops working when it expires, so only an expired link is
  // eligible; the window still decides how long the row is kept afterwards.
  const [shared] = await pool.query<ResultSetHeader>(
    `DELETE FROM shared_summaries
      WHERE expires_at < NOW()
        AND created_at < TIMESTAMPADD(DAY, -?, NOW())`,
    [sharedDays]
  );

  return {
    auditLogs: audit.affectedRows ?? 0,
    analyticsEvents: analytics.affectedRows ?? 0,
    notificationDedupe: dedupe.affectedRows ?? 0,
    sharedSummaries: shared.affectedRows ?? 0,
    windows: {
      audit_logs: auditDays,
      analytics_events: analyticsDays,
      notification_dedupe: dedupeDays,
      shared_summaries: sharedDays,
    },
  };
};
