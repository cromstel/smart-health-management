import * as z from 'zod';

export const appointmentSchema = z.object({
  id: z.string(),
  patient_id: z.string().optional(),
  patient_name: z.string().optional(),
  doctor_name: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  status: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
});

export const appointmentListSchema = z.array(appointmentSchema);

export type Appointment = z.infer<typeof appointmentSchema>;
