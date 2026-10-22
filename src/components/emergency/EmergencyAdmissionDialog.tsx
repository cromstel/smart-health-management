import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  EmergencyAdmissionOptions,
  EmergencyBoardPatient,
  EmergencyPatientOption,
  EmergencyTriageLevel,
} from '@/services/api';
import { TRIAGE_LEVELS, TRIAGE_PRESENTATION, VITAL_RANGES, parseReading } from './triage';

/**
 * What the dialog hands back to the board.
 *
 * The readings are nullable on purpose: a field the clinician left empty
 * means "not taken", which the API records as null. It is never a zero.
 */
export interface EmergencyAdmissionFormValue {
  /** The patient's code. Absent when an admission is being edited. */
  patientId?: string;
  triageLevel: EmergencyTriageLevel;
  condition: string | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  spo2: number | null;
  /** The bay the patient is put in. Absent when an admission is being edited. */
  bedId?: string | null;
}

interface EmergencyAdmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The admission being edited; null when a patient is being admitted. */
  admission: EmergencyBoardPatient | null;
  /** The patients that can be admitted and the bays. */
  options: EmergencyAdmissionOptions | null;
  /** True while the board is writing the admission. */
  submitting: boolean;
  /** The message from the last failed write. */
  error: string | null;
  onSubmit: (value: EmergencyAdmissionFormValue) => void;
}

/** The condition note the column holds. */
const CONDITION_MAX_LENGTH = 255;

/**
 * The admit and re-triage form.
 *
 * One dialog serves both jobs because the two forms ask the same questions:
 * who is this, how urgent are they, what is wrong with them and what were
 * their readings. The mode only decides which fields are shown -- the
 * patient and the bay are fixed when an admission is being edited, because
 * the API does not move a patient between patients or bays on an update.
 */
export function EmergencyAdmissionDialog({
  open,
  onOpenChange,
  admission,
  options,
  submitting,
  error,
  onSubmit,
}: EmergencyAdmissionDialogProps) {
  const isEdit = admission !== null;

  const [patientId, setPatientId] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [triageLevel, setTriageLevel] = useState<EmergencyTriageLevel>('RED');
  const [condition, setCondition] = useState('');
  const [systolicBp, setSystolicBp] = useState('');
  const [diastolicBp, setDiastolicBp] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [spo2, setSpo2] = useState('');
  const [bedId, setBedId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * The form is rebuilt every time the dialog opens.
   *
   * A stale form is worse than no form on a clinical surface: a triage level
   * left over from the previous patient would be written to the new one.
   */
  useEffect(() => {
    if (!open) return;

    if (admission) {
      setPatientId(admission.id);
      setTriageLevel(admission.triageLevel);
      setCondition(admission.condition ?? '');
      setSystolicBp(admission.systolicBp === null ? '' : String(admission.systolicBp));
      setDiastolicBp(admission.diastolicBp === null ? '' : String(admission.diastolicBp));
      setHeartRate(admission.heartRate === null ? '' : String(admission.heartRate));
      setSpo2(admission.spo2 === null ? '' : String(admission.spo2));
    } else {
      setPatientId('');
      setTriageLevel('RED');
      setCondition('');
      setSystolicBp('');
      setDiastolicBp('');
      setHeartRate('');
      setSpo2('');
    }
    setPatientQuery('');
    // A new admission starts without a bay: the patient waits for one until
    // somebody allocates it, which is what the board shows in the meantime.
    setBedId('');
    setFieldErrors({});
  }, [open, admission]);

  /**
   * The patients the select offers.
   *
   * The search narrows the list, but the patient that is already chosen
   * stays in it: a selection the clinician made must not disappear because
   * they typed a search that does not match it.
   */
  const patientOptions = useMemo<EmergencyPatientOption[]>(() => {
    const allPatients = options?.patients ?? [];
    const query = patientQuery.trim().toLowerCase();
    const matched =
      query === ''
        ? allPatients
        : allPatients.filter(
            (patient) =>
              patient.name.toLowerCase().includes(query) ||
              patient.patientId.toLowerCase().includes(query)
          );

    const selected = allPatients.find((patient) => patient.patientId === patientId);
    if (selected && !matched.some((patient) => patient.patientId === selected.patientId)) {
      return [selected, ...matched];
    }
    return matched;
  }, [options, patientQuery, patientId]);

  /**
   * The bays that can take a patient.
   *
   * A bay that is occupied or still being turned over cannot: the API
   * refuses it. Offering it would only produce a rejection after the fact.
   */
  const availableBeds = useMemo(
    () => (options?.beds ?? []).filter((bed) => bed.status === 'available'),
    [options]
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors: Record<string, string> = {};

    if (!isEdit && !patientId) {
      errors.patientId = 'Choose the patient to admit';
    }
    if (condition.trim().length > CONDITION_MAX_LENGTH) {
      errors.condition = `The condition note is at most ${CONDITION_MAX_LENGTH} characters`;
    }

    const readings = {
      systolicBp: parseReading(systolicBp, VITAL_RANGES.systolicBp),
      diastolicBp: parseReading(diastolicBp, VITAL_RANGES.diastolicBp),
      heartRate: parseReading(heartRate, VITAL_RANGES.heartRate),
      spo2: parseReading(spo2, VITAL_RANGES.spo2),
    };
    Object.entries(readings).forEach(([key, reading]) => {
      if (reading.error) errors[key] = reading.error;
    });

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      ...(isEdit ? {} : { patientId }),
      triageLevel,
      condition: condition.trim() === '' ? null : condition.trim(),
      systolicBp: readings.systolicBp.value,
      diastolicBp: readings.diastolicBp.value,
      heartRate: readings.heartRate.value,
      spo2: readings.spo2.value,
      ...(isEdit ? {} : { bedId: bedId === '' ? null : bedId }),
    });
  };

  const fieldClass = 'space-y-2';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Update admission' : 'Admit patient'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Change the triage level, the presenting condition or the recorded readings.'
              : 'Record the patient, how urgent they are and the readings taken on arrival.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 py-4">
            {!isEdit && (
              <>
                <div className={fieldClass}>
                  <Label htmlFor="emergency-patient-search">Find patient</Label>
                  <Input
                    id="emergency-patient-search"
                    value={patientQuery}
                    onChange={(event) => setPatientQuery(event.target.value)}
                    placeholder="Search by name or patient code"
                    autoComplete="off"
                  />
                </div>

                <div className={fieldClass}>
                  <Label htmlFor="emergency-patient">Patient</Label>
                  <Select
                    value={patientId}
                    onValueChange={(value) => setPatientId(value)}
                  >
                    <SelectTrigger
                      id="emergency-patient"
                      aria-invalid={fieldErrors.patientId ? true : undefined}
                      aria-describedby={fieldErrors.patientId ? 'emergency-patient-error' : undefined}
                    >
                      <SelectValue placeholder="Select the patient to admit" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {options === null ? (
                        <SelectItem value="loading" disabled>
                          Loading the patients...
                        </SelectItem>
                      ) : patientOptions.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No patient matches the search
                        </SelectItem>
                      ) : (
                        patientOptions.map((patient) => (
                          <SelectItem key={patient.patientId} value={patient.patientId}>
                            {patient.name} ({patient.patientId})
                            {patient.age !== null ? ` — ${patient.age}y` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {fieldErrors.patientId && (
                    <p id="emergency-patient-error" className="text-sm text-destructive" role="alert">
                      {fieldErrors.patientId}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className={fieldClass}>
              <Label htmlFor="emergency-triage-level">Triage level</Label>
              <Select
                value={triageLevel}
                onValueChange={(value) => setTriageLevel(value as EmergencyTriageLevel)}
              >
                <SelectTrigger id="emergency-triage-level">
                  <SelectValue placeholder="Select the triage level" />
                </SelectTrigger>
                <SelectContent>
                  {TRIAGE_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {TRIAGE_PRESENTATION[level].label} — {TRIAGE_PRESENTATION[level].meaning}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={fieldClass}>
              <Label htmlFor="emergency-condition">Presenting condition</Label>
              <Textarea
                id="emergency-condition"
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
                placeholder="What brought the patient in"
                maxLength={CONDITION_MAX_LENGTH}
                aria-invalid={fieldErrors.condition ? true : undefined}
                aria-describedby={fieldErrors.condition ? 'emergency-condition-error' : undefined}
              />
              {fieldErrors.condition ? (
                <p id="emergency-condition-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.condition}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {condition.trim().length} of {CONDITION_MAX_LENGTH} characters
                </p>
              )}
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                Readings on arrival (optional)
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <Label htmlFor="emergency-systolic">Systolic BP (mmHg)</Label>
                  <Input
                    id="emergency-systolic"
                    inputMode="numeric"
                    value={systolicBp}
                    onChange={(event) => setSystolicBp(event.target.value)}
                    placeholder={String(VITAL_RANGES.systolicBp.min)}
                    aria-invalid={fieldErrors.systolicBp ? true : undefined}
                  />
                  {fieldErrors.systolicBp && (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.systolicBp}
                    </p>
                  )}
                </div>

                <div className={fieldClass}>
                  <Label htmlFor="emergency-diastolic">Diastolic BP (mmHg)</Label>
                  <Input
                    id="emergency-diastolic"
                    inputMode="numeric"
                    value={diastolicBp}
                    onChange={(event) => setDiastolicBp(event.target.value)}
                    placeholder={String(VITAL_RANGES.diastolicBp.min)}
                    aria-invalid={fieldErrors.diastolicBp ? true : undefined}
                  />
                  {fieldErrors.diastolicBp && (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.diastolicBp}
                    </p>
                  )}
                </div>

                <div className={fieldClass}>
                  <Label htmlFor="emergency-heart-rate">Heart rate (bpm)</Label>
                  <Input
                    id="emergency-heart-rate"
                    inputMode="numeric"
                    value={heartRate}
                    onChange={(event) => setHeartRate(event.target.value)}
                    placeholder={String(VITAL_RANGES.heartRate.min)}
                    aria-invalid={fieldErrors.heartRate ? true : undefined}
                  />
                  {fieldErrors.heartRate && (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.heartRate}
                    </p>
                  )}
                </div>

                <div className={fieldClass}>
                  <Label htmlFor="emergency-spo2">SpO2 (%)</Label>
                  <Input
                    id="emergency-spo2"
                    inputMode="numeric"
                    value={spo2}
                    onChange={(event) => setSpo2(event.target.value)}
                    placeholder={String(VITAL_RANGES.spo2.min)}
                    aria-invalid={fieldErrors.spo2 ? true : undefined}
                  />
                  {fieldErrors.spo2 && (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors.spo2}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            {!isEdit && (
              <div className={fieldClass}>
                <Label htmlFor="emergency-bed">Bay</Label>
                <Select value={bedId} onValueChange={(value) => setBedId(value)}>
                  <SelectTrigger id="emergency-bed">
                    <SelectValue placeholder="Assign a bay now" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="">Assign later (patient waits for a bay)</SelectItem>
                    {availableBeds.map((bed) => (
                      <SelectItem key={bed.id} value={bed.id}>
                        {bed.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only a bay that is ready for a patient can be chosen.
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEdit
                  ? 'Saving...'
                  : 'Admitting...'
                : isEdit
                  ? 'Save changes'
                  : 'Admit patient'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
