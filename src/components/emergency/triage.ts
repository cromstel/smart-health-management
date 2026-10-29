import type {
  EmergencyBedStatus,
  EmergencyBoardPatient,
  EmergencyTriageLevel,
} from '@/services/api';

/**
 * The triage categories, most urgent first.
 *
 * The order is the clinical one: a RED patient is seen before an AMBER one,
 * an AMBER before a YELLOW, and a YELLOW before a GREEN.
 */
export const TRIAGE_LEVELS: readonly EmergencyTriageLevel[] = ['RED', 'AMBER', 'YELLOW', 'GREEN'];

/** Lower triage level means higher priority on the board. */
export const TRIAGE_PRIORITY: Record<EmergencyTriageLevel, number> = {
  RED: 0,
  AMBER: 1,
  YELLOW: 2,
  GREEN: 3,
};

/**
 * How a triage level is shown.
 *
 * The colour comes from the semantic token that carries the level's clinical
 * meaning: destructive for the one that means "resuscitate now", warning for
 * the one that means "urgent but not critical", info for the one that means
 * "can wait", and success for the one that means "minor". Every pair is a
 * role and its own `-foreground`, so the label keeps its contrast in both
 * themes without a hard-coded white or black.
 */
export const TRIAGE_PRESENTATION: Record<
  EmergencyTriageLevel,
  { label: string; meaning: string; badgeClass: string; accentClass: string }
> = {
  RED: {
    label: 'RED',
    meaning: 'Resuscitation',
    badgeClass: 'bg-destructive text-destructive-foreground border-destructive',
    accentClass: 'border-l-destructive',
  },
  AMBER: {
    label: 'AMBER',
    meaning: 'Urgent',
    badgeClass: 'bg-warning text-warning-foreground border-warning',
    accentClass: 'border-l-warning',
  },
  YELLOW: {
    label: 'YELLOW',
    meaning: 'Can wait',
    badgeClass: 'bg-info text-info-foreground border-info',
    accentClass: 'border-l-info',
  },
  GREEN: {
    label: 'GREEN',
    meaning: 'Minor',
    badgeClass: 'bg-success text-success-foreground border-success',
    accentClass: 'border-l-success',
  },
};

/**
 * How a bay's state is shown.
 *
 * The three states are the three things a clinician has to be able to tell
 * apart at a glance: somebody is in it, it is ready for somebody, or it is
 * being turned over.
 */
export const BED_STATUS_PRESENTATION: Record<
  EmergencyBedStatus,
  { label: string; badgeClass: string }
> = {
  occupied: { label: 'Occupied', badgeClass: 'bg-info text-info-foreground border-info' },
  available: { label: 'Available', badgeClass: 'bg-success text-success-foreground border-success' },
  cleaning: { label: 'Cleaning', badgeClass: 'bg-warning text-warning-foreground border-warning' },
};

/** "165/102", or an em dash when the patient has no reading yet. */
export const formatBloodPressure = (patient: {
  systolicBp: number | null;
  diastolicBp: number | null;
}): string =>
  patient.systolicBp !== null && patient.diastolicBp !== null
    ? `${patient.systolicBp}/${patient.diastolicBp}`
    : '—';

/** "8 mins ago" for a local ISO timestamp. */
export const formatElapsed = (timestamp: string | null): string => {
  if (!timestamp) return '—';
  const started = new Date(timestamp).getTime();
  if (Number.isNaN(started)) return '—';

  const minutes = Math.floor((Date.now() - started) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

/** The gender as the board shows it, or an em dash when it is not recorded. */
export const formatGender = (gender: string | null): string => {
  if (!gender) return '—';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
};

/**
 * The patient a free bay goes to by default: the highest priority patient
 * that is still waiting for a bay, and among those the one that has waited
 * longest.
 *
 * This is only the pre-selection of the allocation dialog. The clinician
 * confirms who goes into which bay, because putting the wrong patient in a
 * bay is a clinical safety error that no automatic rule should be allowed to
 * make on its own.
 */
export const pickWaitingPatient = (
  list: EmergencyBoardPatient[]
): EmergencyBoardPatient | null => {
  const waiting = list.filter((patient) => !patient.bed);
  if (waiting.length === 0) return null;

  return [...waiting].sort((a, b) => {
    const priority = TRIAGE_PRIORITY[a.triageLevel] - TRIAGE_PRIORITY[b.triageLevel];
    if (priority !== 0) return priority;
    return new Date(a.admittedAt).getTime() - new Date(b.admittedAt).getTime();
  })[0];
};

/**
 * The range the API accepts for one reading.
 *
 * The route validates these ranges itself, so a value outside them is
 * refused with a 400. The same ranges are checked in the form so that the
 * clinician is told what is wrong before the round trip, and so that the
 * ranges live in one place instead of being restated per field.
 */
export interface VitalRange {
  min: number;
  max: number;
  label: string;
  unit: string;
  /** True when a fractional reading makes no sense (a heart rate is a count). */
  integer: boolean;
}

export const VITAL_RANGES = {
  systolicBp: { min: 40, max: 300, label: 'Systolic BP', unit: 'mmHg', integer: true },
  diastolicBp: { min: 20, max: 200, label: 'Diastolic BP', unit: 'mmHg', integer: true },
  heartRate: { min: 20, max: 250, label: 'Heart rate', unit: 'bpm', integer: true },
  spo2: { min: 50, max: 100, label: 'SpO2', unit: '%', integer: false },
} as const satisfies Record<string, VitalRange>;

/** The readings a form field can produce. */
export interface ParsedReading {
  value: number | null;
  error: string | null;
}

/**
 * Reads one reading out of a form field.
 *
 * An empty field is neither an error nor a zero: it means "not taken", which
 * the API records as null. A value outside the range is refused here, with
 * the range in the message, so the limit does not have to be discovered by
 * reading a server error.
 */
export const parseReading = (raw: string, range: VitalRange): ParsedReading => {
  const text = raw.trim();
  if (text === '') return { value: null, error: null };

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return { value: null, error: `${range.label} must be a number` };
  }
  if (range.integer && !Number.isInteger(parsed)) {
    return { value: null, error: `${range.label} must be a whole number` };
  }
  if (parsed < range.min || parsed > range.max) {
    return {
      value: null,
      error: `${range.label} must be between ${range.min} and ${range.max} ${range.unit}`,
    };
  }
  return { value: parsed, error: null };
};
