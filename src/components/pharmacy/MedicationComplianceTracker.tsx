import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pill,
  Clock,
  CheckCircle,
  AlertTriangle,
  Bell,
  Plus,
  User,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAudit } from '@/contexts/AuditContext';

interface Medicine {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  expiryDate: string;
  supplier: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

/**
 * The API keeps the status lower case (the same shape every other enum in
 * this API uses); the table below is rendered in Title Case.
 */
type AdministrationStatus = 'Pending' | 'Administered' | 'Overdue' | 'Missed';

interface MedicationAdministration {
  id: string;
  patientId: string;
  patientCode?: string;
  patientName: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  status: AdministrationStatus;
  assignedStaff: string;
  criticalNotes?: string;
  administeredAt?: string;
}

interface PatientOption {
  patientId: number;
  patientCode: string;
  patientName: string;
}

interface StaffOption {
  staffId: number;
  staffName: string;
  role: string;
}

interface MedicationComplianceTrackerProps {
  medicines: Medicine[];
  onDeductStock: (medicineId: string, quantity: number) => void;
}

/** The raw record the API returns. */
interface ApiAdministration {
  id: number;
  patientId: number;
  patientCode: string;
  patientName: string;
  medicineId: string | null;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  status: 'pending' | 'administered' | 'overdue' | 'missed';
  assignedStaff: string | null;
  criticalNotes: string | null;
  administeredAt: string | null;
  quantity?: number;
  stockAfter?: number;
}

const STATUS_LABEL: Record<ApiAdministration['status'], AdministrationStatus> = {
  pending: 'Pending',
  administered: 'Administered',
  overdue: 'Overdue',
  missed: 'Missed',
};

/**
 * The API base URL.
 *
 * Mirrors the rule the shared API client uses: in development the default
 * 5600 port is replaced by the same-origin `/api` proxy when it is not
 * running.
 */
const configuredUrl = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL =
  import.meta.env.DEV && configuredUrl.includes('localhost:5600') ? '/api' : configuredUrl;

/** A thin authenticated fetch. The server skips the CSRF check for bearer requests. */
const request = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Request failed';
    throw new Error(message);
  }

  return (await response.json()) as T;
};

/** "2026-10-20 08:00:00" -> "Oct 20, 08:00 AM" */
const formatDateTime = (value?: string | null): string => {
  if (!value) return '--';
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * "08:00 AM" -> today at that time.
 *
 * The intake time field stays free text, so the value is turned into a real
 * timestamp here. Anything that cannot be read falls back to an hour from
 * now rather than scheduling a dose in the past by accident.
 */
const parseClockTime = (value: string): Date => {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(value.trim());
  if (match) {
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3]?.toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours <= 23 && minutes <= 59) {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
  }
  const fallback = new Date();
  fallback.setHours(fallback.getHours() + 1, 0, 0, 0);
  return fallback;
};

/** Maps the API record onto the shape the table renders. */
const toFrontendRecord = (record: ApiAdministration): MedicationAdministration => ({
  id: String(record.id),
  patientId: String(record.patientId),
  patientCode: record.patientCode,
  patientName: record.patientName,
  medicineId: record.medicineId ?? '',
  medicineName: record.medicineName,
  dosage: record.dosage,
  scheduledTime: formatDateTime(record.scheduledTime),
  status: STATUS_LABEL[record.status] ?? 'Pending',
  assignedStaff: record.assignedStaff ?? 'Unassigned',
  criticalNotes: record.criticalNotes ?? undefined,
  administeredAt: record.administeredAt ? formatDateTime(record.administeredAt) : undefined,
});

export const MedicationComplianceTracker: React.FC<MedicationComplianceTrackerProps> = ({
  medicines,
  onDeductStock
}) => {
  const { addNotification } = useNotifications();
  const { logAction } = useAudit();
  const [administrations, setAdministrations] = useState<MedicationAdministration[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingOffId, setSigningOffId] = useState<string | null>(null);
  const [liveStock, setLiveStock] = useState<Record<string, number>>({});

  // Schedule state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [targetPatient, setTargetPatient] = useState('');
  const [selectedMedId, setSelectedMedId] = useState('');
  const [targetDosage, setTargetDosage] = useState('1 Tablet');
  const [targetTime, setTargetTime] = useState('02:00 PM');
  const [assignedStaff, setAssignedStaff] = useState('');
  const [notes, setNotes] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  /** Remembers which overdue records were already announced. */
  const notifiedRef = useRef<Set<string>>(new Set());

  /**
   * The authoritative stock, read back from the inventory ledger.
   *
   * The sign-off decrements the stock on the server; the local copy is only
   * a mirror for the dropdown, so it is refreshed from the API instead of
   * being guessed.
   */
  const refreshStock = useCallback(async () => {
    try {
      const rows = await request<Array<{ id: string; stock_level: number }>>('/pharmacy/medicines');
      const next: Record<string, number> = {};
      for (const row of rows ?? []) {
        next[String(row.id)] = Number(row.stock_level ?? 0);
      }
      setLiveStock(next);
    } catch {
      // The dropdown falls back to the stock the parent already holds.
    }
  }, []);

  const loadAdministrations = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await request<ApiAdministration[]>('/medication-administrations');
      setAdministrations((rows ?? []).map(toFrontendRecord));
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load administrations';
      setAdministrations([]);
      setLoadError(message);
      toast.error(`Failed to load medication administrations: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const options = await request<{ patients: PatientOption[]; staff: StaffOption[] }>(
        '/medication-administrations/options'
      );
      setPatients(options?.patients ?? []);
      setStaff(options?.staff ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load options';
      setPatients([]);
      setStaff([]);
      toast.error(`Failed to load scheduling options: ${message}`);
    }
  }, []);

  useEffect(() => {
    loadAdministrations();
    loadOptions();
    refreshStock();
  }, [loadAdministrations, loadOptions, refreshStock]);

  // Keep the stock mirror in step with the inventory the parent loaded.
  useEffect(() => {
    setLiveStock((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const medicine of medicines ?? []) {
        if (next[medicine.id] === undefined) {
          next[medicine.id] = medicine.stock;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [medicines]);

  // Overdue alerts. The status itself is decided by the server; this only
  // reacts to it, once per record.
  useEffect(() => {
    const overdues = administrations.filter(a => a.status === 'Overdue');
    if (overdues.length === 0) return;

    overdues.forEach((overdue) => {
      if (notifiedRef.current.has(overdue.id)) return;
      notifiedRef.current.add(overdue.id);

      addNotification({
        type: 'inventory_alert',
        priority: 'urgent',
        title: `CRITICAL: Overdue Medication Alert`,
        message: `${overdue.patientName} is overdue for ${overdue.dosage} of ${overdue.medicineName} (Scheduled: ${overdue.scheduledTime}). Attending: ${overdue.assignedStaff}.`,
        timestamp: 'Just Now',
        patientName: overdue.patientName,
        patientId: overdue.patientId
      });

      toast.error(`⚠️ OVERDUE MEDICATION: ${overdue.patientName} is overdue for ${overdue.medicineName}!`, {
        description: `Assigned: ${overdue.assignedStaff} (Scheduled: ${overdue.scheduledTime})`,
        duration: 6000
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [administrations]);

  const handleAdminister = async (id: string) => {
    const administration = administrations.find(a => a.id === id);
    if (!administration) return;

    setSigningOffId(id);
    try {
      const updated = await request<ApiAdministration>(
        `/medication-administrations/${id}/sign-off`,
        { method: 'PATCH', body: JSON.stringify({}) }
      );

      setAdministrations(prev => prev.map(a => (a.id === id ? toFrontendRecord(updated) : a)));

      // The stock moved on the server. The parent mirror is updated with the
      // quantity the server actually deducted, and the authoritative figure
      // is read back from the inventory ledger.
      if (updated.medicineId && typeof updated.quantity === 'number') {
        if (typeof onDeductStock === 'function') {
          onDeductStock(updated.medicineId, updated.quantity);
        }
        await refreshStock();
      }

      logAction('MEDICINE_ADMINISTERED', 'pharmacy', {
        recordId: administration.patientId,
        oldValue: 'Pending',
        newValue: `Administered: ${administration.medicineName} (${administration.dosage}) for ${administration.patientName}`
      });

      toast.success(`Marked as Administered: ${administration.dosage} of ${administration.medicineName} signed off for ${administration.patientName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-off failed';
      toast.error(`Could not sign off ${administration.medicineName}: ${message}`);
    } finally {
      setSigningOffId(null);
    }
  };

  const handleNudgeStaff = (id: string) => {
    const administration = administrations.find(a => a.id === id);
    if (!administration) return;

    // Trigger urgent clinical broadcast push alert
    addNotification({
      type: 'system',
      priority: 'high',
      title: `Urgent Medication Nudge Broadcasted`,
      message: `Pager signal dispatched to ${administration.assignedStaff} regarding overdue administration of ${administration.medicineName} to ${administration.patientName}.`,
      timestamp: 'Just Now',
      patientName: administration.patientName
    });

    toast.info(`Dispatched wireless alert pager to ${administration.assignedStaff} regarding ${administration.patientName}'s ${administration.medicineName} dosage.`, {
      icon: <Bell className="h-4 w-4 text-warning animate-bounce" />
    });
  };

  const handleScheduleAdministration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetPatient) {
      toast.error('Please select a patient');
      return;
    }

    if (!selectedMedId) {
      toast.error("Please select a medication from the Pharmacy list");
      return;
    }

    const selectedMed = medicines.find(m => m.id === selectedMedId);
    if (!selectedMed) return;

    setIsScheduling(true);
    try {
      const scheduledTime = parseClockTime(targetTime);
      const created = await request<ApiAdministration>('/medication-administrations', {
        method: 'POST',
        body: JSON.stringify({
          patientId: Number(targetPatient),
          medicineId: selectedMed.id,
          dosage: targetDosage,
          scheduledTime: scheduledTime.toISOString(),
          assignedStaffId: assignedStaff ? Number(assignedStaff) : null,
          criticalNotes: notes,
        }),
      });

      setAdministrations(prev => [toFrontendRecord(created), ...prev]);
      setShowScheduleForm(false);

      // Create audit log
      logAction('MED_ADMINISTRATION_SCHEDULED', 'pharmacy', {
        recordId: selectedMed.id,
        newValue: `Scheduled: ${created.patientName} - ${selectedMed.name} at ${targetTime}`
      });

      toast.success(`Successfully scheduled ${targetDosage} of ${selectedMed.name} for ${created.patientName} at ${targetTime}.`);

      // Reset fields
      setSelectedMedId('');
      setNotes('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduling failed';
      toast.error(`Could not schedule the dose: ${message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  // Stats summaries
  const totalDoses = administrations.length;
  const completedDoses = administrations.filter(a => a.status === 'Administered').length;
  const pendingDoses = administrations.filter(a => a.status === 'Pending').length;
  const overdueDoses = administrations.filter(a => a.status === 'Overdue').length;

  /** The medicines the tracker is actually tracking, for the advisory card. */
  const trackedMedicines = Array.from(
    new Map(
      administrations
        .filter(a => Boolean(a.medicineId))
        .map(a => [a.medicineId, a.medicineName])
    ).values()
  ).slice(0, 3);

  return (
    <div className="space-y-6" id="medication-compliance-section">
      {/* Mini Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="compliance-stats-grid">
        <Card className="border border-border/80 bg-slate-50/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Scheduled</span>
              <p className="text-xl font-bold text-slate-900">{totalDoses}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-info/5 text-info">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-slate-50/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Doses Completed</span>
              <p className="text-xl font-bold text-success">{completedDoses}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-success/5 text-success">
              <CheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-slate-50/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending Doses</span>
              <p className="text-xl font-bold text-accent">{pendingDoses}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-accent/5 text-accent">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-slate-50/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Overdue Alerts</span>
              <p className="text-xl font-bold text-destructive animate-pulse">{overdueDoses}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-destructive/5 text-destructive">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance main table grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="compliance-main-layouts">
        {/* Administrations list (2/3 cols) */}
        <div className="lg:col-span-2">
          <Card className="border border-border h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Patient Administration Timelines</CardTitle>
                  <CardDescription className="text-xs">Monitor medication schedules and verify clinical intakes on-time.</CardDescription>
                </div>
                <Button
                  onClick={() => setShowScheduleForm(!showScheduleForm)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold h-8 shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-accent" /> Schedule Administration
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-x-auto">
              {isLoading ? (
                <p className="p-6 text-xs text-muted-foreground">Loading medication administrations…</p>
              ) : loadError ? (
                <div className="p-6 space-y-3">
                  <p className="text-xs text-destructive">{loadError}</p>
                  <Button variant="outline" size="sm" className="text-xs" onClick={loadAdministrations}>
                    Retry
                  </Button>
                </div>
              ) : administrations.length === 0 ? (
                <p className="p-6 text-xs text-muted-foreground">
                  No medication administrations have been scheduled yet.
                </p>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">
                      <th className="p-3">Patient</th>
                      <th className="p-3">Medication</th>
                      <th className="p-3">Schedule</th>
                      <th className="p-3">Assigned Staff</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {administrations.map((admin) => (
                      <tr key={admin.id} className="hover:bg-muted/20 transition-all">
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{admin.patientName}</div>
                          <div className="text-[10px] text-muted-foreground">{admin.patientCode ?? admin.patientId}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-slate-900 dark:text-slate-200 flex items-center gap-1.5 font-bold">
                            <Pill className="h-3 w-3 text-info shrink-0" /> {admin.medicineName}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Dosage: {admin.dosage}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-slate-800 dark:text-slate-300">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {admin.scheduledTime}
                          </div>
                          {admin.administeredAt && (
                            <div className="text-[9px] text-success font-semibold mt-0.5">Given: {admin.administeredAt}</div>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {admin.assignedStaff}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={`text-[10px] font-bold py-0.5 px-2 capitalize shrink-0 ${
                            admin.status === 'Administered' ? 'bg-success/5 hover:bg-success/5 text-success border-success/20' :
                            admin.status === 'Overdue' || admin.status === 'Missed' ? 'bg-destructive/5 hover:bg-destructive/5 text-destructive border-destructive/20 animate-pulse' :
                            'bg-warning/5 hover:bg-warning/5 text-warning border-warning/20'
                          }`} variant="outline">
                            {admin.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            {admin.status !== 'Administered' && (
                              <>
                                {admin.status === 'Overdue' && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleNudgeStaff(admin.id)}
                                    className="h-7 w-7 text-warning hover:text-warning hover:bg-warning/5 border-warning/20 shrink-0"
                                    title="Broadcast Urgency Pager Alert"
                                  >
                                    <Bell className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  disabled={signingOffId === admin.id}
                                  onClick={() => handleAdminister(admin.id)}
                                  className="bg-success hover:bg-success text-success-foreground font-semibold text-[10px] h-7 px-2 shrink-0 cursor-pointer"
                                >
                                  {signingOffId === admin.id ? 'Signing off…' : 'Sign-off'}
                                </Button>
                              </>
                            )}
                            {admin.status === 'Administered' && (
                              <span className="text-success font-bold flex items-center gap-1 text-[10px] pr-1.5 py-1">
                                <CheckCircle className="h-3.5 w-3.5" /> Checked
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action card: Create / Guide (1/3 cols) */}
        <div className="lg:col-span-1 space-y-4">
          {showScheduleForm ? (
            <Card className="border border-primary bg-primary/5">
              <CardHeader className="pb-3 border-b border-primary/20">
                <CardTitle className="text-sm font-bold text-foreground">Schedule Compliance Dose</CardTitle>
                <CardDescription className="text-xs">Schedule an upcoming clinical intake</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleScheduleAdministration} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sched-patient" className="text-xs">Select Active Patient</Label>
                    <select
                      id="sched-patient"
                      className="w-full border border-border bg-card p-2 rounded text-xs text-foreground focus:ring-1 focus:ring-primary"
                      value={targetPatient}
                      onChange={(e) => setTargetPatient(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Patient --</option>
                      {patients.map(patient => (
                        <option key={patient.patientId} value={patient.patientId}>
                          {patient.patientName} ({patient.patientCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sched-med" className="text-xs">Map to Pharmacy Stock</Label>
                    <select
                      id="sched-med"
                      className="w-full border border-border bg-card p-2 rounded text-xs text-foreground focus:ring-1 focus:ring-primary"
                      value={selectedMedId}
                      onChange={(e) => setSelectedMedId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Medicine --</option>
                      {medicines.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Stock: {liveStock[m.id] ?? m.stock} available)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="sched-dosage" className="text-xs">Dosage Quantity</Label>
                      <Input
                        id="sched-dosage"
                        value={targetDosage}
                        onChange={(e) => setTargetDosage(e.target.value)}
                        placeholder="e.g. 1 Tablet"
                        className="text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sched-time" className="text-xs">Intake Time</Label>
                      <Input
                        id="sched-time"
                        value={targetTime}
                        onChange={(e) => setTargetTime(e.target.value)}
                        placeholder="e.g. 12:00 PM"
                        className="text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sched-staff" className="text-xs">Assign Ward Nurse</Label>
                    <select
                      id="sched-staff"
                      className="w-full border border-border bg-card p-2 rounded text-xs text-foreground focus:ring-1 focus:ring-primary"
                      value={assignedStaff}
                      onChange={(e) => setAssignedStaff(e.target.value)}
                    >
                      <option value="">-- Unassigned --</option>
                      {staff.map(member => (
                        <option key={member.staffId} value={member.staffId}>
                          {member.staffName} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sched-notes" className="text-xs">Clinical Intake Notes</Label>
                    <textarea
                      id="sched-notes"
                      className="w-full border border-border bg-card p-2 rounded text-xs text-foreground min-h-[50px] resize-none"
                      placeholder="e.g. Taken post-meals with plenty fluids"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowScheduleForm(false)}
                      className="text-xs h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isScheduling}
                      className="bg-info hover:bg-info text-info-foreground text-xs h-8 font-semibold cursor-pointer"
                    >
                      {isScheduling ? 'Scheduling…' : 'Confirm Schedule'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-foreground">Clinical Quality Advisory</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5 text-xs text-muted-foreground leading-relaxed">
                <div className="flex gap-2 p-2.5 rounded bg-warning/5 dark:bg-warning/5 text-warning dark:text-warning border border-warning/50">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                  <p className="text-[11px] leading-snug">
                    Overdue administrations represent a critical threat to patient stabilization. Dispatch pager prompts immediately when alarms trigger.
                  </p>
                </div>
                <p>
                  Intakes successfully signed off automatically decrement real-time stock balances within the central Pharmacy ledger, assuring compliance safety.
                </p>
                <div className="border-t border-border/60 pt-3 flex flex-col gap-1 text-[11px]">
                  <span className="font-semibold text-foreground uppercase tracking-wide text-[9px] mb-1">Stock Integration Handlers:</span>
                  {trackedMedicines.length === 0 ? (
                    <span className="text-muted-foreground">No stock-linked administrations yet.</span>
                  ) : (
                    trackedMedicines.map(name => (
                      <div key={name} className="flex justify-between">
                        <span>{name}:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-300">Tied to Stock</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
