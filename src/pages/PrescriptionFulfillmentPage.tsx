import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAudit } from '@/contexts/AuditContext';
import { useAuth } from '@/contexts/AuthContext';

interface DispenseEvent {
  id: string;
  patientId: string;
  medicineId: string;
  quantity: number;
  date: string;
  notes?: string;
}

export default function PrescriptionFulfillmentPage() {
  const { hasPermission } = useAuth();
  const { logAction } = useAudit();
  const [patients, setPatients] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [events, setEvents] = useState<DispenseEvent[]>([]);
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
  };

  const saveEvents = (next: DispenseEvent[]) => {
    setEvents(next);
    localStorage.setItem('dispenseEvents', JSON.stringify(next));
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
              <Label htmlFor="patient-select">Patient</Label>
              <select id="patient-select" aria-label="Select patient" className="border rounded p-2" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.first_name ? `${p.first_name} ${p.last_name}` : p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicine-select">Medicine</Label>
              <select id="medicine-select" aria-label="Select medicine" className="border rounded p-2" value={form.medicineId} onChange={(e) => setForm({ ...form, medicineId: e.target.value })}>
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