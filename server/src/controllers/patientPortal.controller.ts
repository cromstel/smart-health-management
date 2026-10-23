import { Response } from 'express';
import { authRequest, pool } from '../database/index.js';

export const getMyPortal = async (req: authRequest, res: Response): Promise<Response | void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) return res.status(401).json({ error: 'Authentication required' });
    const [rows] = await pool.query('SELECT id, first_name, last_name, email, phone, status, created_at FROM patients WHERE id = ?', [Number(patientId)]);
    res.json({ records: rows });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to load portal' });
  }
};

export const getMyAppointments = async (req: authRequest, res: Response): Promise<Response | void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) return res.status(401).json({ error: 'Authentication required' });
    const [rows] = await pool.query('SELECT * FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC, status ASC LIMIT 100', [Number(patientId)]);
    res.json({ appointments: rows });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to load appointments' });
  }
};

export const getMySharedSummaries = async (req: authRequest, res: Response): Promise<Response | void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) return res.status(401).json({ error: 'Authentication required' });
    const [rows] = await pool.query(
      `SELECT s.* FROM shared_summaries s WHERE s.patient_id = ? ORDER BY s.created_at DESC`,
      [Number(patientId)]
    );
    res.json({ summaries: rows });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to load summaries' });
  }
};
