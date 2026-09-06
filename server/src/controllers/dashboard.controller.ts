import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    // Get total patients
    const [patientCount] = await pool.query(
      'SELECT COUNT(*) as count FROM patients WHERE status = "active"'
    );
    const totalPatients = (patientCount as any[])[0].count;

    // Get today's appointments
    const [appointmentCount] = await pool.query(
      'SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURDATE() AND status = "scheduled"'
    );
    const todayAppointments = (appointmentCount as any[])[0].count;

    // Get active hospitals
    const [hospitalCount] = await pool.query(
      'SELECT COUNT(*) as count FROM hospitals WHERE status = "active"'
    );
    const activeHospitals = (hospitalCount as any[])[0].count;

    // Get monthly revenue (from transactions)
    const [revenueData] = await pool.query(
      `SELECT SUM(credit) as revenue 
       FROM transactions t
       JOIN accounts a ON t.account_id = a.id
       WHERE a.type = 'income' 
       AND MONTH(t.date) = MONTH(CURDATE())
       AND YEAR(t.date) = YEAR(CURDATE())`
    );
    const monthlyRevenue = (revenueData as any[])[0].revenue || 0;

    // Get patient growth data (last 6 months)
    const [patientGrowth] = await pool.query(
      `SELECT 
        DATE_FORMAT(created_at, '%b') as month,
        COUNT(*) as patients
       FROM patients
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY MONTH(created_at), DATE_FORMAT(created_at, '%b')
       ORDER BY created_at`
    );

    // Get weekly appointments
    const [weeklyAppointments] = await pool.query(
      `SELECT 
        DAYNAME(appointment_date) as day,
        COUNT(*) as appointments
       FROM appointments
       WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DAYOFWEEK(appointment_date), DAYNAME(appointment_date)
       ORDER BY DAYOFWEEK(appointment_date)`
    );

    // Get recent activities (last 10)
    const [recentActivities] = await pool.query(
      `SELECT
          action,
          module as name,
          created_at as time
      FROM
          audit_logs
      ORDER BY
          created_at DESC
      LIMIT 10`
    );

    res.json({
      stats: {
        totalPatients,
        todayAppointments,
        activeHospitals,
        monthlyRevenue
      },
      patientGrowth,
      weeklyAppointments,
      recentActivities
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

import { fetchGhanaHealthData, importGhanaPatients } from '../services/ghanaHealthService.service.js';

export const getGhanaHealthData = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const data = await fetchGhanaHealthData();
    res.json({ ghanaHealthData: data });
  } catch (error) {
    console.error('Error fetching Ghana Health Service data:', error);
    res.status(500).json({ error: 'Failed to fetch Ghana Health Service data' });
  }
};

export const importGhanaHealthData = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const result = await importGhanaPatients()
    res.json({ message: 'Ghana Health data import complete', ...result })
  } catch (error) {
    console.error('Error importing Ghana Health Service data:', error)
    res.status(500).json({ error: 'Failed to import Ghana Health Service data' })
  }
};

export const getDiseaseTrends = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [diseaseTrends] = await pool.query(
      `SELECT
          mh.condition_name,
          COUNT(DISTINCT mh.patient_id) AS patient_count
      FROM
          medical_history mh
      GROUP BY
          mh.condition_name
      ORDER BY
          patient_count DESC
      LIMIT 10;`
    );

    res.json({ diseaseTrends });
  } catch (error) {
    console.error('Get disease trends error:', error);
    res.status(500).json({ error: 'Failed to fetch disease trends' });
  }
};

export const getFinancialForecast = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [monthly] = await pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS month, SUM(credit) AS revenue
       FROM transactions t
       JOIN accounts a ON t.account_id = a.id
       WHERE a.type = 'income'
       GROUP BY DATE_FORMAT(date, '%Y-%m')
       ORDER BY DATE_FORMAT(date, '%Y-%m') DESC
       LIMIT 6`
    )
    const list = (monthly as any[]).reverse()
    const avg = list.reduce((sum, r) => sum + Number(r.revenue || 0), 0) / Math.max(list.length, 1)
    const trend = list.length >= 2 ? Number(list[list.length - 1].revenue || 0) - Number(list[list.length - 2].revenue || 0) : 0
    const forecastNextMonth = Math.max(0, Math.round(avg + 0.5 * trend))
    res.json({
      history: list,
      forecast: { nextMonth: forecastNextMonth }
    })
  } catch (error) {
    console.error('Get financial forecast error:', error)
    res.status(500).json({ error: 'Failed to fetch financial forecast' })
  }
};

export const getResourceOptimization = async (_req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const [byDept] = await pool.query(
      `SELECT d.id AS department_id, d.name AS department_name,
              COUNT(a.id) AS weekly_appointments,
              (SELECT COUNT(*) FROM staff s WHERE s.department_id = d.id) AS staff_count
       FROM departments d
       LEFT JOIN appointments a ON a.department_id = d.id AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY d.id, d.name`
    )
    const recommendations = (byDept as any[]).map((r) => {
      const ratio = r.staff_count > 0 ? r.weekly_appointments / r.staff_count : r.weekly_appointments
      const targetRatio = 10
      const needed = ratio > targetRatio ? Math.ceil(r.weekly_appointments / targetRatio) - r.staff_count : 0
      return {
        department_id: r.department_id,
        department_name: r.department_name,
        weekly_appointments: Number(r.weekly_appointments || 0),
        staff_count: Number(r.staff_count || 0),
        recommended_additional_staff: Math.max(0, needed)
      }
    })
    res.json({ recommendations })
  } catch (error) {
    console.error('Get resource optimization error:', error)
    res.status(500).json({ error: 'Failed to fetch resource optimization data' })
  }
};
