import pool from '../config/database.js'
/**
 * Computes a simple 7-day patient load prediction using the last 12 weeks
 * of scheduled appointments per weekday.
 */

const weekdayOrder = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export const predictPatientLoads = async (): Promise<any> => {
  try {
    const [rows] = await pool.query(
      `SELECT DAYNAME(appointment_date) AS day, COUNT(*) AS count
       FROM appointments
       WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
         AND status = 'scheduled'
       GROUP BY DAYNAME(appointment_date)`
    )
    const countsByDay: Record<string, number> = {}
    for (const r of rows as any[]) {
      countsByDay[r.day] = Number(r.count || 0)
    }
    const totalCounts = Object.values(countsByDay).reduce((a, b) => a + b, 0)
    const avgPerWeek = totalCounts / 12
    const predictions = weekdayOrder.map((day) => {
      const dayCount = countsByDay[day] || 0
      const weight = 0.7
      const baseline = avgPerWeek / 7
      const predicted = Math.round(weight * dayCount / 12 + (1 - weight) * baseline)
      return { day, predictedLoad: predicted }
    })
    return predictions
  } catch (error) {
    console.error('Error in predictPatientLoads:', error)
    throw new Error('Failed to predict patient loads', { cause: error })
  }
}
