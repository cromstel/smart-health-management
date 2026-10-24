/**
 * Analytics event controller.
 *
 * The browser beacon is anonymous by default (it does not attach a bearer
 * token), so authentication is optional here: a valid token attaches the
 * event to the user, an absent or invalid one simply leaves user_id null.
 *
 * The response is truthful. When the event cannot be persisted the endpoint
 * answers with a non-success status and `synced: false`, so the client keeps
 * the event in its offline queue instead of dropping it.
 */
import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { getSecret } from '../config/env.js';
import * as analyticsService from '../services/analytics.service.js';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

/**
 * Resolve the caller from an optional bearer token.
 *
 * Returns null for an anonymous or unusable token. The token itself is never
 * logged.
 */
const resolveOptionalUser = (req: Request): number | null => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(
      header.slice(7),
      getSecret('JWT_SECRET', 'dev-only-jwt-secret')
    ) as { id?: string };
    const id = Number(decoded?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
};

/**
 * POST /api/analytics/event
 *
 * Body: { id?, type, payload?, timestamp?, sessionId?, pageUrl? }
 * Response: { status: 'success', synced: true, eventId }
 */
export const recordEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const body = req.body as Record<string, unknown>;
    const payload = (body.payload ?? {}) as Record<string, unknown>;

    const eventName = String(body.type || '').trim();
    if (!eventName) {
      res.status(400).json({ status: 'error', synced: false, error: 'Event type is required' });
      return;
    }

    const timestamp = Number(body.timestamp);
    const occurredAt =
      Number.isFinite(timestamp) && timestamp > 0
        ? analyticsService.epochToDateTime(timestamp)
        : analyticsService.nowAsDateTime();

    const sessionId =
      body.sessionId ??
      payload.sessionId ??
      payload.session_id ??
      null;

    const pageUrl =
      body.pageUrl ??
      payload.pageUrl ??
      payload.page_url ??
      payload.page ??
      null;

    const eventData: Record<string, unknown> = { ...payload };
    if (body.id) eventData.clientEventId = String(body.id);
    if (timestamp) eventData.clientTimestamp = timestamp;

    const eventId = await analyticsService.recordAnalyticsEvent({
      eventName,
      eventData,
      userId: resolveOptionalUser(req),
      sessionId: sessionId === null ? null : String(sessionId),
      pageUrl: pageUrl === null ? null : String(pageUrl),
      occurredAt,
    });

    res.status(201).json({ status: 'success', synced: true, eventId });
  } catch (error) {
    console.error(
      'Error persisting analytics event:',
      error instanceof Error ? error.message : error
    );
    // The event was not stored. Answer with a non-success status so the client
    // keeps the event in its offline queue instead of dropping it.
    res.status(503).json({
      status: 'error',
      synced: false,
      error: 'Analytics event could not be stored',
    });
  }
};
