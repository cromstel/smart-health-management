import { patientListApiSchema, patientApiSchema, type PatientApiResponse } from '../schemas/patient';
import { safeApiCall } from '@/lib/api';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const patientService = {
  async getPatients(params?: { search?: string; status?: string; hospital?: string }): Promise<PatientApiResponse[]> {
    toast.info('Syncing patient records...', { id: 'patient-sync', duration: 1500, position: 'bottom-right' });
    return safeApiCall(async () => {
      const token = localStorage.getItem('token');
      const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
      const response = await fetch(`${API_BASE}/patients${queryString}`, {
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

  async createPatient(patientData: Partial<PatientApiResponse>): Promise<PatientApiResponse> {
    return safeApiCall(async () => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(patientData),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to create patient (${response.status})`);
      }

      const rawData = await response.json();
      const parsedData = patientApiSchema.parse(rawData);
      return parsedData;
    });
  },
};
