import cron from 'node-cron';
import { triggerBackup } from '../controllers/superAdmin.controller';

export const scheduleBackups = () => {
  // Schedule a backup to run every day at midnight
  cron.schedule('0 0 * * *', () => {
    console.log('Running daily backup...');
    // Create a mock request and response object to pass to the triggerBackup function
    const req: any = {};
    const res: any = {
      status: () => ({
        json: (data: any) => console.log('Backup status:', data),
      }),
    };
    triggerBackup(req, res);
  });
};