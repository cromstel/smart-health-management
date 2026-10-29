import * as z from 'zod';

/**
 * The shape of a patient as the API answers.
 *
 * The schema used to ask for an `id` that is a string and a `name` that is
 * always there. The API answers with the patient's row: the key is a number,
 * and there is no name column at all — the name is the first name and the
 * last name, held separately. So the schema could never parse an answer, and
 * the picker that used it was permanently empty with no error to show for
 * it.
 */
export const patientApiSchema = z.object({
  id: z.union([z.string(), z.number()]),
  patient_id: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  status: z.string().optional(),
  condition: z.string().optional(),
  hospital_id: z.union([z.string(), z.number()]).optional(),
  hospital_name: z.string().optional(),
  created_at: z.string().optional(),
});

export const patientListApiSchema = z.array(patientApiSchema);

export type PatientApiResponse = z.infer<typeof patientApiSchema>;

/**
 * The name to show for a patient.
 *
 * The API does not send one: it sends the first name and the last name
 * separately, and the two are what the record is read by.
 */
export const patientDisplayName = (patient: PatientApiResponse): string => {
  if (patient.name && patient.name.trim()) return patient.name.trim();
  const parts = [patient.first_name, patient.last_name].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== ''
  );
  return parts.join(' ') || `Patient ${patient.id}`;
};
