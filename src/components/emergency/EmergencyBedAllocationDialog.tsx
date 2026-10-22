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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EmergencyBed, EmergencyBoardPatient } from '@/services/api';
import { TRIAGE_PRESENTATION, formatElapsed, pickWaitingPatient } from './triage';

interface EmergencyBedAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The bay the patient is being put into. */
  bed: EmergencyBed | null;
  /** The admitted patients who are still waiting for a bay. */
  waiting: EmergencyBoardPatient[];
  /** True while the board is writing the allocation. */
  submitting: boolean;
  /** The message from the last failed write. */
  error: string | null;
  onAllocate: (bedId: string, patient: EmergencyBoardPatient) => void;
}

/**
 * The allocation dialog.
 *
 * Putting a patient in a bay is a clinical act, so it is never done by a
 * rule alone: the dialog names the patient and the bay, and the clinician
 * confirms the pairing. The highest-priority waiting patient is offered
 * first, because that is usually the one the bay is for -- but it is a
 * suggestion, not an assignment.
 */
export function EmergencyBedAllocationDialog({
  open,
  onOpenChange,
  bed,
  waiting,
  submitting,
  error,
  onAllocate,
}: EmergencyBedAllocationDialogProps) {
  const [patientId, setPatientId] = useState('');

  /**
   * The selection is reset every time the dialog opens.
   *
   * The default is the patient the board would suggest, but a selection that
   * outlives the dialog would silently put the wrong person in the bay.
   */
  useEffect(() => {
    if (!open) return;
    setPatientId(pickWaitingPatient(waiting)?.id ?? '');
  }, [open, waiting]);

  const selected = useMemo(
    () => waiting.find((patient) => patient.id === patientId) ?? null,
    [waiting, patientId]
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bed || !selected) return;
    onAllocate(bed.id, selected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocate bay</DialogTitle>
          <DialogDescription>
            {bed
              ? `${bed.label} is ready. Choose the patient who goes into it.`
              : 'Choose the patient who goes into the bay.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 py-4">
            {waiting.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No admitted patient is waiting for a bay. Admit a patient first.
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="emergency-bed-patient">Patient</Label>
                <Select value={patientId} onValueChange={(value) => setPatientId(value)}>
                  <SelectTrigger id="emergency-bed-patient">
                    <SelectValue placeholder="Select the patient" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {waiting.map((patient) => {
                      const presentation = TRIAGE_PRESENTATION[patient.triageLevel];
                      return (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.name} ({patient.id}) — {presentation.label}, waiting{' '}
                          {formatElapsed(patient.admittedAt)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selected && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.id}
                  {selected.age !== null ? ` — ${selected.age}y` : ''}
                  {selected.condition ? ` — ${selected.condition}` : ''}
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
            <Button type="submit" disabled={submitting || !selected || !bed}>
              {submitting ? 'Allocating...' : 'Allocate bay'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
