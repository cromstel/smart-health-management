import { useCallback, useEffect, useState } from 'react';
import * as apiConfig from '@/config/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';
import { toast } from 'sonner';

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
 */

type TriageLevel = 'RED' | 'AMBER' | 'GREEN' | 'YELLOW';
type BedStatus = 'occupied' | 'available' | 'cleaning';

interface EmergencyPatient {
  /** `patients.patient_id`, the human readable code (e.g. "P-1002"). */
  id: string;
  /** `patients.id`, the numeric key. */
  patientId: number;
  /** `emergency_admissions.id`. */
  admissionId: number;
  name: string;
  age: number | null;
  gender: string | null;
  triageLevel: TriageLevel;
  condition: string | null;
  /** Bay id (e.g. "ER-BAY-01"), null while the patient waits for a bay. */
  bed: string | null;
  bedLabel: string | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  spo2: number | null;
  /** Local ISO timestamp of the admission. */
  admittedAt: string;
}

interface ErBed {
  id: string;
  label: string;
  status: BedStatus;
  /** Patient code of the occupant. */
  patient: string | null;
  patientName: string | null;
  triage: string | null;
}

interface TriageBoardResponse {
  patients: EmergencyPatient[];
  beds: ErBed[];
  hotline: string;
}

interface CodeBlueResponse {
  codeBlue: {
    auditId: number;
    dispatched: boolean;
    message: string;
    hotline: string;
    patientId: string | null;
  };
}

/**
 * The API base URL.
 *
 * Resolved by the shared resolver in `src/config/api.ts`, from the
 * environment, so this module cannot drift away from the rest of the app.
 */
const { API_BASE_URL } = apiConfig;

/** The title case the board shows; the API keeps the lower-case enum. */
const BED_STATUS_LABEL: Record<BedStatus, string> = {
  occupied: 'OCCUPIED',
  available: 'AVAILABLE',
  cleaning: 'CLEANING',
};

/** Lower triage level means higher priority on the board. */
const TRIAGE_PRIORITY: Record<TriageLevel, number> = {
  RED: 0,
  AMBER: 1,
  YELLOW: 2,
  GREEN: 3,
};

const emergencyRequest = async <T,>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // No readable storage: the request goes out unauthenticated and the API
    // answers with 401, which is handled like any other failure.
  }

  const response = await fetch(`${API_BASE_URL}/emergency${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = (await response.json()) as Record<string, unknown>;
      if (data?.error) {
        message = String(data.error);
      } else if (Array.isArray(data?.errors) && data.errors.length > 0) {
        message = data.errors.map((e: { msg?: string }) => e.msg || 'Invalid value').join(', ');
      }
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
};

/** "165/102", or an em dash when the patient has no reading yet. */
const formatBloodPressure = (patient: EmergencyPatient): string =>
  patient.systolicBp !== null && patient.diastolicBp !== null
    ? `${patient.systolicBp}/${patient.diastolicBp}`
    : '—';

/** "8 mins ago" for a local ISO timestamp. */
const formatElapsed = (timestamp: string | null): string => {
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

const formatGender = (gender: string | null): string => {
  if (!gender) return '—';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
};

/**
 * The patient a free bay goes to: the highest priority patient that is
 * still waiting for a bay, and among those the one that has waited longest.
 */
const pickWaitingPatient = (list: EmergencyPatient[]): EmergencyPatient | null => {
  const waiting = list.filter((patient) => !patient.bed);
  if (waiting.length === 0) return null;

  return [...waiting].sort((a, b) => {
    const priority = TRIAGE_PRIORITY[a.triageLevel] - TRIAGE_PRIORITY[b.triageLevel];
    if (priority !== 0) return priority;
    return new Date(a.admittedAt).getTime() - new Date(b.admittedAt).getTime();
  })[0];
};

interface EmergencyModeModuleProps {
  onOpenLogVitals: () => void;
  onOpenHandover: () => void;
}

export function EmergencyModeModule({ onOpenLogVitals, onOpenHandover }: EmergencyModeModuleProps) {
  const [patients, setPatients] = useState<EmergencyPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [beds, setBeds] = useState<ErBed[]>([]);
  const [hotline, setHotline] = useState<string | null>(null);
  const [statActionRunning, setStatActionRunning] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const board = await emergencyRequest<TriageBoardResponse>('/triage-board');
      setPatients(Array.isArray(board.patients) ? board.patients : []);
      setBeds(Array.isArray(board.beds) ? board.beds : []);
      setHotline(board.hotline ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load the triage board';
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const handleCodeBlueBroadcast = async () => {
    setStatActionRunning('code_blue');
    const toastId = toast.loading('RECORDING CODE BLUE ALERT...');

    try {
      const response = await emergencyRequest<CodeBlueResponse>('/code-blue', {
        method: 'POST',
        body: {},
      });
      const result = response.codeBlue;

      if (result.dispatched) {
        toast.success(`Code blue broadcast: ${result.message}`, { id: toastId, duration: 6000 });
      } else {
        // The event is recorded and audited, but nothing was sent to an
        // emergency service: say so instead of claiming a broadcast.
        toast.warning(result.message, { id: toastId, duration: 9000 });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Code blue could not be recorded', {
        id: toastId,
      });
    } finally {
      setStatActionRunning(null);
    }
  };

  const handleAllocateBed = async (bedId: string) => {
    const bed = beds.find((entry) => entry.id === bedId);
    if (!bed) return;

    setStatActionRunning(`bed:${bedId}`);
    try {
      if (bed.status === 'occupied') {
        // Release the bay: the patient leaves and the bay is free again.
        await emergencyRequest(`/beds/${encodeURIComponent(bedId)}`, {
          method: 'PATCH',
          body: { status: 'available' },
        });
        toast.success(`Bed ${bed.label} released and ready for admission`);
      } else if (bed.status === 'cleaning') {
        // The turnover is done: put the bay back into circulation.
        await emergencyRequest(`/beds/${encodeURIComponent(bedId)}`, {
          method: 'PATCH',
          body: { status: 'available' },
        });
        toast.success(`Bed ${bed.label} is clean and back in circulation`);
      } else {
        const waiting = pickWaitingPatient(patients);
        if (!waiting) {
          toast.error('No admitted patient is waiting for a bed. Admit a patient first.');
          return;
        }

        await emergencyRequest(`/beds/${encodeURIComponent(bedId)}`, {
          method: 'PATCH',
          body: { status: 'occupied', patientId: waiting.id, triage: waiting.triageLevel },
        });
        toast.success(`Bed ${bed.label} allocated to ${waiting.name} (${waiting.id})`);
      }

      await loadBoard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bed allocation failed');
    } finally {
      setStatActionRunning(null);
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.condition ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* High-Pressure Emergency Banner Header */}
      <div className="p-4 rounded-xl bg-primary border-2 border-destructive text-primary-foreground shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-destructive/30 border border-destructive animate-pulse text-rose-300">
            <Siren className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight uppercase flex items-center gap-2 text-rose-100">
                STAT Emergency Triage View
              </h2>
              <Badge className="bg-destructive text-destructive-foreground font-bold border-destructive animate-pulse">
                HIGH PRESSURE MODE ACTIVE
              </Badge>
            </div>
            <p className="text-xs text-destructive/90 mt-0.5">
              Simplified high-speed layout focusing exclusively on Level-1 Resuscitation, Critical Vitals, and Bed Allocation
            </p>
          </div>
        </div>

        {/* Quick STAT Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCodeBlueBroadcast}
            disabled={statActionRunning === 'code_blue'}
            className="h-9 px-3 text-xs font-bold bg-destructive hover:bg-destructive text-destructive-foreground border border-destructive shadow-md gap-1.5 animate-bounce"
          >
            <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
            <span>Broadcast CODE BLUE</span>
          </Button>

          <Button
            size="sm"
            onClick={onOpenLogVitals}
            className="h-9 px-3 text-xs font-bold bg-white text-destructive hover:bg-slate-100 shadow-md gap-1.5"
          >
            <Stethoscope className="h-4 w-4 text-destructive" />
            <span>Log STAT Vitals</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenHandover}
            className="h-9 px-3 text-xs font-bold border-destructive text-destructive hover:bg-destructive/50 gap-1.5"
          >
            <FileText className="h-4 w-4 text-rose-300" />
            <span>Shift Handover</span>
          </Button>
        </div>
      </div>

      {/* Triage Stats Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-destructive/20 border-destructive/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-destructive uppercase tracking-wider">Level-1 Red Cases</p>
              <p className="text-2xl font-black text-destructive dark:text-destructive">
                {patients.filter((p) => p.triageLevel === 'RED').length} STAT
              </p>
            </div>
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </CardContent>
        </Card>

        <Card className="bg-warning/20 border-warning/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-warning uppercase tracking-wider">Level-2 Amber Cases</p>
              <p className="text-2xl font-black text-warning">
                {patients.filter((p) => p.triageLevel === 'AMBER').length} Urgent
              </p>
            </div>
            <AlertTriangle className="h-7 w-7 text-warning" />
          </CardContent>
        </Card>

        <Card className="bg-success/20 border-success/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-success uppercase tracking-wider">Available ER Bays</p>
              <p className="text-2xl font-black text-success">
                {beds.filter((b) => b.status === 'available').length} / {beds.length}
              </p>
            </div>
            <Bed className="h-7 w-7 text-success" />
          </CardContent>
        </Card>

        <Card className="bg-accent/20 border-accent/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-accent uppercase tracking-wider">Trauma Hotline</p>
              <p className="text-sm font-bold text-sky-300 flex items-center gap-1">
                <PhoneCall className="h-3.5 w-3.5" />
                {hotline ?? '—'}
              </p>
            </div>
            <Activity className="h-7 w-7 text-accent" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Emergency Patient List */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-destructive/40 shadow-md">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Heart className="h-5 w-5 text-destructive animate-pulse" />
                    Immediate Emergency Patient Queue
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Filtered view showing patients requiring immediate physiological monitoring & triage
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search emergency record..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 divide-y divide-border">
              {filteredPatients.map((p) => (
                <div key={p.id} className="p-4 hover:bg-destructive/5 transition-colors space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`text-xs font-bold ${
                          p.triageLevel === 'RED'
                            ? 'bg-destructive text-destructive-foreground animate-pulse'
                            : 'bg-warning text-black'
                        }`}
                      >
                        {p.triageLevel} STAT
                      </Badge>
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          {p.name}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({p.age ?? '—'}y, {formatGender(p.gender)})
                          </span>
                        </h4>
                        <p className="text-xs font-semibold text-destructive dark:text-destructive mt-0.5">
                          {p.condition ?? 'No presenting condition recorded'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge variant="outline" className="text-xs font-mono border-destructive/40">
                        {p.bed ?? 'Awaiting bay'}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" /> {formatElapsed(p.admittedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Vitals Quick Gauge Bar */}
                  <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-lg border text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        Blood Pressure
                      </span>
                      <span className="font-mono font-bold text-foreground">{formatBloodPressure(p)} mmHg</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        Heart Rate
                      </span>
                      <span className="font-mono font-bold text-destructive dark:text-destructive">
                        {p.heartRate ?? '—'} bpm
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        SpO2 Saturation
                      </span>
                      <span className="font-mono font-bold text-success dark:text-success">
                        {p.spo2 ?? '—'}%
                      </span>
                    </div>
                  </div>

                  {/* Immediate Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast.info(
                          `Medication orders are not issued from the triage board. Use the medication administration workflow for ${p.name}.`
                        );
                      }}
                      className="h-7 text-xs border-destructive/30 text-destructive dark:text-destructive hover:bg-destructive/10"
                    >
                      STAT Therapy Order
                    </Button>
                    <Button
                      size="sm"
                      onClick={onOpenLogVitals}
                      className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive"
                    >
                      Update Vitals
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Resuscitation Bay Allocation Matrix */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Bed className="h-4 w-4 text-success" />
                Emergency Bay Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time trauma room allocation and bed availability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {beds.map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 rounded-lg border bg-card flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-foreground block">{b.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {b.patient ? `Patient: ${b.patientName ?? b.patient}` : 'Ready for admission'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={b.status === 'available' ? 'default' : 'outline'}
                    onClick={() => handleAllocateBed(b.id)}
                    disabled={statActionRunning === `bed:${b.id}`}
                    className={`h-7 text-[11px] font-bold ${
                      b.status === 'available'
                        ? 'bg-success text-success-foreground hover:bg-success'
                        : 'border-destructive/40 text-destructive dark:text-destructive'
                    }`}
                  >
                    {BED_STATUS_LABEL[b.status] ?? b.status}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
