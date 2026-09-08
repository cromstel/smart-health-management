import type { VitalsRecord } from '@/types/vitals';

export interface TriageEvaluation {
  score: number; // 0 - 10
  classification: 'ESI-1' | 'ESI-2' | 'ESI-3' | 'ESI-4' | 'ESI-5';
  levelColor: string; // Tailwind bg/text color classes
  badgeColor: string;
  label: string;
  factors: string[];
  recommendedWard: string;
}

/**
 * Computes triage priority scores and classification based on:
 * - Current vital signs (Blood Pressure, Heart Rate, Oxygen, Temp, Respiration)
 * - Reported symptoms in clinical notes
 * - Chronic history or appointment frequencies
 */
export function evaluateTriagePriority(
  vitals: VitalsRecord[],
  reportedSymptoms: string = '',
  appointmentCount: number = 0
): TriageEvaluation {
  let score = 0;
  const factors: string[] = [];

  const latest = vitals.length > 0 
    ? [...vitals].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0]
    : null;

  // 1. Oxygen Saturation (SpO2) - Highly critical
  if (latest?.oxygenSaturation !== undefined) {
    const o2 = latest.oxygenSaturation;
    if (o2 < 90) {
      score += 4;
      factors.push(`Severe Hypoxia / Low SpO2 (${o2}%)`);
    } else if (o2 >= 90 && o2 < 94) {
      score += 3;
      factors.push(`Mild Hypoxia / Desaturating SpO2 (${o2}%)`);
    } else if (o2 >= 94 && o2 < 96) {
      score += 1;
      factors.push(`Borderline SpO2 (${o2}%)`);
    }
  }

  // 2. Heart Rate (HR)
  if (latest?.heartRate !== undefined) {
    const hr = latest.heartRate;
    if (hr > 130 || hr < 45) {
      score += 3;
      factors.push(`Dangerous Heart Rate (${hr} BPM)`);
    } else if (hr >= 110 && hr <= 130) {
      score += 2;
      factors.push(`Tachycardia (${hr} BPM)`);
    } else if (hr > 100 && hr < 110) {
      score += 1;
      factors.push(`Elevated Heart Rate (${hr} BPM)`);
    } else if (hr < 55 && hr >= 45) {
      score += 1;
      factors.push(`Bradycardia (${hr} BPM)`);
    }
  }

  // 3. Blood Pressure (BP)
  if (latest?.systolicBp !== undefined) {
    const sbp = latest.systolicBp;
    if (sbp > 180 || sbp < 90) {
      score += 3;
      factors.push(`Dangerous Systolic BP (${sbp} mmHg)`);
    } else if (sbp >= 150 && sbp <= 180) {
      score += 1.5;
      factors.push(`Hypertension Stage 2 (${sbp} mmHg)`);
    } else if (sbp < 100 && sbp >= 90) {
      score += 1;
      factors.push(`Hypotension Trend (${sbp} mmHg)`);
    }
  }

  // 4. Body Temperature
  if (latest?.temperature !== undefined) {
    const temp = latest.temperature;
    if (temp >= 39.0 || temp < 35.0) {
      score += 2;
      factors.push(`Severe Pyrexia / Hypothermia (${temp}°C)`);
    } else if (temp >= 38.0 && temp < 39.0) {
      score += 1;
      factors.push(`Febrile / Elevated Temperature (${temp}°C)`);
    }
  }

  // 5. Symptoms keywords scanning (severe symptoms elevate priority)
  const syms = (reportedSymptoms + ' ' + (latest?.notes || '')).toLowerCase();
  
  if (
    syms.includes('chest pain') || 
    syms.includes('unconscious') || 
    syms.includes('anaphylaxis') || 
    syms.includes('stroke') || 
    syms.includes('paralysis') ||
    syms.includes('cardiac arrest')
  ) {
    score += 4;
    factors.push('Life-threatening symptom identified (Chest Pain / Unresponsive)');
  } else if (
    syms.includes('dyspnea') || 
    syms.includes('shortness of breath') || 
    syms.includes('asthma flare') || 
    syms.includes('severe confusion') ||
    syms.includes('hemorrhage') ||
    syms.includes('bleeding')
  ) {
    score += 2.5;
    factors.push('Emergent symptom noted (Dyspnea / Heavy bleeding)');
  } else if (
    syms.includes('abdominal pain') || 
    syms.includes('fever') || 
    syms.includes('vomiting') || 
    syms.includes('migraine')
  ) {
    score += 1;
    factors.push('Urgent complaint (Severe Abdominal Pain / Pyrexia)');
  }

  // 6. Appointment History Count (frequency / chronic instability booster)
  if (appointmentCount >= 4) {
    score += 1.5;
    factors.push(`Frequent Clinical Escalation (${appointmentCount} visits in recent period)`);
  } else if (appointmentCount >= 2) {
    score += 0.5;
    factors.push(`Chronic Care Instability (${appointmentCount} recent appointments)`);
  }

  // Ensure bounds
  score = Math.min(10, Math.round(score * 10) / 10);

  // Map to ESI Emergency Severity levels
  let classification: 'ESI-1' | 'ESI-2' | 'ESI-3' | 'ESI-4' | 'ESI-5';
  let levelColor: string;
  let badgeColor: string;
  let label: string;
  let recommendedWard: string;

  if (score >= 8.5) {
    classification = 'ESI-1';
    levelColor = 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
    badgeColor = 'bg-rose-600 text-white';
    label = 'Immediate (Resuscitation)';
    recommendedWard = 'ICU / Trauma Resuscitation Bay A';
  } else if (score >= 6.0) {
    classification = 'ESI-2';
    levelColor = 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900';
    badgeColor = 'bg-orange-500 text-white';
    label = 'Emergent (High Risk)';
    recommendedWard = 'ED Bed Area / Cardiac Step-down';
  } else if (score >= 4.0) {
    classification = 'ESI-3';
    levelColor = 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900';
    badgeColor = 'bg-yellow-500 text-slate-900';
    label = 'Urgent (Stable)';
    recommendedWard = 'ED Main Care Zone / Fast Track';
  } else if (score >= 2.0) {
    classification = 'ESI-4';
    levelColor = 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
    badgeColor = 'bg-blue-500 text-white';
    label = 'Less Urgent';
    recommendedWard = 'ED Lounge / Rapid Assessment Zone';
  } else {
    classification = 'ESI-5';
    levelColor = 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
    badgeColor = 'bg-emerald-500 text-white';
    label = 'Non-Urgent';
    recommendedWard = 'Outpatient Clinic / Primary Care';
  }

  // Fallback for no vitals or signals
  if (vitals.length === 0 && reportedSymptoms === '') {
    return {
      score: 1.0,
      classification: 'ESI-5',
      levelColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      badgeColor: 'bg-slate-400 text-white',
      label: 'Undetermined / Non-Urgent',
      factors: ['No recent telemetry or symptom logs found. Recommending regular scheduling.'],
      recommendedWard: 'Primary Care Outpatients'
    };
  }

  return {
    score,
    classification,
    levelColor,
    badgeColor,
    label,
    factors: factors.length > 0 ? factors : ['Vitals within physiological homeostasis parameters.'],
    recommendedWard
  };
}
