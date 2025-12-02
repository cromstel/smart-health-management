import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';
import { sendEmail } from '../utils/mail.js';
import { sendSms } from '../utils/sms.js';
import { sendWhatsAppMessage } from '../services/whatsapp.service.js';
import RRule from 'rrule';
import ical from 'ical-generator';

// Helper function to send notifications
const sendNotifications = async (patient: any, subject: string, message: string) => {
  // Send email notification
  if (patient.email) {
    try {
      await sendEmail({
        to: patient.email,
        subject,
        text: message,
        html: `<p>${message}</p>`,
      });
    } catch (emailError) {
      console.error(`Failed to send email for subject "${subject}":`, emailError);
    }
  }

  // Send SMS notification
  if (patient.phone) {
    try {
      await sendSms(patient.phone, message);
    } catch (smsError) {
      console.error(`Failed to send SMS for subject "${subject}":`, smsError);
    }
  }

  // Send WhatsApp notification
  if (patient.phone) {
    try {
      await sendWhatsAppMessage(patient.phone, message);
    } catch (whatsappError) {
      console.error(`Failed to send WhatsApp message for subject "${subject}":`, whatsappError);
    }
  }
};

export const getAppointments = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { date, status, doctorId, patientId } = req.query;
    
    let query = `
      SELECT a.*, 
             p.first_name as patient_first_name, 
             p.last_name as patient_last_name,
             s.first_name as doctor_first_name,
             s.last_name as doctor_last_name,
             d.name as department_name
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN staff s ON a.doctor_id = s.id
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      query += ' AND a.appointment_date = ?';
      params.push(date);
    }

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    if (doctorId) {
      query += ' AND a.doctor_id = ?';
      params.push(doctorId);
    }

    if (patientId) {
      query += ' AND a.patient_id = ?';
      params.push(patientId);
    }

    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    const [appointments] = await pool.query(query, params);

    const allAppointments: any[] = [];

    (appointments as any[]).forEach((appointment: any) => {
      if (appointment.recurrence_rule) {
        try {
          const rruleSet = (RRule as any).fromString(appointment.recurrence_rule);
          const occurrences = rruleSet.all(); // Get all occurrences

          occurrences.forEach((occurrenceDate: Date) => {
            // Create a new appointment object for each occurrence
            const recurringAppointment = {
              ...appointment,
              appointment_date: occurrenceDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
              is_recurring_occurrence: true,
              original_appointment_id: appointment.id,
              id: uuidv4(), // Generate a new unique ID for each occurrence
            };
            allAppointments.push(recurringAppointment);
          });
        } catch (rruleError) {
          console.error('Error parsing RRule:', rruleError);
          allAppointments.push(appointment); // Add original if RRule parsing fails
        }
      } else {
        allAppointments.push(appointment);
      }
    });

    res.json(allAppointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

export const getAppointmentById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const [appointments] = await pool.query(
      `SELECT a.*, 
              p.first_name as patient_first_name, 
              p.last_name as patient_last_name,
              s.first_name as doctor_first_name,
              s.last_name as doctor_last_name,
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
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
};

export const createAppointment = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { patientId, doctorId, departmentId, appointmentDate, appointmentTime, type, notes, recurrenceRule } = req.body;

    const appointmentId = `A${String(Date.now()).slice(-6)}`;
    const id = uuidv4();

    // Check for doctor availability
    const [existingAppointments] = await pool.query(
      `SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?`,
      [doctorId, appointmentDate, appointmentTime]
    );

    if ((existingAppointments as any[]).length > 0) {
      return res.status(400).json({ error: 'Doctor is not available at the selected time' });
    }

    // Check for conflicts with other appointments in the same department at the same time
    const [conflictingAppointments] = await pool.query(
      `SELECT * FROM appointments WHERE department_id = ? AND appointment_date = ? AND appointment_time = ?`,
      [departmentId, appointmentDate, appointmentTime]
    );

    if ((conflictingAppointments as any[]).length > 0) {
      return res.status(400).json({ error: 'There is a conflict with another appointment in the same department at the selected time' });
    }

    await pool.query(
      `INSERT INTO appointments (id, appointment_id, patient_id, doctor_id, department_id,
                                 appointment_date, appointment_time, type, notes, status, recurrence_rule)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)` ,
      [id, appointmentId, patientId, doctorId, departmentId, appointmentDate, appointmentTime, type, notes, recurrenceRule]
    );

    // Get patient details for notification
    const [patients] = await pool.query('SELECT email, phone FROM patients WHERE id = ?', [patientId]);
    const patient = (patients as any[])[0];

    if (patient) {
      const message = `Your appointment is confirmed for ${appointmentDate} at ${appointmentTime}.`;
      const subject = 'Appointment Confirmation';
      await sendNotifications(patient, subject, message);
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

    // Get current appointment details before update for notification
    const [appointments] = await pool.query(
      `SELECT a.*, p.email, p.phone as patient_phone_number
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.id = ?`,
      [id]
    );

    const currentAppointment = (appointments as any[])[0];

    if (!currentAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const allowedFields = ['patient_id', 'doctor_id', 'department_id', 'appointment_date', 'appointment_time', 'type', 'notes', 'status', 'recurrence_rule'];
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClauses = updateFields.map(key => `${key} = ?`);
    const updateValues = updateFields.map(key => updates[key]);

    // Check for doctor availability if rescheduling
    const doctorId = updates.doctor_id || currentAppointment.doctor_id;
    const appointmentDate = updates.appointment_date || currentAppointment.appointment_date;
    const appointmentTime = updates.appointment_time || currentAppointment.appointment_time;

    if (updates.appointment_date || updates.appointment_time || updates.doctor_id) {
      const [existingAppointments] = await pool.query(
        `SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND id != ?`,
        [doctorId, appointmentDate, appointmentTime, id]
      );

      if ((existingAppointments as any[]).length > 0) {
        return res.status(400).json({ error: 'Doctor is not available at the selected time' });
      }
    }

    // Check for conflicts with other appointments in the same department at the same time
    const departmentId = updates.department_id || currentAppointment.department_id;
    if (updates.department_id || updates.appointment_date || updates.appointment_time) {
      const [conflictingAppointments] = await pool.query(
        `SELECT * FROM appointments WHERE department_id = ? AND appointment_date = ? AND appointment_time = ? AND id != ?`,
        [departmentId, appointmentDate, appointmentTime, id]
      );

      if ((conflictingAppointments as any[]).length > 0) {
        return res.status(400).json({ error: 'There is a conflict with another appointment in the same department at the selected time' });
      }
    }

    const query = `UPDATE appointments SET ${setClauses.join(', ')} WHERE id = ?`;
    const values = [...updateValues, id];

    await pool.query(query, values);

    // Send notifications
    const updatedDate = updates.appointment_date ? new Date(updates.appointment_date).toLocaleDateString() : new Date(currentAppointment.appointment_date).toLocaleDateString();
    const updatedTime = updates.appointment_time || currentAppointment.appointment_time;
    const message = `Your appointment has been updated. New details: Date - ${updatedDate}, Time - ${updatedTime}.`;
    const subject = 'Appointment Update';
    
    const patient = { email: currentAppointment.email, phone: currentAppointment.patient_phone_number };
    await sendNotifications(patient, subject, message);

    res.json({ message: 'Appointment updated successfully' });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
};

export const deleteAppointment = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Get appointment details for notification before cancelling
    const [appointments] = await pool.query(
      `SELECT a.*,
              p.first_name as patient_first_name,
              p.last_name as patient_last_name,
              p.email as patient_email,
              p.phone as patient_phone_number,
              s.first_name as doctor_first_name,
              s.last_name as doctor_last_name,
              s.email as doctor_email
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN staff s ON a.doctor_id = s.id
       WHERE a.id = ?`,
      [id]
    );

    const appointment = (appointments as any[])[0];

    // Update the appointment status to "cancelled"
    await pool.query('UPDATE appointments SET status = "cancelled" WHERE id = ?', [id]);

    if (appointment) {
      const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString();
      const cancellationMessage = `Your appointment on ${appointmentDate} has been cancelled.`;
      const cancellationSubject = 'Appointment Cancellation';

      // Send cancellation notification to patient
      const patient = { email: appointment.patient_email, phone: appointment.patient_phone_number };
      await sendNotifications(patient, cancellationSubject, cancellationMessage);

      // Send cancellation notification to doctor
      if (appointment.doctor_email) {
        const doctorMessage = `Appointment with ${appointment.patient_first_name} ${appointment.patient_last_name} on ${appointmentDate} has been cancelled.`;
        try {
          await sendEmail({
            to: appointment.doctor_email,
            subject: cancellationSubject,
            text: doctorMessage,
            html: `<p>${doctorMessage}</p>`
          });
        } catch (emailError) {
          console.error('Failed to send cancellation email to doctor:', emailError);
        }
      }
    }

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
};

// Endpoint to get doctor availability for a given date range
export const getDoctorAvailability = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { doctorId, startDate, endDate } = req.query;

    if (!doctorId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Doctor ID, start date, and end date are required' });
    }

    const [appointments] = await pool.query(
      `SELECT appointment_date, appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date >= ? AND appointment_date <= ?`,
      [doctorId, startDate, endDate]
    );

    res.json(appointments);
  } catch (error) {
    console.error('Get doctor availability error:', error);
    res.status(500).json({ error: 'Failed to fetch doctor availability' });
  }
};

// Function to generate iCalendar file
async function generateIcsFile(appointment: any) {
  const cal = ical({
    prodId: { company: 'Smart Health Manager', product: 'Appointments' },
    events: [
      {
        start: appointment.appointment_date,
        end: appointment.appointment_date,
        summary: `Appointment with ${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
        description: appointment.notes,
        location: appointment.department_name,
        organizer: {
          name: `${appointment.doctor_first_name} ${appointment.doctor_last_name}`,
          email: appointment.doctor_email,
        },
      },
    ],
  });

  return cal.toString();
}

// Endpoint to get iCalendar file for an appointment
export const getAppointmentIcs = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const [appointments] = await pool.query(
      `SELECT a.*,
              p.first_name as patient_first_name,
              p.last_name as patient_last_name,
              s.first_name as doctor_first_name,
              s.last_name as doctor_last_name,
              s.email as doctor_email,
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

    const icsString = await generateIcsFile(appointment);

    res.set('Content-Type', 'text/calendar');
    res.set('Content-Disposition', `attachment; filename="appointment-${id}.ics"`);
    res.send(icsString);
  } catch (error) {
    console.error('Get appointment iCalendar error:', error);
    res.status(500).json({ error: 'Failed to generate iCalendar file' });
  }
};

const reminderTime = 24 * 60 * 60 * 1000; // 24 hours before

// Function to schedule reminders with robust error handling
export const scheduleReminders = async (): Promise<void> => {
  console.log('[ReminderScheduler] Starting reminder scheduling job...');

  let connection;
  try {
    // Obtain a dedicated connection to improve error granularity
    connection = await pool.getConnection();
    const [reminders] = await connection.query(
      `SELECT a.*, p.email as patient_email, p.phone as patient_phone_number
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.appointment_date >= CURDATE() AND a.status = 'scheduled'`
    );

    const appointments = reminders as any[];
    console.log(`[ReminderScheduler] Retrieved ${appointments.length} appointments for evaluation`);

    await Promise.all(
      appointments.map(async (appointment: any) => {
        try {
          const timeDiff = new Date(appointment.appointment_date).getTime() - Date.now();
          if (timeDiff > 0 && timeDiff <= reminderTime) {
            const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString();
            const appointmentTime = new Date(`1970-01-01T${appointment.appointment_time}Z`).toLocaleTimeString('en-US', {
              hour12: true,
              hour: 'numeric',
              minute: 'numeric',
            });
            const reminderMessage = `Reminder: You have an appointment on ${appointmentDate} at ${appointmentTime}`;
            const reminderSubject = 'Appointment Reminder';

            const patient = {
              email: appointment.patient_email,
              phone: appointment.patient_phone_number,
            };
            await sendNotifications(patient, reminderSubject, reminderMessage);
            console.log(
              `[ReminderScheduler] Successfully sent reminder for appointment ${appointment.id} to patient ${appointment.patient_id}`
            );
          }
        } catch (notifyErr) {
          console.error(
            `[ReminderScheduler] Failed to process reminder for appointment ${appointment?.id}:`,
            notifyErr
          );
        }
      })
    );
  } catch (error: any) {
    if (error?.code === 'ECONNREFUSED' || error?.errno === 111) {
      console.error(
        '[ReminderScheduler] Database connection refused while fetching appointments. Please verify that the database server is running and connection parameters are correct.',
        error
      );
    } else {
      console.error('[ReminderScheduler] Error scheduling reminders:', error);
    }
  } finally {
    // Ensure the connection is released back to the pool
    if (connection) {
      try {
        connection.release();
      } catch (releaseErr) {
        console.error('[ReminderScheduler] Failed to release DB connection:', releaseErr);
      }
    }
    console.log('[ReminderScheduler] Reminder scheduling job completed');
  }
};

