export type VitalStatus = 'normal' | 'elevated' | 'high' | 'critical';

export type AlertSeverity = 'critical' | 'high' | 'elevated';
export type AlertCategory = 'blood_pressure' | 'heart_rate' | 'temperature' | 'oxygen' | 'respiratory';

export interface CriticalHealthAlert {
  id: string;
  patientId: string;
  patientName: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  metricLabel: string;
  metricValue: string;
  thresholdLabel: string;
  message: string;
  clinicalGuideline: string;
  recommendedAction: string;
  recordedAt: string;
  recordedBy: string;
  recordId: string;
}

export interface VitalsRecord {
  id: string;
  patientId: string;
  patientName: string;
  recordedAt: string; // ISO date string or YYYY-MM-DD HH:mm
  recordedBy: string;
  systolicBp: number; // mmHg
  diastolicBp: number; // mmHg
  heartRate: number; // bpm
  temperature: number; // in Celsius
  respiratoryRate?: number; // breaths/min
  oxygenSaturation?: number; // percentage %
  notes?: string;
  status: VitalStatus;
}

export interface VitalsSummary {
  latestSystolic: number;
  latestDiastolic: number;
  latestHeartRate: number;
  latestTemperature: number;
  latestOxygenSat?: number;
  bpStatus: 'Normal' | 'Elevated' | 'Stage 1' | 'Stage 2' | 'Hypertensive Crisis';
  hrStatus: 'Normal' | 'Bradycardia' | 'Tachycardia';
  tempStatus: 'Normal' | 'Low' | 'Elevated' | 'Fever';
  lastRecordedAt: string;
}

