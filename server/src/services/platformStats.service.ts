import pool from '../config/database.js'

export async function getPlatformStats() {
  try {
    const [hospitals] = (await pool.query('SELECT COUNT(*) as count FROM hospitals')) as unknown as [{ count: number }[]]
    const [staff] = (await pool.query('SELECT COUNT(*) as count FROM staff')) as unknown as [{ count: number }[]]
    const [patients] = (await pool.query('SELECT COUNT(*) as count FROM patients')) as unknown as [{ count: number }[]]
    const [appointments] = (await pool.query('SELECT COUNT(*) as count FROM appointments')) as unknown as [{ count: number }[]]

    return {
      hospitals: hospitals[0].count || 0,
      staff: staff[0].count || 0,
      patients: patients[0].count || 0,
      appointments: appointments[0].count || 0,
    }
  } catch (error) {
    throw new Error('Failed to fetch platform stats', { cause: error })
  }
}