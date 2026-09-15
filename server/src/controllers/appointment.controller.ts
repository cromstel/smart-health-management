import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import ical from 'ical-generator';

export const getAppointments = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { patientId, doctorId, departmentId, status, date } = req.query;
    let query = `
      SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
             s.first_name as doctor_first_name, s.last_name as doctor_last_name,
             d.name as department_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN staff s ON a.doctor_id = s.id
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (patientId) {
      query += ' AND a.patient_id = ?';
      params.push(patientId);
    }
    if (doctorId) {
      query += ' AND a.doctor_id = ?';
      params.push(doctorId);
    }
    if (departmentId) {
      query += ' AND a.department_id = ?';
      params.push(departmentId);
    }
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (date) {
      query += ' AND a.appointment_date = ?';
      params.push(date);
    }

    query += ' ORDER BY a.appointment_date, a.appointment_time';

    const [appointments] = await pool.query(query, params);
    res.json(appointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

export const getAppointmentById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [appointments] = await pool.query(
      `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              s.first_name as doctor_first_name, s.last_name as doctor_last_name,
              d.name as department_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN staff s ON a.doctor_id = s.id
       LEFT JOIN departments d ON a.department_id = d.id
       WHERE a.id = ?`,
      [id]
    );
    const appointment = (appointments as any[])[0];

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(appointment);
  } catch (error) {
    console.error('Get appointment by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
};

export const createAppointment = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { patientId, doctorId, departmentId, appointmentDate, appointmentTime, type, notes, sendReminder } = req.body;
    const id = uuidv4();
    const appointmentId = `APP-${String(Date.now()).slice(-6)}`;

    await pool.query(
      `INSERT INTO appointments (id, appointment_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, type, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
      [id, appointmentId, patientId, doctorId || null, departmentId || null, appointmentDate, appointmentTime, type || 'Consultation', notes || null]
    );

    if (sendReminder) {
      const reminderDate = new Date(`${appointmentDate}T${appointmentTime}`);
      reminderDate.setHours(reminderDate.getHours() - 1);
      await pool.query(
        'INSERT INTO appointment_reminders (appointment_id, reminder_date) VALUES (?, ?)',
        [id, reminderDate]
      );
    }

    res.status(201).json({ message: 'Appointment created successfully', id, appointmentId });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
};

export const updateAppointment = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await pool.query(`UPDATE appointments SET ${fields} WHERE id = ?`, values);
    res.json({ message: 'Appointment updated successfully' });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
};

export const deleteAppointment = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM appointments WHERE id = ?', [id]);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
};

export const getDoctorAvailability = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ error: 'doctorId and date are required' });
    }

    const [booked] = await pool.query(
      'SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != "cancelled"',
      [doctorId, date]
    );

    const bookedTimes = (booked as any[]).map((r) => r.appointment_time);
    const allSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    ];
    const available = allSlots.filter((slot) => !bookedTimes.includes(slot));

    res.json({ doctorId, date, availableSlots: available });
  } catch (error) {
    console.error('Get doctor availability error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
};

export const getAppointmentIcs = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [appointments] = await pool.query(
      `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
              s.first_name as doctor_first_name, s.last_name as doctor_last_name,
              d.name as department_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN staff s ON a.doctor_id = s.id
       LEFT JOIN departments d ON a.department_id = d.id
       WHERE a.id = ?`,
      [id]
    );
    const appointment = (appointments as any[])[0];

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const cal = ical({ name: 'SHMS Appointment' });
    const start = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    cal.createEvent({
      start,
      end,
      summary: `Appointment: ${appointment.type}`,
      description: `Patient: ${appointment.patient_first_name} ${appointment.patient_last_name}\nDoctor: ${appointment.doctor_first_name} ${appointment.doctor_last_name}\nDepartment: ${appointment.department_name}\nNotes: ${appointment.notes || ''}`,
      location: appointment.department_name || '',
      url: `https://shms.example.com/appointments/${id}`,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${appointment.appointment_id}.ics"`);
    res.send(cal.toString());
  } catch (error) {
    console.error('Get appointment ICS error:', error);
    res.status(500).json({ error: 'Failed to generate ICS file' });
  }
};