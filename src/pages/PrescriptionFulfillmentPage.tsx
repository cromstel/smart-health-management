import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAudit } from '@/contexts/AuditContext';
import { useAuth } from '@/contexts/AuthContext';
import { Pill, AlertCircle, Calendar, Check } from 'lucide-react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface DispenseEvent {
  id: string;
  patientId: string;
  medicineId: string;
  medicineName?: string;
  quantity: number;
  date: string;
  notes?: string;
}

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  medicineId: string;
  medicineName: string;
  prescribedDate: string;
  durationDays: number;
  doctorName: string;
}

// Used when a prescription row carries no explicit duration. A course of
// medication is assumed to run for a month unless the record says otherwise.
const DEFAULT_PRESCRIPTION_DURATION_DAYS = 30;

export default function PrescriptionFulfillmentPage() {
  const { hasPermission } = useAuth();
  const { logAction } = useAudit();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [events, setEvents] = useState<DispenseEvent[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [form, setForm] = useState({ patientId: '', medicineId: '', quantity: 1, notes: '' });

  const loadAll = useCallback(async () => {
    let ps: any[] = [];
    let ms: any[] = [];
    try {
      const [patientsResult, medicinesResult] = await Promise.all([api.getPatients(), api.getMedicines()]);
      ps = (patientsResult as any[]) ?? [];
      ms = (medicinesResult as any[]) ?? [];
      setPatients(ps);
      setMedicines(ms);
    } catch (_e) {
      toast.error('Failed to load patients or medicines');
    }

    // Prescriptions come from the API. The page used to keep its own copy in
    // browser storage, seeded with three fabricated prescriptions, so the
    // refill tracker was working against records that did not exist.
    try {
      const rows = (await api.getPrescriptions()) as any[];
      const patientById = new Map(ps.map((p) => [String(p.id), p]));
      const medicineById = new Map(ms.map((m) => [String(m.id), m]));
      setPrescriptions(
        (rows || []).map((row) => {
          const patient = patientById.get(String(row.patient_id));
          const medicine = medicineById.get(String(row.medicine_id));
          return {
            id: String(row.id),
            patientId: String(row.patient_id),
            patientName: patient
              ? `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim() || patient.patient_id
              : String(row.patient_id),
            medicineId: String(row.medicine_id),
            medicineName: medicine?.medicine_name ?? medicine?.name ?? String(row.medicine_id),
            prescribedDate: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            durationDays: Number(row.duration_days) || DEFAULT_PRESCRIPTION_DURATION_DAYS,
            doctorName: row.doctor_id ? `Staff #${row.doctor_id}` : 'Unassigned',
          } satisfies Prescription;
        })
      );
    } catch (e) {
      console.error('Failed to load prescriptions:', e);
      setPrescriptions([]);
      toast.error('Failed to load prescriptions');
    }

    // Dispensing history is read from the API rather than from a local
    // array in browser storage.
    try {
      const rows = (await api.getDispensingEvents({ limit: 200 })) as any[];
      setEvents(
        (rows || []).map((row) => ({
          id: String(row.id),
          patientId: String(row.patient_id ?? ''),
          medicineId: String(row.medicine_id ?? ''),
          medicineName: row.medicine_name ?? undefined,
          quantity: Number(row.quantity ?? 0),
          // The server sends a local-time datetime string. It is parsed as
          // local time rather than as UTC, so the displayed time matches the
          // time the dispense happened.
          date: row.dispensed_at
            ? new Date(String(row.dispensed_at).replace(' ', 'T')).toISOString()
            : new Date().toISOString(),
          notes: row.notes ?? undefined,
        }))
      );
    } catch (e) {
      console.error('Failed to load dispensing history:', e);
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveEvents = (next: DispenseEvent[]) => {
    setEvents(next);
  };

  const processRefill = async (p: Prescription) => {
    if (!hasPermission('pharmacy:edit')) {
      toast.error('Unauthorized to edit pharmacy inventory');
      return;
    }

    const dbMed = medicines.find((m) => m.id === p.medicineId || (m.medicine_name && m.medicine_name.toLowerCase().includes(p.medicineName.toLowerCase().split(' ')[0])));
    if (!dbMed) {
      toast.error('Medicine not found in pharmacy inventory');
      return;
    }

    if (dbMed.stock_level < 1) {
      toast.error(`Cannot refill: ${p.medicineName} is out of stock!`);
      return;
    }

    try {
      const nextStock = Math.max(0, dbMed.stock_level - 1);
      await api.updatePharmacyItem(dbMed.id, { stock_level: nextStock });

      // The dispensing event is recorded server-side so the history is not
      // lost when the browser cache is cleared. The patient id is sent as a
      // number: the endpoint resolves it against the numeric patient key.
      const recorded = await api.recordDispensingEvent({
        prescriptionId: p.id,
        patientId: Number(p.patientId),
        medicineId: dbMed.id,
        quantity: 1,
        notes: `Automated Prescription Refill - Prescribed by ${p.doctorName}`,
      });

      const ev: DispenseEvent = {
        id: String((recorded as any)?.id ?? `evt-${Date.now()}`),
        patientId: p.patientId,
        medicineId: dbMed.id,
        quantity: 1,
        date: new Date().toISOString(),
        notes: `Automated Prescription Refill - Prescribed by ${p.doctorName}`,
      };
      saveEvents([...events, ev]);

      // The refill restarts the course, so the server resets the prescribed
      // date rather than the browser rewriting its own copy.
      await api.refillPrescription(p.id);

      logAction('dispense', 'pharmacy', { recordId: ev.id, newValue: JSON.stringify(ev) });
      toast.success(`Successfully refilled ${p.medicineName} for ${p.patientName}!`);

      loadAll();
    } catch (e) {
      toast.error('Failed to update pharmacy stock level');
      console.error(e);
    }
  };

  const recordDispense = async () => {
    if (!hasPermission('pharmacy:edit')) {
      toast.error('Unauthorized');
      return;
    }
    if (!form.patientId || !form.medicineId || form.quantity <= 0) {
      toast.error('Please select patient, medicine and quantity');
      return;
    }
    try {
      const recorded = await api.recordDispensingEvent({
        patientId: Number(form.patientId),
        medicineId: form.medicineId,
        quantity: form.quantity,
        notes: form.notes,
      });
      const ev: DispenseEvent = {
        id: String((recorded as any)?.id ?? `evt-${Date.now()}`),
        patientId: form.patientId,
        medicineId: form.medicineId,
        quantity: form.quantity,
        date: new Date().toISOString(),
        notes: form.notes,
      };
      saveEvents([...events, ev]);
      logAction('dispense', 'pharmacy', { recordId: ev.id, newValue: JSON.stringify(ev) });
      toast.success('Dispense recorded');
      setForm({ patientId: '', medicineId: '', quantity: 1, notes: '' });
    } catch (e) {
      console.error('Failed to record dispense:', e);
      toast.error('Failed to record dispense');
    }
  };

  const historyForPatient = (pid: string) => events.filter((e) => e.patientId === pid);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Prescription Fulfillment</h1>
          <p className="text-muted-foreground">Process prescriptions and track dispensing</p>
        </div>
      </div>

      <ErrorBoundary fallbackTitle="Error loading Prescription Fulfillment">
        <Card>
          <CardHeader>
            <CardTitle>Process Prescription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <select className="border rounded p-2 bg-background" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                  <option value="">Select patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.first_name ? `${p.first_name} ${p.last_name}` : p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Medicine</Label>
                <select className="border rounded p-2 bg-background" value={form.medicineId} onChange={(e) => setForm({ ...form, medicineId: e.target.value })}>
                  <option value="">Select medicine</option>
                  {medicines.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.medicine_name || m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={recordDispense}>Record Dispense</Button>
            </div>
          </CardContent>
          </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-accent" aria-hidden="true" />
                  Active Prescriptions & Refill Status Tracker
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Automated reminders for patient prescriptions nearing supply limits. Linked directly with pharmacy inventory and doctor appointment schedules.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {prescriptions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No active prescriptions tracked.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-1">
                  {prescriptions.map((p) => {
                    const elapsedMs = Date.now() - new Date(p.prescribedDate).getTime();
                    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
                    const remainingDays = Math.max(0, p.durationDays - elapsedDays);
                    const progressPercentage = Math.min(100, Math.max(0, (remainingDays / p.durationDays) * 100));
                    const isNearingRefill = remainingDays <= 5;

                    const dbMed = medicines.find((m) => m.id === p.medicineId || (m.medicine_name && m.medicine_name.toLowerCase().includes(p.medicineName.toLowerCase().split(' ')[0])));
                    const stockLevel = dbMed ? dbMed.stock_level : 0;
                    const isOutOfStock = dbMed ? dbMed.stock_level === 0 : true;

                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-lg border transition-all duration-200 ${
                          isNearingRefill
                            ? 'border-destructive/20 bg-destructive/20 dark:border-destructive/30 dark:bg-destructive/10'
                            : 'border-border bg-card'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Patient & Medicine details */}
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">{p.patientName}</span>
                              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                {p.patientId}
                              </Badge>
                              {isNearingRefill && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 bg-destructive text-destructive-foreground font-semibold">
                                  <AlertCircle className="h-2.5 w-2.5 mr-1" aria-hidden="true" />
                                  Refill Nearing ({remainingDays}d left)
                                </Badge>
                              )}
                            </div>

                            <div className="text-sm font-medium text-foreground/90 flex items-center gap-1.5">
                              <Pill className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                              {p.medicineName}
                              <span className="text-xs text-muted-foreground font-normal">
                                (Prescribed by {p.doctorName})
                              </span>
                            </div>

                            <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                              <span>Prescribed: {new Date(p.prescribedDate).toLocaleDateString()}</span>
                              <span>Supply Duration: {p.durationDays} Days</span>
                              <span className="flex items-center gap-1">
                                Status: 
                                {isOutOfStock ? (
                                  <span className="text-destructive font-semibold">Out of Stock</span>
                                ) : stockLevel <= (dbMed?.low_stock_threshold || 10) ? (
                                  <span className="text-warning font-semibold">Low Stock ({stockLevel} left)</span>
                                ) : (
                                  <span className="text-success font-semibold">In Stock ({stockLevel} units)</span>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Progress and Actions */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 shrink-0 min-w-[280px]">
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Supply level</span>
                                <span className="font-medium">{remainingDays} / {p.durationDays} days</span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    remainingDays <= 2
                                      ? 'bg-destructive'
                                      : remainingDays <= 5
                                      ? 'bg-warning'
                                      : 'bg-success'
                                  }`} 
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground flex items-center gap-1 font-medium"
                                disabled={isOutOfStock}
                                onClick={() => processRefill(p)}
                              >
                                <Check className="h-3 w-3" aria-hidden="true" />
                                Refill
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs flex items-center gap-1 font-medium border-border"
                                onClick={() => navigate(`/appointments?search=${encodeURIComponent(p.patientName)}`)}
                              >
                                <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                                Schedule Visit
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patient Medication History</CardTitle>
          </CardHeader>
          <CardContent>
            {patients.length === 0 ? (
              <div className="text-center py-12"><p className="text-muted-foreground">No patients loaded.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Dispenses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.first_name ? `${p.first_name} ${p.last_name}` : p.name}</TableCell>
                        <TableCell>
                          {historyForPatient(p.id).length === 0 ? (
                            <span className="text-muted-foreground text-sm">No history</span>
                          ) : (
                            <div className="space-y-1">
                              {historyForPatient(p.id).map((e) => (
                                <div key={e.id} className="text-sm text-foreground">
                                  {new Date(e.date).toLocaleString()} — {medicines.find((m: any) => m.id === e.medicineId)?.medicine_name || e.medicineId} × {e.quantity}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </ErrorBoundary>
    </div>
  );
}