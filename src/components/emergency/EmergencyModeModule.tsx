import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Siren,
  Activity,
  AlertTriangle,
  Heart,
  Zap,
  PhoneCall,
  Bed,
  Clock,
  ShieldAlert,
  Search,
  FileText,
  Stethoscope,
  UserPlus,
  Pencil,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { api, type EmergencyAdmissionOptions, type EmergencyBed, type EmergencyBoardPatient } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { describeActionFailure } from '@/lib/api';
import { EmergencyAdmissionDialog, type EmergencyAdmissionFormValue } from './EmergencyAdmissionDialog';
import { EmergencyBedAllocationDialog } from './EmergencyBedAllocationDialog';
import {
  BED_STATUS_PRESENTATION,
  TRIAGE_PRESENTATION,
  TRIAGE_PRIORITY,
  formatBloodPressure,
  formatElapsed,
  formatGender,
} from './triage';

/**
 * STAT emergency triage view.
 *
 * The board used to be two hardcoded arrays in this file: three invented
 * patients and six invented bays. Bed allocation only mutated local state
 * and a code-blue broadcast was a toast that contacted nobody, so the screen
 * looked alive while the record said nothing.
 *
 * The board is now read from and written to the API
 * (`/api/emergency/*`). The server returns raw values -- blood pressure as
 * two numbers, the admission time as a timestamp, the bed status as the
 * database enum -- and this component is the only place that decides how
 * they are shown, so the display rules live in one place.
 *
 * Two things this screen has to get right:
 *
 * 1. The triage level and the bay's state have to be legible at a glance.
 *    The triage level is carried by the semantic colour tokens, and every
 *    patient and every bay says which one it is in text as well, so the
 *    meaning does not depend on colour alone.
 * 2. A clinician must not be able to act on a patient or a bay that is not
 *    theirs. The API confines every clinical record to the caller's own
 *    hospital and answers a record of another hospital as "not found", so a
 *    404 on an action is reported as "not available to you" rather than as a
 *    fault to retry.
 */

interface EmergencyModeModuleProps {
  onOpenLogVitals: () => void;
  onOpenHandover: () => void;
}

export function EmergencyModeModule({ onOpenLogVitals, onOpenHandover }: EmergencyModeModuleProps) {
  const { hasPermission } = useAuth();
  const { logAction } = useAudit();

  const [patients, setPatients] = useState<EmergencyBoardPatient[]>([]);
  const [beds, setBeds] = useState<EmergencyBed[]>([]);
  const [hotline, setHotline] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statActionRunning, setStatActionRunning] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  // The admit form's options: the patients that can be admitted and the bays.
  const [options, setOptions] = useState<EmergencyAdmissionOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // The admission dialog serves both admitting and re-triaging.
  const [admissionDialogOpen, setAdmissionDialogOpen] = useState(false);
  const [editingAdmission, setEditingAdmission] = useState<EmergencyBoardPatient | null>(null);
  const [admissionError, setAdmissionError] = useState<string | null>(null);
  const [admissionSubmitting, setAdmissionSubmitting] = useState(false);

  // The bay allocation dialog.
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [allocatingBed, setAllocatingBed] = useState<EmergencyBed | null>(null);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationSubmitting, setAllocationSubmitting] = useState(false);

  // The discharge confirmation.
  const [dischargingAdmission, setDischargingAdmission] = useState<EmergencyBoardPatient | null>(null);
  const [dischargeError, setDischargeError] = useState<string | null>(null);
  const [dischargeSubmitting, setDischargeSubmitting] = useState(false);

  const canAdmit = hasPermission('emergency:add');
  const canEdit = hasPermission('emergency:edit');

  const loadBoard = useCallback(async () => {
    try {
      const board = await api.getEmergencyTriageBoard();
      setPatients(Array.isArray(board?.patients) ? board.patients : []);
      setBeds(Array.isArray(board?.beds) ? board.beds : []);
      setHotline(board?.hotline ?? null);
      setBoardError(null);
    } catch (error) {
      const message = describeActionFailure(error, 'Failed to load the triage board');
      setBoardError(message);
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  /**
   * The patients who are waiting for a bay.
   *
   * Only an admitted patient can be given a bay: the API refuses a bay for
   * a patient who is not on the board.
   */
  const waitingPatients = useMemo(() => patients.filter((patient) => !patient.bed), [patients]);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.condition ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  /**
   * Records a code blue.
   *
   * The event is written to the audit trail. The answer says whether an
   * external dispatch happened, and this deployment has none: the toast
   * repeats what the API said rather than claiming an ambulance was sent.
   */
  const broadcastCodeBlue = async () => {
    setStatActionRunning('code_blue');
    const toastId = toast.loading('RECORDING CODE BLUE ALERT...');

    try {
      const result = await api.recordEmergencyCodeBlue();
      if (result.dispatched) {
        toast.success(`Code blue broadcast: ${result.message}`, { id: toastId, duration: 6000 });
      } else {
        toast.warning(result.message, { id: toastId, duration: 9000 });
      }
    } catch (error) {
      toast.error(describeActionFailure(error, 'Code blue could not be recorded'), { id: toastId });
    } finally {
      setStatActionRunning(null);
    }
  };

  /**
   * Opens the admit form.
   *
   * The options are read when the form is opened rather than with the board:
   * the patient list is long and the board is read on every refresh, so
   * fetching it eagerly would slow the board down for no benefit.
   */
  const openAdmissionDialog = async () => {
    setEditingAdmission(null);
    setAdmissionError(null);
    setAdmissionDialogOpen(true);
    try {
      setOptionsLoading(true);
      const loaded = await api.getEmergencyOptions();
      setOptions({
        patients: Array.isArray(loaded?.patients) ? loaded.patients : [],
        beds: Array.isArray(loaded?.beds) ? loaded.beds : [],
        hotline: loaded?.hotline ?? '',
      });
    } catch (error) {
      setAdmissionError(describeActionFailure(error, 'The admission options could not be loaded'));
    } finally {
      setOptionsLoading(false);
    }
  };

  const openEditDialog = (patient: EmergencyBoardPatient) => {
    setEditingAdmission(patient);
    setAdmissionError(null);
    setAdmissionDialogOpen(true);
  };

  const handleAdmissionSubmit = async (value: EmergencyAdmissionFormValue) => {
    setAdmissionSubmitting(true);
    setAdmissionError(null);

    try {
      if (editingAdmission) {
        await api.updateEmergencyAdmission(editingAdmission.admissionId, {
          triageLevel: value.triageLevel,
          condition: value.condition,
          systolicBp: value.systolicBp,
          diastolicBp: value.diastolicBp,
          heartRate: value.heartRate,
          spo2: value.spo2,
        });
        logAction('update', 'emergency', {
          recordId: editingAdmission.id,
          newValue: `triage=${value.triageLevel}`,
        });
        toast.success(`${editingAdmission.name} moved to ${value.triageLevel}`);
      } else {
        const admission = await api.createEmergencyAdmission({
          patientId: value.patientId ?? '',
          triageLevel: value.triageLevel,
          condition: value.condition,
          systolicBp: value.systolicBp,
          diastolicBp: value.diastolicBp,
          heartRate: value.heartRate,
          spo2: value.spo2,
          bedId: value.bedId ?? null,
        });
        logAction('create', 'emergency', {
          recordId: admission.patientCode,
          newValue: `admission ${admission.id}, triage=${value.triageLevel}`,
        });
        toast.success(`${admission.patientName} admitted (${value.triageLevel})`);
      }

      setAdmissionDialogOpen(false);
      setEditingAdmission(null);
      await loadBoard();
    } catch (error) {
      const message = describeActionFailure(error, 'The admission could not be saved');
      setAdmissionError(message);
      toast.error(message);
    } finally {
      setAdmissionSubmitting(false);
    }
  };

  const handleDischarge = async () => {
    if (!dischargingAdmission) return;
    setDischargeSubmitting(true);
    setDischargeError(null);

    try {
      const result = await api.dischargeEmergencyAdmission(dischargingAdmission.admissionId);
      logAction('discharge', 'emergency', {
        recordId: dischargingAdmission.id,
        oldValue: `admission ${dischargingAdmission.admissionId}`,
        newValue: 'discharged',
      });
      toast.success(
        result.bed
          ? `${dischargingAdmission.name} discharged — ${result.bed.label} is being turned over`
          : `${dischargingAdmission.name} discharged`
      );
      setDischargingAdmission(null);
      await loadBoard();
    } catch (error) {
      const message = describeActionFailure(error, 'The patient could not be discharged');
      setDischargeError(message);
      toast.error(message);
    } finally {
      setDischargeSubmitting(false);
    }
  };

  const openAllocationDialog = (bed: EmergencyBed) => {
    setAllocatingBed(bed);
    setAllocationError(null);
    setAllocationDialogOpen(true);
  };

  const handleAllocate = async (bedId: string, patient: EmergencyBoardPatient) => {
    setAllocationSubmitting(true);
    setAllocationError(null);

    try {
      await api.updateEmergencyBed(bedId, {
        status: 'occupied',
        patientId: patient.id,
        triage: patient.triageLevel,
      });
      logAction('update', 'emergency', {
        recordId: bedId,
        newValue: `occupied by ${patient.id}`,
      });
      toast.success(`${patient.name} (${patient.id}) allocated to the bay`);
      setAllocationDialogOpen(false);
      setAllocatingBed(null);
      await loadBoard();
    } catch (error) {
      const message = describeActionFailure(error, 'The bay could not be allocated');
      setAllocationError(message);
      toast.error(message);
    } finally {
      setAllocationSubmitting(false);
    }
  };

  /**
   * Releases a bay.
   *
   * A bay a patient has just left goes to `cleaning`, not straight back to
   * `available`: it has to be turned over before the next patient, which is
   * the same rule the API applies when a patient is discharged.
   */
  const handleReleaseBed = async (bed: EmergencyBed) => {
    setStatActionRunning(`bed:${bed.id}`);
    try {
      await api.updateEmergencyBed(bed.id, { status: 'cleaning' });
      logAction('update', 'emergency', { recordId: bed.id, newValue: 'released for turnover' });
      toast.success(`${bed.label} released and queued for turnover`);
      await loadBoard();
    } catch (error) {
      toast.error(describeActionFailure(error, 'The bay could not be released'));
    } finally {
      setStatActionRunning(null);
    }
  };

  /** Puts a bay that has been turned over back into service. */
  const handleReturnBedToService = async (bed: EmergencyBed) => {
    setStatActionRunning(`bed:${bed.id}`);
    try {
      await api.updateEmergencyBed(bed.id, { status: 'available' });
      logAction('update', 'emergency', { recordId: bed.id, newValue: 'available' });
      toast.success(`${bed.label} is clean and back in circulation`);
      await loadBoard();
    } catch (error) {
      toast.error(describeActionFailure(error, 'The bay could not be put back into service'));
    } finally {
      setStatActionRunning(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* High-Pressure Emergency Banner Header */}
      <div className="p-4 rounded-xl bg-card border-2 border-destructive flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive text-destructive">
            <Siren className="h-8 w-8" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold tracking-tight uppercase text-foreground">
                STAT Emergency Triage View
              </h2>
              <Badge className="bg-destructive text-destructive-foreground font-bold border-destructive">
                HIGH PRESSURE MODE ACTIVE
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simplified high-speed layout focusing exclusively on Level-1 Resuscitation, Critical Vitals,
              and Bed Allocation
            </p>
          </div>
        </div>

        {/* Quick STAT Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    onClick={() => void openAdmissionDialog()}
                    disabled={!canAdmit}
                    className="h-9 px-3 text-xs font-bold gap-1.5"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    <span>Admit Patient</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {!canAdmit && <TooltipContent>Requires permission: emergency:add</TooltipContent>}
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => void broadcastCodeBlue()}
            disabled={statActionRunning === 'code_blue'}
            className="h-9 px-3 text-xs font-bold gap-1.5"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            <span>Broadcast CODE BLUE</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenLogVitals}
            className="h-9 px-3 text-xs font-bold gap-1.5"
          >
            <Stethoscope className="h-4 w-4" aria-hidden="true" />
            <span>Log STAT Vitals</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenHandover}
            className="h-9 px-3 text-xs font-bold gap-1.5"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            <span>Shift Handover</span>
          </Button>
        </div>
      </div>

      {/* Triage Stats Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-destructive uppercase tracking-wider">
                Level-1 Red Cases
              </p>
              <p className="text-2xl font-black text-destructive tabular-nums">
                {patients.filter((p) => p.triageLevel === 'RED').length} STAT
              </p>
            </div>
            <ShieldAlert className="h-7 w-7 text-destructive" aria-hidden="true" />
          </CardContent>
        </Card>

        <Card className="bg-warning/10 border-warning/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-warning uppercase tracking-wider">
                Level-2 Amber Cases
              </p>
              <p className="text-2xl font-black text-warning tabular-nums">
                {patients.filter((p) => p.triageLevel === 'AMBER').length} Urgent
              </p>
            </div>
            <AlertTriangle className="h-7 w-7 text-warning" aria-hidden="true" />
          </CardContent>
        </Card>

        <Card className="bg-success/10 border-success/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-success uppercase tracking-wider">
                Available ER Bays
              </p>
              <p className="text-2xl font-black text-success tabular-nums">
                {beds.filter((b) => b.status === 'available').length} / {beds.length}
              </p>
            </div>
            <Bed className="h-7 w-7 text-success" aria-hidden="true" />
          </CardContent>
        </Card>

        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                Trauma Hotline
              </p>
              <p className="text-sm font-bold text-foreground flex items-center gap-1">
                <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                {hotline ?? '—'}
              </p>
            </div>
            <Activity className="h-7 w-7 text-accent" aria-hidden="true" />
          </CardContent>
        </Card>
      </div>

      {boardError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{boardError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadBoard()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Try again</span>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Emergency Patient List */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-destructive/40 shadow-md">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Heart className="h-5 w-5 text-destructive" aria-hidden="true" />
                    Immediate Emergency Patient Queue
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Filtered view showing patients requiring immediate physiological monitoring &amp; triage
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <label htmlFor="emergency-board-search" className="sr-only">
                    Search the emergency board
                  </label>
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="emergency-board-search"
                    placeholder="Search emergency record..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 divide-y divide-border">
              {filteredPatients.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <p className="text-muted-foreground">
                    {patients.length === 0
                      ? 'No patient is admitted. The board is empty.'
                      : 'No admitted patient matches the search.'}
                  </p>
                </div>
              ) : (
                filteredPatients.map((p) => {
                  const triage = TRIAGE_PRESENTATION[p.triageLevel];
                  return (
                    <div
                      key={p.id}
                      className={`p-4 hover:bg-destructive/5 transition-colors space-y-3 border-l-4 ${triage.accentClass}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs font-bold ${triage.badgeClass}`}>
                            {triage.label} — {triage.meaning}
                          </Badge>
                          <div>
                            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                              {p.name}
                              <span className="text-xs font-normal text-muted-foreground">
                                ({p.age ?? '—'}y, {formatGender(p.gender)})
                              </span>
                            </h4>
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">{p.id}</p>
                            <p className="text-xs font-semibold text-foreground mt-0.5">
                              {p.condition ?? 'No presenting condition recorded'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <Badge variant="outline" className="text-xs font-mono border-border">
                            {p.bedLabel ?? p.bed ?? 'Awaiting bay'}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                            <Clock className="h-3 w-3" aria-hidden="true" /> {formatElapsed(p.admittedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Vitals Quick Gauge Bar */}
                      <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-lg border text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                            Blood Pressure
                          </span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {formatBloodPressure(p)} mmHg
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                            Heart Rate
                          </span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {p.heartRate ?? '—'} bpm
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                            SpO2 Saturation
                          </span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {p.spo2 ?? '—'}%
                          </span>
                        </div>
                      </div>

                      {/* Immediate Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            toast.info(
                              `Medication orders are not issued from the triage board. Use the medication administration workflow for ${p.name}.`
                            );
                          }}
                          className="h-7 text-xs"
                        >
                          STAT Therapy Order
                        </Button>
                        <Button size="sm" variant="outline" onClick={onOpenLogVitals} className="h-7 text-xs">
                          Update Vitals
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(p)}
                          disabled={!canEdit}
                          className="h-7 text-xs gap-1.5"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setDischargingAdmission(p);
                            setDischargeError(null);
                          }}
                          disabled={!canEdit}
                          className="h-7 text-xs gap-1.5"
                        >
                          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                          Discharge
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Resuscitation Bay Allocation Matrix */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Bed className="h-4 w-4 text-success" aria-hidden="true" />
                Emergency Bay Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time trauma room allocation and bed availability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {beds.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">No bay is configured.</p>
              ) : (
                beds.map((b) => {
                  const status = BED_STATUS_PRESENTATION[b.status];
                  const occupantTriage = b.triage ? TRIAGE_PRESENTATION[b.triage] : null;
                  return (
                    <div key={b.id} className="p-2.5 rounded-lg border bg-card flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-foreground block">{b.label}</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {b.patient ? `Patient: ${b.patientName ?? b.patient}` : 'Ready for admission'}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge className={`text-[10px] font-bold ${status.badgeClass}`}>{status.label}</Badge>
                          {occupantTriage && (
                            <Badge
                              className={`text-[10px] font-bold ${occupantTriage.badgeClass}`}
                            >
                              {occupantTriage.label}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {b.status === 'available' ? (
                        <Button
                          size="sm"
                          onClick={() => openAllocationDialog(b)}
                          disabled={!canEdit || waitingPatients.length === 0}
                          className="h-7 text-[11px] font-bold gap-1.5"
                        >
                          Allocate
                        </Button>
                      ) : b.status === 'occupied' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleReleaseBed(b)}
                          disabled={!canEdit || statActionRunning === `bed:${b.id}`}
                          className="h-7 text-[11px] font-bold"
                        >
                          Release
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleReturnBedToService(b)}
                          disabled={!canEdit || statActionRunning === `bed:${b.id}`}
                          className="h-7 text-[11px] font-bold"
                        >
                          Mark ready
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {waitingPatients.length > 0 && (
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-foreground">Waiting for a bay</CardTitle>
                <CardDescription className="text-xs">
                  Admitted patients with no bay. The highest priority is offered first.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {[...waitingPatients]
                  .sort(
                    (a, b) =>
                      TRIAGE_PRIORITY[a.triageLevel] - TRIAGE_PRIORITY[b.triageLevel]
                  )
                  .map((patient) => (
                    <div
                      key={patient.id}
                      className={`p-2.5 rounded-lg border bg-card border-l-4 ${TRIAGE_PRESENTATION[patient.triageLevel].accentClass}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground">{patient.name}</span>
                        <Badge
                          className={`text-[10px] font-bold ${TRIAGE_PRESENTATION[patient.triageLevel].badgeClass}`}
                        >
                          {TRIAGE_PRESENTATION[patient.triageLevel].label}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {patient.id} — waiting {formatElapsed(patient.admittedAt)}
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <EmergencyAdmissionDialog
        open={admissionDialogOpen}
        onOpenChange={(open) => {
          setAdmissionDialogOpen(open);
          if (!open) setEditingAdmission(null);
        }}
        admission={editingAdmission}
        options={options}
        submitting={admissionSubmitting}
        error={admissionError}
        onSubmit={(value) => void handleAdmissionSubmit(value)}
      />

      <EmergencyBedAllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        bed={allocatingBed}
        waiting={waitingPatients}
        submitting={allocationSubmitting}
        error={allocationError}
        onAllocate={(bedId, patient) => void handleAllocate(bedId, patient)}
      />

      <Dialog
        open={dischargingAdmission !== null}
        onOpenChange={(open) => {
          if (!open) setDischargingAdmission(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discharge patient</DialogTitle>
            <DialogDescription>
              {dischargingAdmission
                ? `${dischargingAdmission.name} (${dischargingAdmission.id}) is closed off as an emergency admission.`
                : 'Close off the emergency admission.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {dischargingAdmission?.bedLabel
                ? `${dischargingAdmission.bedLabel} is released for turnover and cannot take another patient until it is marked ready.`
                : 'The patient was waiting for a bay, so no bay is released.'}
            </p>
            {dischargeError && (
              <p className="text-sm text-destructive" role="alert">
                {dischargeError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDischargingAdmission(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDischarge()} disabled={dischargeSubmitting}>
              {dischargeSubmitting ? 'Discharging...' : 'Discharge patient'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {optionsLoading && (
        <p className="sr-only" role="status">
          Loading the admission options
        </p>
      )}
    </div>
  );
}
