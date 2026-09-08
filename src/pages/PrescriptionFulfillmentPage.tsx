import { useEffect, useState } from 'react';
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

interface DispenseEvent {
  id: string;
  patientId: string;
  medicineId: string;
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

export default function PrescriptionFulfillmentPage() {
  const { hasPermission } = useAuth();
  const { logAction } = useAudit();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [events, setEvents] = useState<DispenseEvent[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [form, setForm] = useState({ patientId: '', medicineId: '', quantity: 1, notes: '' });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [ps, ms] = await Promise.all([api.getPatients(), api.getMedicines()]);
      setPatients(ps as any[]);
      setMedicines(ms as any[]);
    } catch (_e) { /* Error ignored as per design */
      toast.error('Failed to load patients or medicines');
    }
    const stored = JSON.parse(localStorage.getItem('dispenseEvents') || '[]');
    setEvents(stored);

    // Load prescriptions from localStorage
    const PRESCRIPTIONS_KEY = 'health_manager_prescriptions';
    const storedPrescriptions = localStorage.getItem(PRESCRIPTIONS_KEY);
    if (storedPrescriptions) {
      setPrescriptions(JSON.parse(storedPrescriptions));
    } else {
      const initialPrescriptions = [
        {
          id: 'pr-1',
          patientId: 'P-1002',
          patientName: 'Sarah Johnson',
          medicineId: 'med-1',
          medicineName: 'Metformin 500mg',
          prescribedDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
          durationDays: 30,
          doctorName: 'Dr. Michael Chen'
        },
        {
          id: 'pr-2',
          patientId: 'P-1003',
          patientName: 'David Mensah',
          medicineId: 'med-2',
          medicineName: 'Lisinopril 10mg',
          prescribedDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
          durationDays: 30,
          doctorName: 'Dr. Emily Davis'
        },
        {
          id: 'pr-3',
          patientId: 'P-1004',
          patientName: 'Kwame Boateng',
          medicineId: 'med-3',
          medicineName: 'Amoxicillin 500mg',
          prescribedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          durationDays: 10,
          doctorName: 'Dr. Michael Chen'
        }
      ];
      localStorage.setItem(PRESCRIPTIONS_KEY, JSON.stringify(initialPrescriptions));
      setPrescriptions(initialPrescriptions);
    }
  };

  const saveEvents = (next: DispenseEvent[]) => {
    setEvents(next);
    localStorage.setItem('dispenseEvents', JSON.stringify(next));
  };

  const processRefill = async (p: Prescription) => {
    if (!hasPermission('pharmacy:edit')) {
      toast.error('Unauthorized to edit pharmacy inventory');
      return;
    }

    // 1. Find the medicine in stock
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
      // 2. Decrement medicine stock on the backend using real API!
      const nextStock = Math.max(0, dbMed.stock_level - 1);
      await api.updatePharmacyItem(dbMed.id, { stock_level: nextStock });
      
      // 3. Log dispense event
      const ev: DispenseEvent = {
        id: Math.random().toString(36).slice(2),
        patientId: p.patientId,
        medicineId: dbMed.id,
        quantity: 1,
        date: new Date().toISOString(),
        notes: `Automated Prescription Refill - Prescribed by ${p.doctorName}`,
      };
      const nextEvents = [...events, ev];
      saveEvents(nextEvents);

      // 4. Reset prescription's prescribedDate to today to extend the supply
      const updatedPrescriptions = prescriptions.map((item) => {
        if (item.id === p.id) {
          return {
            ...item,
            prescribedDate: new Date().toISOString()
          };
        }
        return item;
      });
      setPrescriptions(updatedPrescriptions);
      localStorage.setItem('health_manager_prescriptions', JSON.stringify(updatedPrescriptions));

      // 5. Audit log
      logAction('dispense', 'pharmacy', { recordId: ev.id, newValue: JSON.stringify(ev) });
      toast.success(`Successfully refilled ${p.medicineName} for ${p.patientName}!`);
      
      // 6. Reload data to keep frontend inventory synchronized
      loadAll();
    } catch (e) {
      toast.error('Failed to update pharmacy stock level');
      console.error(e);
    }
  };

  const recordDispense = () => {
    if (!hasPermission('pharmacy:edit')) {
      toast.error('Unauthorized');
      return;
    }
    if (!form.patientId || !form.medicineId || form.quantity <= 0) {
      toast.error('Please select patient, medicine and quantity');
      return;
    }
    const ev: DispenseEvent = {
      id: Math.random().toString(36).slice(2),
      patientId: form.patientId,
      medicineId: form.medicineId,
      quantity: form.quantity,
      date: new Date().toISOString(),
      notes: form.notes,
    };
    const next = [...events, ev];
    saveEvents(next);
    logAction('dispense', 'pharmacy', { recordId: ev.id, newValue: JSON.stringify(ev) });
    toast.success('Dispense recorded');
    setForm({ patientId: '', medicineId: '', quantity: 1, notes: '' });
  };

  const historyForPatient = (pid: string) => events.filter((e) => e.patientId === pid);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Prescription Fulfillment</h1>
          <p className="text-muted-foreground">Process prescriptions and track dispensing</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process Prescription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <select className="border rounded p-2" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.first_name ? `${p.first_name} ${p.last_name}` : p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Medicine</Label>
              <select className="border rounded p-2" value={form.medicineId} onChange={(e) => setForm({ ...form, medicineId: e.target.value })}>
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
                <Pill className="h-5 w-5 text-indigo-500" />
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

                  // Find inventory medicine for stock level check
                  const dbMed = medicines.find((m) => m.id === p.medicineId || (m.medicine_name && m.medicine_name.toLowerCase().includes(p.medicineName.toLowerCase().split(' ')[0])));
                  const stockLevel = dbMed ? dbMed.stock_level : 0;
                  const isOutOfStock = dbMed ? dbMed.stock_level === 0 : true;

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        isNearingRefill 
                          ? 'border-rose-200 bg-rose-50/20 dark:border-rose-900/30 dark:bg-rose-950/10' 
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
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 bg-rose-500 text-white font-semibold">
                                <AlertCircle className="h-2.5 w-2.5 mr-1" />
                                Refill Nearing ({remainingDays}d left)
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm font-medium text-foreground/90 flex items-center gap-1.5">
                            <Pill className="h-3.5 w-3.5 text-muted-foreground" />
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
                                <span className="text-rose-500 font-semibold">Out of Stock</span>
                              ) : stockLevel <= (dbMed?.low_stock_threshold || 10) ? (
                                <span className="text-amber-500 font-semibold">Low Stock ({stockLevel} left)</span>
                              ) : (
                                <span className="text-emerald-500 font-semibold">In Stock ({stockLevel} units)</span>
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
                                    ? 'bg-rose-500' 
                                    : remainingDays <= 5 
                                      ? 'bg-amber-500' 
                                      : 'bg-emerald-500'
                                }`} 
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 font-medium"
                              disabled={isOutOfStock}
                              onClick={() => processRefill(p)}
                            >
                              <Check className="h-3 w-3" />
                              Refill
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs flex items-center gap-1 font-medium border-border"
                              onClick={() => navigate(`/appointments?search=${encodeURIComponent(p.patientName)}`)}
                            >
                              <Calendar className="h-3 w-3 text-muted-foreground" />
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}