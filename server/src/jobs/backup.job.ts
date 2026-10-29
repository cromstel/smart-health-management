import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { backupSchedule } from '../services/cron.service.js'
import { resolveConfiguredPath } from '../config/paths.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// The directories are configuration, so a deployment can say where its
// uploads and its backups live instead of having them written into the
// source. The defaults keep the shape a repository has.
const uploadsDir = resolveConfiguredPath(process.env.UPLOAD_DIR, path.join(__dirname, '../../uploads'))
const backupsDir = resolveConfiguredPath(process.env.BACKUP_DIR, path.join(__dirname, '../../backups'))

const copyRecursive = (src: string, dest: string) => {
  if (!fs.existsSync(src)) return
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyRecursive(s, d)
    else fs.copyFileSync(s, d)
  }
}

// The schedule is configuration. A schedule that cannot be parsed is
// reported and the job is not scheduled: a mistyped expression must not stop
// the service from starting.
const schedule = backupSchedule()

cron.schedule(schedule, () => {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest = path.join(backupsDir, stamp)
    copyRecursive(uploadsDir, dest)
    console.log('✅ Backup completed to', dest)
  } catch (e) {
    console.error('Backup job failed:', e)
  }
})

console.log('Backup job scheduled.')