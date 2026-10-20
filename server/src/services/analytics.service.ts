/**
 * Analytics event service.
 *
 * The client used to POST analytics events to an endpoint that answered
 * "{ status: 'success', synced: true }" without storing anything, so every
 * event was silently dropped while the browser believed it had been synced.
 * Events are now persisted to `analytics_events`.
 */
import pool from '../config/database.js';
import type { ResultSetHeader } from 'mysql2/promise';

export interface AnalyticsEventInput {
  eventName: string;
  eventData?: Record<string, unknown> | null;
  userId?: number | null;
  sessionId?: string | null;
  pageUrl?: string | null;
  occurredAt: string;
}

function formatLocalDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
    `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
}

/**
 * Persist one analytics event. Returns the inserted row id.
 */
export async function recordAnalyticsEvent(input: AnalyticsEventInput): Promise<number> {
  const eventData = input.eventData ? JSON.stringify(input.eventData) : null;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO analytics_events
      (event_name, event_data, user_id, session_id, page_url, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.eventName.slice(0, 100),
      eventData,
      input.userId ?? null,
      input.sessionId ? String(input.sessionId).slice(0, 100) : null,
      input.pageUrl ? String(input.pageUrl).slice(0, 500) : null,
      input.occurredAt,
    ]
  );

  return result.insertId;
}

/**
 * Count the stored events, used by the health check of the analytics sink.
 */
export async function countAnalyticsEvents(): Promise<number> {
  const [rows] = await pool.query<any[]>('SELECT COUNT(*) AS count FROM analytics_events');
  return Number(rows?.[0]?.count ?? 0);
}

export function nowAsDateTime(): string {
  return formatLocalDateTime(new Date());
}

export function epochToDateTime(epochMs: number): string {
  return formatLocalDateTime(new Date(epochMs));
}
