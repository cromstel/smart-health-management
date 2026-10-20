/**
 * Notification service tests.
 *
 * The pure rules (prescription course length) are unit tested without a
 * database. The scanner and the inbox CRUD run against the live database
 * and are skipped when it is not reachable, the same pattern the other
 * server suites use.
 */
import { describe, it, expect, afterAll } from 'vitest';
import pool from '../config/database.js';
import * as notificationService from '../services/notification.service.js';

let dbAvailable = false;

const TEST_EMAIL = `notify-test-${Date.now()}@smarthealth.com`;
let testUserId = 0;
let testPatientId = 0;
let testAppointmentId = 0;
let testAppointmentCode = '';
let testHospitalId = 0;

/**
 * Creates a user, a patient and an appointment that starts in 10 minutes.
 *
 * The fixture gets its own hospital so the scanner's scope is isolated from
 * the seeded hospital's data, and the user is a nurse (no pharmacy
 * permission) so the inventory scanner stays out of the way.
 */
async function seedFixture(): Promise<void> {
  const [hospitalResult] = await pool.query(
    `INSERT INTO hospitals (hospital_id, name, status) VALUES (?, 'Notification Test Hospital', 'active')`,
    [`NTEST-${Date.now()}`]
  );
  testHospitalId = Number((hospitalResult as any).insertId);

  const [userResult] = await pool.query(
    `INSERT INTO users (email, password, name, status, role_id, hospital_id)
     VALUES (?, 'not-a-real-hash', 'Notification Test User', 'active', 5, ?)`,
    [TEST_EMAIL, testHospitalId]
  );
  testUserId = Number((userResult as any).insertId);

  const [patientResult] = await pool.query(
    `INSERT INTO patients (patient_id, first_name, last_name, age, gender, hospital_id, status)
     VALUES (?, 'Notify', 'Tester', 44, 'other', ?, 'active')`,
    [`NPT-${Date.now()}`, testHospitalId]
  );
  testPatientId = Number((patientResult as any).insertId);

  testAppointmentCode = `NAPP-${Date.now()}`;
  const [appointmentResult] = await pool.query(
    `INSERT INTO appointments
       (appointment_id, patient_id, doctor_id, appointment_date, appointment_time, type, status)
     VALUES (?, ?, (SELECT id FROM staff LIMIT 1), CURDATE(), TIME(NOW() + INTERVAL 10 MINUTE),
             'Consultation', 'scheduled')`,
    [testAppointmentCode, testPatientId]
  );
  testAppointmentId = Number((appointmentResult as any).insertId);
}

async function cleanupFixture(): Promise<void> {
  if (testUserId) {
    await pool.query('DELETE FROM notification_dedupe WHERE user_id = ?', [testUserId]);
    await pool.query('DELETE FROM notifications WHERE user_id = ?', [testUserId]);
  }
  if (testAppointmentId) {
    await pool.query('DELETE FROM appointments WHERE id = ?', [testAppointmentId]);
  }
  if (testPatientId) {
    await pool.query('DELETE FROM patients WHERE id = ?', [testPatientId]);
  }
  if (testUserId) {
    await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
  }
  if (testHospitalId) {
    await pool.query('DELETE FROM hospitals WHERE id = ?', [testHospitalId]);
  }
}

// The database is probed before the suite is collected, not in a beforeAll:
// `it.skip` has to be decided while the file is being collected, and a
// beforeAll runs after that, so a probe there would skip every test.
try {
  await pool.query('SELECT 1 FROM notifications LIMIT 1');
  await seedFixture();
  dbAvailable = true;
} catch (error) {
  console.warn(
    'Notification tests skipped: database not available',
    error instanceof Error ? error.message : String(error)
  );
  dbAvailable = false;
}

const skipIfNoDb = dbAvailable ? it : it.skip;

describe('Notification service', () => {
  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanupFixture();
  });

  describe('derivePrescriptionDurationDays', () => {
    it('prefers the stored duration when there is one', () => {
      expect(notificationService.derivePrescriptionDurationDays(30, 'Once daily', 10)).toBe(30);
    });

    it('derives the course length from quantity and frequency', () => {
      // 60 tablets taken twice a day is a 30 day course.
      expect(notificationService.derivePrescriptionDurationDays(null, 'Twice daily', 60)).toBe(30);
      // 45 tablets taken three times a day is a 15 day course.
      expect(notificationService.derivePrescriptionDurationDays(null, 'Three times daily', 45)).toBe(15);
      // Every 8 hours is three doses a day.
      expect(notificationService.derivePrescriptionDurationDays(null, 'Every 8 hours', 30)).toBe(10);
    });

    it('returns null when the course length cannot be determined', () => {
      expect(notificationService.derivePrescriptionDurationDays(null, null, 0)).toBeNull();
      expect(notificationService.derivePrescriptionDurationDays(null, 'Once daily', null)).toBeNull();
    });
  });

  skipIfNoDb('scanner raises one alert per upcoming appointment and never twice', async () => {
    const first = await notificationService.scanNotifications(testUserId, { force: true });
    expect(first.created).toBeGreaterThanOrEqual(1);
    expect(first.byType.upcoming_appointment).toBeGreaterThanOrEqual(1);

    const second = await notificationService.scanNotifications(testUserId, { force: true });
    expect(second.created).toBe(0);

    // The dedupe marker is what stops the alert from being raised twice.
    // MariaDB does not support the MySQL `->>` operator, so the JSON path is
    // extracted with JSON_UNQUOTE(JSON_EXTRACT(...)).
    const appointmentAlerts = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications
        WHERE user_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.dedupeKey')) = ?`,
      [testUserId, `appt-15min:${testAppointmentCode}`]
    );
    expect(Number((appointmentAlerts[0] as any)[0].count)).toBe(1);

    const dedupeMarkers = await pool.query(
      'SELECT COUNT(*) AS count FROM notification_dedupe WHERE user_id = ? AND dedupe_key = ?',
      [testUserId, `appt-15min:${testAppointmentCode}`]
    );
    expect(Number((dedupeMarkers[0] as any)[0].count)).toBe(1);
  });

  skipIfNoDb('lists only the caller notifications, newest first', async () => {
    const mine = await notificationService.listNotifications(testUserId);
    expect(mine.notifications.length).toBeGreaterThanOrEqual(1);
    expect(mine.total).toBe(mine.notifications.length);

    for (const item of mine.notifications) {
      expect(item.id).toBeTruthy();
      expect(typeof item.timestamp).toBe('string');
      expect(typeof item.createdAt).toBe('number');
      expect(['pending', 'confirmed', 'resolved', 'dismissed']).toContain(item.status);
    }

    // Another user must not see them.
    const other = await notificationService.listNotifications(testUserId + 100000);
    expect(other.notifications.length).toBe(0);
  });

  skipIfNoDb('marks one notification read, and every notification read', async () => {
    const created = await notificationService.createNotification(testUserId, {
      type: 'system',
      priority: 'normal',
      title: 'Read test',
      message: 'mark me read',
    });
    expect(created.read).toBe(false);

    const read = await notificationService.markNotificationRead(testUserId, Number(created.id));
    expect(read?.read).toBe(true);

    await notificationService.createNotification(testUserId, {
      type: 'system',
      title: 'Bulk read test',
      message: 'mark me read too',
    });

    const updated = await notificationService.markAllNotificationsRead(testUserId);
    expect(updated).toBeGreaterThanOrEqual(1);

    const after = await notificationService.listNotifications(testUserId, { unread: true });
    expect(after.notifications.length).toBe(0);
  });

  skipIfNoDb('updates the status and deletes a notification', async () => {
    const created = await notificationService.createNotification(testUserId, {
      type: 'pending_confirmation',
      title: 'Status test',
      message: 'confirm me',
    });

    const confirmed = await notificationService.updateNotificationStatus(
      testUserId,
      Number(created.id),
      'confirmed'
    );
    expect(confirmed?.status).toBe('confirmed');

    const deleted = await notificationService.deleteNotification(testUserId, Number(created.id));
    expect(deleted).toBe(true);

    const missing = await notificationService.getNotification(testUserId, Number(created.id));
    expect(missing).toBeNull();
  });

  skipIfNoDb('refuses to read or delete another user notification', async () => {
    const created = await notificationService.createNotification(testUserId, {
      type: 'system',
      title: 'Ownership test',
      message: 'mine only',
    });

    const otherUserId = testUserId + 100000;
    expect(await notificationService.getNotification(otherUserId, Number(created.id))).toBeNull();
    expect(await notificationService.markNotificationRead(otherUserId, Number(created.id))).toBeNull();
    expect(await notificationService.deleteNotification(otherUserId, Number(created.id))).toBe(false);

    await notificationService.deleteNotification(testUserId, Number(created.id));
  });
});
