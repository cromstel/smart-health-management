import * as z from 'zod';

export const patientSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  status: z.string().optional(),
  condition: z.string().optional(),
  hospital_id: z.string().optional(),
  hospital_name: z.string().optional(),
  created_at: z.string().optional(),
});

export const patientListSchema = z.array(patientSchema);

export type Patient = z.infer<typeof patientSchema>;
