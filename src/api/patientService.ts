import { patientListApiSchema, patientApiSchema, type PatientApiResponse } from './schemas/patient';
import { safeApiCall } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const patientService = {
  async getPatients(): Promise<PatientApiResponse[]> {
    return safeApiCall(async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/patients`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch patients (${response.status})`);
      }

      const rawData = await response.json();
      // Validate with Zod schema
      const parsedData = patientListApiSchema.parse(rawData);
      return parsedData;
    });
  },

  async getPatientById(id: string): Promise<PatientApiResponse> {
    return safeApiCall(async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/patients/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch patient ${id} (${response.status})`);
      }

      const rawData = await response.json();
      const parsedData = patientApiSchema.parse(rawData);
      return parsedData;
    });
  },
};
