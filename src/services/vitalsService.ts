import type { VitalsRecord, VitalStatus, VitalsSummary, CriticalHealthAlert } from '@/types/vitals';

const VITALS_STORAGE_KEY = 'health_manager_patient_vitals';


// Realistic sample history across multiple patients & dates
const INITIAL_VITALS_DATA: VitalsRecord[] = [
  {
    id: 'vit-1',
    patientId: 'P-1001',
    patientName: 'Sarah Johnson',
    recordedAt: '2025-01-10 09:15',
    recordedBy: 'Dr. Michael Chen',
    systolicBp: 118,
    diastolicBp: 78,
    heartRate: 72,
    temperature: 36.6,
    respiratoryRate: 16,
    oxygenSaturation: 98,
    notes: 'Routine checkup. Resting vitals normal.',
    status: 'normal',
  },
  {
    id: 'vit-2',
    patientId: 'P-1001',
    patientName: 'Sarah Johnson',
    recordedAt: '2025-01-17 10:30',
    recordedBy: 'Nurse Clara Doe',
    systolicBp: 122,
    diastolicBp: 81,
    heartRate: 76,
    temperature: 36.8,
    respiratoryRate: 17,
    oxygenSaturation: 99,
    notes: 'Mild post-exercise elevation.',
    status: 'elevated',
  },
  {
    id: 'vit-3',
    patientId: 'P-1001',
    patientName: 'Sarah Johnson',
    recordedAt: '2025-01-24 14:00',
    recordedBy: 'Dr. Michael Chen',
    systolicBp: 128,
    diastolicBp: 84,
    heartRate: 80,
    temperature: 37.1,
    respiratoryRate: 18,
    oxygenSaturation: 97,
    notes: 'Follow-up consultation after prescription renewal.',
    status: 'elevated',
  },
  {
    id: 'vit-4',
    patientId: 'P-1001',
    patientName: 'Sarah Johnson',
    recordedAt: '2025-02-01 11:20',
    recordedBy: 'Dr. Michael Chen',
    systolicBp: 119,
    diastolicBp: 79,
    heartRate: 71,
    temperature: 36.7,
    respiratoryRate: 16,
    oxygenSaturation: 99,
    notes: 'Blood pressure stabilized with diet modifications.',
    status: 'normal',
  },
  {
    id: 'vit-5',
    patientId: 'P-1001',
    patientName: 'Sarah Johnson',
    recordedAt: '2025-02-15 08:45',
    recordedBy: 'Nurse Clara Doe',
    systolicBp: 121,
    diastolicBp: 80,
    heartRate: 74,
    temperature: 36.9,
    respiratoryRate: 16,
    oxygenSaturation: 98,
    notes: 'Morning fasting vitals log.',
    status: 'normal',
  },
  // Patient 2 - John Doe
  {
    id: 'vit-6',
    patientId: 'P-1002',
    patientName: 'John Doe',
    recordedAt: '2025-01-12 11:00',
    recordedBy: 'Dr. Emily Davis',
    systolicBp: 138,
    diastolicBp: 88,
    heartRate: 84,
    temperature: 37.2,
    respiratoryRate: 19,
    oxygenSaturation: 96,
    notes: 'Stage 1 hypertension noted. Salt reduction advised.',
    status: 'elevated',
  },
  {
    id: 'vit-7',
    patientId: 'P-1002',
    patientName: 'John Doe',
    recordedAt: '2025-01-20 09:30',
    recordedBy: 'Dr. Emily Davis',
    systolicBp: 146,
    diastolicBp: 92,
    heartRate: 90,
    temperature: 37.4,
    respiratoryRate: 20,
    oxygenSaturation: 95,
    notes: 'Hypertension Stage 2. Antihypertensive therapy initiated.',
    status: 'high',
  },
  {
    id: 'vit-8',
    patientId: 'P-1002',
    patientName: 'John Doe',
    recordedAt: '2025-02-05 15:15',
    recordedBy: 'Dr. Emily Davis',
    systolicBp: 132,
    diastolicBp: 85,
    heartRate: 78,
    temperature: 36.8,
    respiratoryRate: 17,
    oxygenSaturation: 98,
    notes: 'Medication effective. Pressure decreasing towards normal range.',
    status: 'elevated',
  },
  // Patient 3 - David Mensah
  {
    id: 'vit-9',
    patientId: 'P-1003',
    patientName: 'David Mensah',
    recordedAt: '2025-01-15 10:00',
    recordedBy: 'Dr. Michael Chen',
    systolicBp: 115,
    diastolicBp: 75,
    heartRate: 68,
    temperature: 38.3,
    respiratoryRate: 21,
    oxygenSaturation: 97,
    notes: 'Acute fever. Paracetamol prescribed.',
    status: 'high',
  },
  {
    id: 'vit-10',
    patientId: 'P-1003',
    patientName: 'David Mensah',
    recordedAt: '2025-01-18 16:30',
    recordedBy: 'Dr. Michael Chen',
    systolicBp: 116,
    diastolicBp: 76,
    heartRate: 70,
    temperature: 36.8,
    respiratoryRate: 16,
    oxygenSaturation: 99,
    notes: 'Fever resolved completely.',
    status: 'normal',
  },
];

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

export function extractRecordAlerts(record: VitalsRecord): CriticalHealthAlert[] {
  const alerts: CriticalHealthAlert[] = [];

  // 1. Blood Pressure Check
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

  // 2. Heart Rate Check
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

  // 3. Body Temperature Check
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

  // 4. Oxygen Saturation Check
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

export function computeVitalsSummary(records: VitalsRecord[]): VitalsSummary | null {
  if (!records || records.length === 0) return null;

  // Sort by date descending
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
  private getStored(): VitalsRecord[] {
    try {
      const data = localStorage.getItem(VITALS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    // Seed initial
    this.saveStored(INITIAL_VITALS_DATA);
    return INITIAL_VITALS_DATA;
  }

  private saveStored(records: VitalsRecord[]): void {
    try {
      localStorage.setItem(VITALS_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to save vitals to storage', e);
    }
  }

  async getAllVitals(): Promise<VitalsRecord[]> {
    return this.getStored();
  }

  async getPatientVitals(patientId?: string): Promise<VitalsRecord[]> {
    const all = this.getStored();
    if (!patientId || patientId === 'all') {
      return all;
    }
    return all.filter(
      (v) =>
        v.patientId.toLowerCase() === patientId.toLowerCase() ||
        v.patientName.toLowerCase().includes(patientId.toLowerCase())
    );
  }

  async getPatientLatestAlerts(patientId?: string): Promise<CriticalHealthAlert[]> {
    const vitals = await this.getPatientVitals(patientId);
    if (!vitals || vitals.length === 0) return [];
    
    // Sort descending by date
    const sorted = [...vitals].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
    
    // Get alerts from the latest reading
    const latest = sorted[0];
    return extractRecordAlerts(latest);
  }

  async getAllActiveCriticalAlerts(): Promise<CriticalHealthAlert[]> {
    const all = this.getStored();
    if (!all || all.length === 0) return [];

    // Group by patient ID to get each patient's latest record
    const latestByPatient: { [patientId: string]: VitalsRecord } = {};
    for (const record of all) {
      const existing = latestByPatient[record.patientId];
      if (!existing || new Date(record.recordedAt).getTime() > new Date(existing.recordedAt).getTime()) {
        latestByPatient[record.patientId] = record;
      }
    }

    const allAlerts: CriticalHealthAlert[] = [];
    for (const record of Object.values(latestByPatient)) {
      const alerts = extractRecordAlerts(record);
      allAlerts.push(...alerts);
    }

    // Sort so critical alerts are first, then high, then by date
    return allAlerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
    });
  }

  async addVitalRecord(
    record: Omit<VitalsRecord, 'id' | 'status'>
  ): Promise<VitalsRecord> {
    const all = this.getStored();
    const status = computeVitalStatus(
      record.systolicBp,
      record.diastolicBp,
      record.heartRate,
      record.temperature
    );
    const newRecord: VitalsRecord = {
      ...record,
      id: `vit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      status,
    };
    const updated = [newRecord, ...all];
    this.saveStored(updated);
    return newRecord;
  }

  async deleteVitalRecord(id: string): Promise<void> {
    const all = this.getStored();
    const updated = all.filter((r) => r.id !== id);
    this.saveStored(updated);
  }
}

export const vitalsService = new VitalsService();
