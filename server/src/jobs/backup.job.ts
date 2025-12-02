import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadsDir = path.join(__dirname, '../../uploads')
const backupsDir = path.join(__dirname, '../../backups')

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

const schedule = process.env.BACKUP_CRON || '0 3 * * *'

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