/**
 * Notification controller.
 *
 * Thin layer: express-validator owns the input contract, the service owns
 * the behaviour. The controller never touches SQL.
 *
 * Every endpoint resolves the acting user from the JWT, so a client cannot
 * address another user's inbox by sending a different user id.
 */
import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.js';
import * as notificationService from '../services/notification.service.js';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

/**
 * The numeric user id from the JWT. `req.user.id` is a string in the token
 * payload; anything that is not a positive integer is treated as an
 * unauthenticated request.
 */
function resolveUserId(req: AuthRequest, res: Response): number | null {
  const raw = req.user?.id;
  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

/**
 * GET /api/notifications
 *
 * Query: unread, status, type, limit, offset.
 *
 * Runs the scanner first so a refresh picks up alerts that were generated
 * since the last poll; the scan is idempotent and throttled, so calling this
 * endpoint repeatedly is safe.
 */
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const query = req.query as Record<string, string | undefined>;

    await notificationService.scanNotifications(userId);

    const result = await notificationService.listNotifications(userId, {
      unread: query.unread === 'true',
      status: query.status as notificationService.NotificationStatus | undefined,
      type: query.type as notificationService.NotificationType | undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * POST /api/notifications/scan
 *
 * Runs the scanner on demand and reports what it produced. `force` bypasses
 * the in-process throttle so an operator can always trigger a fresh scan.
 */
export const scanNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const force = (req.query as Record<string, string | undefined>).force === 'true';
    const result = await notificationService.scanNotifications(userId, { force });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error scanning notifications:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to scan notifications' });
  }
};

/**
 * POST /api/notifications
 *
 * Creates a notification for the authenticated user.
 */
export const createNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const body = req.body ?? {};

    const notification = await notificationService.createNotification(userId, {
      type: body.type,
      priority: body.priority,
      title: body.title,
      message: body.message,
      status: body.status,
      patientId: body.patientId === undefined || body.patientId === null ? null : Number(body.patientId),
      patientName: body.patientName ?? null,
      appointmentId:
        body.appointmentId === undefined || body.appointmentId === null
          ? null
          : Number(body.appointmentId),
      doctorName: body.doctorName ?? null,
      appointmentTime: body.appointmentTime ?? null,
      actionUrl: body.actionUrl ?? null,
      data: body.data,
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 */
export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const notification = await notificationService.markNotificationRead(
      userId,
      Number(req.params.id)
    );

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.status(200).json(notification);
  } catch (error) {
    console.error('Error marking notification read:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

/**
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const updated = await notificationService.markAllNotificationsRead(userId);

    res.status(200).json({ updated });
  } catch (error) {
    console.error('Error marking all notifications read:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

/**
 * PATCH /api/notifications/:id
 *
 * Updates the workflow status (pending / confirmed / resolved / dismissed).
 */
export const updateNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const notification = await notificationService.updateNotificationStatus(
      userId,
      Number(req.params.id),
      req.body.status
    );

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.status(200).json(notification);
  } catch (error) {
    console.error('Error updating notification:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

/**
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const deleted = await notificationService.deleteNotification(userId, Number(req.params.id));

    if (!deleted) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};
