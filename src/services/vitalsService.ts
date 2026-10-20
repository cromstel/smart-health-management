import type { VitalsRecord, VitalStatus, VitalsSummary, CriticalHealthAlert } from '@/types/vitals';
import { API_BASE_URL } from '@/config/api';

/**
 * Patient vitals client.
 *
 * The readings used to live in localStorage under
 * "health_manager_patient_vitals" and were seeded with ten hardcoded records,
 * so every browser had its own private copy of the vitals history and a
 * reading taken on one device was invisible on another. They are now read
 * from and written to the API.
 *
 * The exported names and the `VitalsRecord` shape are unchanged, so the
 * existing consumers (src/components/vitals/*, src/pages/PatientsPage.tsx,
 * src/pages/SharedPatientSummaryPage.tsx) keep working.
 *
 * The server is the authority on the clinical status: it derives and stores
 * it. `computeVitalStatus` and `computeVitalsSummary` are kept here only for
 * the instant preview in the log-vitals dialog and as a display fallback;
 * they mirror the server thresholds (server/src/services/vitals.service.ts).
 */

interface ApiEnvelope<T> {
  vitals?: T[];
  alerts?: T[];
  vital?: T;
  summary?: T | null;
  error?: string;
  errors?: { msg?: string }[];
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (options.auth !== false) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as ApiEnvelope<unknown>;
      if (data?.error) {
        message = String(data.error);
      } else if (Array.isArray(data?.errors) && data.errors.length > 0) {
        message = data.errors.map((e) => e.msg || 'Invalid value').join(', ');
      }
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

/**
 * The share token of the public shared-summary page, when the app is being
 * viewed through a shared link. That page is not authenticated, so the shared
 * summary endpoint is the only way to read the vitals there.
 */
function getShareToken(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/\/shared\/patient-summary\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Clinical status of a reading. Mirrors the server thresholds so the live
 * preview matches what the server will store.
 */
export function computeVitalStatus(
  systolic: number,
  diastolic: number,
  heartRate: number,
  tempC: number
): VitalStatus {
  if (systolic >= 180 || diastolic >= 120 || tempC >= 39.5 || heartRate >= 130) {
    return 'critical';
  }
  if (systolic >= 140 || diastolic >= 90 || tempC >= 38.0 || heartRate >= 105 || heartRate < 50) {
    return 'high';
  }
  if (systolic >= 125 || diastolic >= 83 || tempC >= 37.5 || heartRate >= 90) {
    return 'elevated';
  }
  return 'normal';
}

/**
 * Alerts derived from a reading. The server derives the same alerts; this
 * copy is the display fallback for a record that was loaded from the API.
 */
export function extractRecordAlerts(record: VitalsRecord): CriticalHealthAlert[] {
  const alerts: CriticalHealthAlert[] = [];

  if (record.systolicBp >= 180 || record.diastolicBp >= 120) {
    alerts.push({
      id: `alert-bp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'blood_pressure',
      severity: 'critical',
      title: 'Hypertensive Crisis (Emergency BP)',
      metricLabel: 'Blood Pressure',
      metricValue: `${record.systolicBp}/${record.diastolicBp} mmHg`,
      thresholdLabel: '≥180 / ≥120 mmHg',
      message: `Systolic (${record.systolicBp} mmHg) or diastolic (${record.diastolicBp} mmHg) in critical hypertensive crisis range.`,
      clinicalGuideline: 'AHA/ACC Hypertensive Crisis threshold exceeded. High risk of acute end-organ damage.',
      recommendedAction: 'Immediate emergency physician evaluation required. Initiate acute antihypertensive reduction protocol and monitor telemetry.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.systolicBp >= 140 || record.diastolicBp >= 90) {
    alerts.push({
      id: `alert-bp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'blood_pressure',
      severity: 'high',
      title: 'Stage 2 Hypertension Alert',
      metricLabel: 'Blood Pressure',
      metricValue: `${record.systolicBp}/${record.diastolicBp} mmHg`,
      thresholdLabel: '≥140 / ≥90 mmHg',
      message: `Blood pressure reading (${record.systolicBp}/${record.diastolicBp} mmHg) is significantly above normal clinical thresholds.`,
      clinicalGuideline: 'AHA/ACC Stage 2 Hypertension. Sustained elevation requires prompt therapeutic adjustment.',
      recommendedAction: 'Re-evaluate antihypertensive prescription dosage, check medication adherence, and schedule follow-up recheck within 24-48 hours.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.systolicBp < 90 || record.diastolicBp < 60) {
    alerts.push({
      id: `alert-bp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'blood_pressure',
      severity: 'high',
      title: 'Hypotension Warning (Low BP)',
      metricLabel: 'Blood Pressure',
      metricValue: `${record.systolicBp}/${record.diastolicBp} mmHg`,
      thresholdLabel: '<90 / <60 mmHg',
      message: `Hypotensive blood pressure reading (${record.systolicBp}/${record.diastolicBp} mmHg) detected.`,
      clinicalGuideline: 'Inadequate vascular perfusion risk. Check for orthostatic symptoms or medication side-effects.',
      recommendedAction: 'Evaluate patient fluid status, check for dizziness/syncope, and review vasodilator/diuretic regimens.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  }

  if (record.heartRate >= 125) {
    alerts.push({
      id: `alert-hr-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'heart_rate',
      severity: 'critical',
      title: 'Severe Tachycardia Alert',
      metricLabel: 'Heart Rate',
      metricValue: `${record.heartRate} bpm`,
      thresholdLabel: '≥125 bpm',
      message: `Resting heart rate (${record.heartRate} bpm) is critically elevated.`,
      clinicalGuideline: 'Critical supraventricular/sinus tachycardia threshold.',
      recommendedAction: 'Perform 12-lead ECG, assess oxygenation, check electrolytes, and evaluate for acute arrhythmias or septic onset.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.heartRate > 100) {
    alerts.push({
      id: `alert-hr-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'heart_rate',
      severity: 'high',
      title: 'Tachycardia Warning',
      metricLabel: 'Heart Rate',
      metricValue: `${record.heartRate} bpm`,
      thresholdLabel: '>100 bpm',
      message: `Heart rate (${record.heartRate} bpm) is above normal resting limits (60-100 bpm).`,
      clinicalGuideline: 'Elevated cardiac rate. Can indicate pain, fever, dehydration, thyroid disorder, or stress.',
      recommendedAction: 'Re-assess pulse after rest, evaluate temperature and hydration levels.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.heartRate < 50) {
    alerts.push({
      id: `alert-hr-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'heart_rate',
      severity: 'high',
      title: 'Severe Bradycardia Warning',
      metricLabel: 'Heart Rate',
      metricValue: `${record.heartRate} bpm`,
      thresholdLabel: '<50 bpm',
      message: `Heart rate (${record.heartRate} bpm) is significantly below the normal resting baseline.`,
      clinicalGuideline: 'Bradycardia. Check for conduction delay, sick sinus syndrome, or beta-blocker toxicity.',
      recommendedAction: 'Check blood pressure, evaluate for lightheadedness or fatigue, review cardiac medications.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  }

  if (record.temperature >= 39.5) {
    alerts.push({
      id: `alert-temp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'temperature',
      severity: 'critical',
      title: 'Critical Hyperpyrexia Alert',
      metricLabel: 'Body Temperature',
      metricValue: `${record.temperature.toFixed(1)}°C (${((record.temperature * 9) / 5 + 32).toFixed(1)}°F)`,
      thresholdLabel: '≥39.5°C (103.1°F)',
      message: `Critically high body temperature (${record.temperature.toFixed(1)}°C) recorded.`,
      clinicalGuideline: 'Severe hyperpyrexia threshold. Risk of febrile convulsions and rapid systemic decompensation.',
      recommendedAction: 'Administer intravenous/oral antipyretics immediately, institute external cooling methods, and order blood cultures.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.temperature >= 38.0) {
    alerts.push({
      id: `alert-temp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'temperature',
      severity: 'high',
      title: 'High Fever Warning',
      metricLabel: 'Body Temperature',
      metricValue: `${record.temperature.toFixed(1)}°C (${((record.temperature * 9) / 5 + 32).toFixed(1)}°F)`,
      thresholdLabel: '≥38.0°C (100.4°F)',
      message: `Elevated febrile temperature (${record.temperature.toFixed(1)}°C) detected.`,
      clinicalGuideline: 'Clinical pyrexia. Indicates infectious or inflammatory response.',
      recommendedAction: 'Investigate potential infection focus, encourage oral/IV hydration, and administer prescribed antipyretics.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  } else if (record.temperature < 35.5) {
    alerts.push({
      id: `alert-temp-${record.id}`,
      patientId: record.patientId,
      patientName: record.patientName,
      category: 'temperature',
      severity: 'high',
      title: 'Hypothermia Warning',
      metricLabel: 'Body Temperature',
      metricValue: `${record.temperature.toFixed(1)}°C (${((record.temperature * 9) / 5 + 32).toFixed(1)}°F)`,
      thresholdLabel: '<35.5°C (95.9°F)',
      message: `Subnormal core body temperature (${record.temperature.toFixed(1)}°C) detected.`,
      clinicalGuideline: 'Hypothermia risk. Can indicate environmental exposure, sepsis, or metabolic failure.',
      recommendedAction: 'Apply warm blankets, provide warm fluids if conscious, and repeat core temperature measurement in 15 minutes.',
      recordedAt: record.recordedAt,
      recordedBy: record.recordedBy,
      recordId: record.id,
    });
  }

  if (record.oxygenSaturation !== undefined && record.oxygenSaturation > 0) {
    if (record.oxygenSaturation < 90) {
      alerts.push({
        id: `alert-spo2-${record.id}`,
        patientId: record.patientId,
        patientName: record.patientName,
        category: 'oxygen',
        severity: 'critical',
        title: 'Critical Hypoxemia (Low SpO2)',
        metricLabel: 'Oxygen Saturation',
        metricValue: `${record.oxygenSaturation}%`,
        thresholdLabel: '<90%',
        message: `Pulse oximetry reading (${record.oxygenSaturation}%) is critically below safe respiratory thresholds.`,
        clinicalGuideline: 'Severe hypoxemia. Immediate tissue hypoxia and respiratory arrest risk.',
        recommendedAction: 'Start supplemental oxygen therapy immediately via nasal cannula/mask, verify airway patency, and prepare arterial blood gas (ABG).',
        recordedAt: record.recordedAt,
        recordedBy: record.recordedBy,
        recordId: record.id,
      });
    } else if (record.oxygenSaturation < 95) {
      alerts.push({
        id: `alert-spo2-${record.id}`,
        patientId: record.patientId,
        patientName: record.patientName,
        category: 'oxygen',
        severity: 'high',
        title: 'Mild Hypoxemia Warning',
        metricLabel: 'Oxygen Saturation',
        metricValue: `${record.oxygenSaturation}%`,
        thresholdLabel: '<95%',
        message: `Pulse oximetry reading (${record.oxygenSaturation}%) is below optimal target (≥95%).`,
        clinicalGuideline: 'Sub-optimal oxygenation. May indicate respiratory compromise or airway obstruction.',
        recommendedAction: 'Check sensor positioning, elevate patient head-of-bed, encourage deep breathing exercises, and monitor respiration.',
        recordedAt: record.recordedAt,
        recordedBy: record.recordedBy,
        recordId: record.id,
      });
    }
  }

  return alerts;
}

/**
 * Summarise a set of readings. The server computes the same summary
 * (GET /api/vitals/:patientId/summary); this copy is the display fallback for
 * the list already loaded in the browser.
 */
export function computeVitalsSummary(records: VitalsRecord[]): VitalsSummary | null {
  if (!records || records.length === 0) return null;

  const sorted = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
  const latest = sorted[0];

  let bpStatus: VitalsSummary['bpStatus'] = 'Normal';
  if (latest.systolicBp >= 180 || latest.diastolicBp >= 120) {
    bpStatus = 'Hypertensive Crisis';
  } else if (latest.systolicBp >= 140 || latest.diastolicBp >= 90) {
    bpStatus = 'Stage 2';
  } else if (latest.systolicBp >= 130 || latest.diastolicBp >= 80) {
    bpStatus = 'Stage 1';
  } else if (latest.systolicBp >= 120 && latest.diastolicBp < 80) {
    bpStatus = 'Elevated';
  }

  let hrStatus: VitalsSummary['hrStatus'] = 'Normal';
  if (latest.heartRate < 60) hrStatus = 'Bradycardia';
  else if (latest.heartRate > 100) hrStatus = 'Tachycardia';

  let tempStatus: VitalsSummary['tempStatus'] = 'Normal';
  if (latest.temperature < 36.0) tempStatus = 'Low';
  else if (latest.temperature >= 38.0) tempStatus = 'Fever';
  else if (latest.temperature >= 37.5) tempStatus = 'Elevated';

  return {
    latestSystolic: latest.systolicBp,
    latestDiastolic: latest.diastolicBp,
    latestHeartRate: latest.heartRate,
    latestTemperature: latest.temperature,
    latestOxygenSat: latest.oxygenSaturation,
    bpStatus,
    hrStatus,
    tempStatus,
    lastRecordedAt: latest.recordedAt,
  };
}

class VitalsService {
  /**
   * Every reading the caller may see, newest first.
   */
  async getAllVitals(): Promise<VitalsRecord[]> {
    const data = await request<ApiEnvelope<VitalsRecord>>('/vitals');
    return Array.isArray(data?.vitals) ? data.vitals : [];
  }

  /**
   * The readings of one patient, newest first. An empty array is a valid
   * answer: the UI renders its "no readings yet" state.
   */
  async getPatientVitals(patientId?: string): Promise<VitalsRecord[]> {
    // The shared summary page is not authenticated. It reads the vitals that
    // belong to the shared summary instead of the patient endpoint.
    const shareToken = getShareToken();
    if (shareToken) {
      try {
        const shared = await request<ApiEnvelope<VitalsRecord> & { vitals?: VitalsRecord[] }>(
          `/shared/patient-summary?token=${encodeURIComponent(shareToken)}`,
          { auth: false }
        );
        return Array.isArray(shared?.vitals) ? shared.vitals : [];
      } catch {
        // A failed public read must not break the page: show no vitals.
        return [];
      }
    }

    if (!patientId || patientId === 'all') {
      return this.getAllVitals();
    }

    const data = await request<ApiEnvelope<VitalsRecord>>(
      `/vitals?patientId=${encodeURIComponent(patientId)}`
    );
    return Array.isArray(data?.vitals) ? data.vitals : [];
  }

  /**
   * The alerts of the latest reading of one patient.
   */
  async getPatientLatestAlerts(patientId?: string): Promise<CriticalHealthAlert[]> {
    if (!patientId || patientId === 'all' || getShareToken()) {
      return this.getAllActiveCriticalAlerts();
    }

    try {
      const data = await request<ApiEnvelope<CriticalHealthAlert>>(
        `/vitals/${encodeURIComponent(patientId)}/alerts`
      );
      return Array.isArray(data?.alerts) ? data.alerts : [];
    } catch {
      return [];
    }
  }

  /**
   * The active critical alerts across every patient.
   */
  async getAllActiveCriticalAlerts(): Promise<CriticalHealthAlert[]> {
    try {
      const data = await request<ApiEnvelope<CriticalHealthAlert>>('/vitals/alerts');
      return Array.isArray(data?.alerts) ? data.alerts : [];
    } catch {
      return [];
    }
  }

  /**
   * Record a reading. The server derives and stores the clinical status, so
   * the status returned here is the stored one.
   */
  async addVitalRecord(
    record: Omit<VitalsRecord, 'id' | 'status'>
  ): Promise<VitalsRecord> {
    const data = await request<ApiEnvelope<VitalsRecord> & { vital?: VitalsRecord }>('/vitals', {
      method: 'POST',
      body: {
        patientId: record.patientId,
        patientName: record.patientName,
        recordedAt: record.recordedAt,
        recordedBy: record.recordedBy,
        systolicBp: record.systolicBp,
        diastolicBp: record.diastolicBp,
        heartRate: record.heartRate,
        temperature: record.temperature,
        respiratoryRate: record.respiratoryRate,
        oxygenSaturation: record.oxygenSaturation,
        notes: record.notes,
      },
    });

    if (!data?.vital) {
      throw new Error('The vitals reading could not be saved');
    }
    return data.vital;
  }

  /**
   * Remove a reading.
   */
  async deleteVitalRecord(id: string): Promise<void> {
    await request(`/vitals/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

export const vitalsService = new VitalsService();
