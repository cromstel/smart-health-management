import * as cron from 'node-cron';
import pool from '../config/database.js';
import { scheduleReminders } from '../controllers/appointment.controller.js';

// Default to running every hour at minute 0
const DEFAULT_CRON_EXPRESSION = '0 * * * *';

let currentTask: cron.ScheduledTask | null = null;

// Fetch the cron expression from the settings table
async function fetchCronExpression(): Promise<string> {
  try {
    const [rows] = await pool.query(
      'SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1',
      ['reminder_schedule']
    );
    if ((rows as any[]).length === 0) {
      return DEFAULT_CRON_EXPRESSION;
    }
    const value = (rows as any[])[0].setting_value as string;
    return value || DEFAULT_CRON_EXPRESSION;
  } catch (error) {
    console.error('Failed to fetch reminder schedule setting:', error);
    return DEFAULT_CRON_EXPRESSION;
  }
}

// Schedule the reminders job with the given cron expression
function registerCron(expr: string) {
  if (currentTask) {
    currentTask.stop();
  }
  try {
    currentTask = cron.schedule(expr, async () => {
      console.log('Running scheduled appointment reminders...');
      try {
        await scheduleReminders();
      } catch (jobErr) {
        console.error('Scheduled reminders job failed:', jobErr);
      }
    });
    console.log(`ReminderScheduler started with expression: "${expr}"`);
  } catch (err) {
    console.error(`Invalid cron expression "${expr}". Falling back to default.`);
    if (expr !== DEFAULT_CRON_EXPRESSION) {
      registerCron(DEFAULT_CRON_EXPRESSION);
    }
  }
}

export async function initReminderScheduler() {
  const expr = await fetchCronExpression();
  registerCron(expr);
}

// Re-schedule the cron job; used when Super Admin updates the setting
export function rescheduleReminderJob(newExpression: string) {
  registerCron(newExpression);
}
