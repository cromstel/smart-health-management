import React, { useState, useEffect } from 'react';
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

interface MedicationAdministration {
  id: string;
  patientId: string;
  patientName: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string; // e.g. "08:00 AM", "12:00 PM"
  status: 'Pending' | 'Administered' | 'Overdue';
  assignedStaff: string;
  criticalNotes?: string;
  administeredAt?: string;
}

interface MedicationComplianceTrackerProps {
  medicines: Medicine[];
  onDeductStock: (medicineId: string, quantity: number) => void;
}

const INITIAL_ADMINISTRATIONS: MedicationAdministration[] = [
  {
    id: 'admin-1',
    patientId: 'P-1001',
    patientName: 'Sarah Johnson',
    medicineId: '1', // Paracetamol
    medicineName: 'Paracetamol 500mg',
    dosage: '2 Tablets',
    scheduledTime: '08:00 AM',
    status: 'Administered',
    assignedStaff: 'Nurse Gifty Adjei',
    administeredAt: 'Today, 08:05 AM',
    criticalNotes: 'Given post-breakfast with warm water.'
  },
  {
    id: 'admin-2',
    patientId: 'P-1002',
    patientName: 'John Doe',
    medicineId: '2', // Insulin
    medicineName: 'Insulin Glargine',
    dosage: '10 Units',
    scheduledTime: '07:30 AM',
    status: 'Overdue',
    assignedStaff: 'Nurse Kwame Boateng',
    criticalNotes: 'Pre-meal injection required. Patient was sleeping.'
  },
  {
    id: 'admin-3',
    patientId: 'P-1003',
    patientName: 'David Mensah',
    medicineId: '3', // Lisinopril
    medicineName: 'Lisinopril 10mg',
    dosage: '1 Tablet',
    scheduledTime: '12:00 PM',
    status: 'Pending',
    assignedStaff: 'Nurse Mary Appiah',
    criticalNotes: 'Check blood pressure prior to administration.'
  },
  {
    id: 'admin-4',
    patientId: 'P-1001',
    patientName: 'Sarah Johnson',
    medicineId: '4', // Amoxicillin
    medicineName: 'Amoxicillin 500mg',
    dosage: '1 Capsule',
    scheduledTime: '02:00 PM',
    status: 'Pending',
    assignedStaff: 'Nurse Gifty Adjei',
    criticalNotes: 'Antibiotic cycle day 3 of 7.'
  }
];

export const MedicationComplianceTracker: React.FC<MedicationComplianceTrackerProps> = ({
  medicines,
  onDeductStock
}) => {
  const { addNotification } = useNotifications();
  const { logAction } = useAudit();
  const [administrations, setAdministrations] = useState<MedicationAdministration[]>(INITIAL_ADMINISTRATIONS);
  
  // Schedule state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [targetPatient, setTargetPatient] = useState('Sarah Johnson');
  const [selectedMedId, setSelectedMedId] = useState('');
  const [targetDosage, setTargetDosage] = useState('1 Tablet');
  const [targetTime, setTargetTime] = useState('02:00 PM');
  const [assignedStaff, setAssignedStaff] = useState('Nurse Gifty Adjei');
  const [notes, setNotes] = useState('');

  // Automatically check and trigger push-style notification alerts for Overdue administrations on load
  useEffect(() => {
    const overdues = administrations.filter(a => a.status === 'Overdue');
    if (overdues.length > 0) {
      overdues.forEach(overdue => {
        // Send internal notification alert
        addNotification({
          type: 'inventory_alert',
          priority: 'urgent',
          title: `CRITICAL: Overdue Medication Alert`,
          message: `${overdue.patientName} is overdue for ${overdue.dosage} of ${overdue.medicineName} (Scheduled: ${overdue.scheduledTime}). Attending: ${overdue.assignedStaff}.`,
          timestamp: 'Just Now',
          patientName: overdue.patientName,
          patientId: overdue.patientId
        });

        // Push standard visual EMR browser notification to staff
        toast.error(`⚠️ OVERDUE MEDICATION: ${overdue.patientName} is overdue for ${overdue.medicineName}!`, {
          description: `Assigned: ${overdue.assignedStaff} (Scheduled: ${overdue.scheduledTime})`,
          duration: 6000
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdminister = (id: string) => {
    const administration = administrations.find(a => a.id === id);
    if (!administration) return;

    // Deduct stock if corresponding medicine is found in Pharmacy
    const matchedMed = medicines.find(m => m.id === administration.medicineId || m.name.toLowerCase().includes(administration.medicineName.split(' ')[0].toLowerCase()));
    
    if (matchedMed) {
      if (matchedMed.stock <= 0) {
        toast.error(`Stockout alert: Cannot administer ${administration.medicineName}. Current stock is 0.`);
        return;
      }
      onDeductStock(matchedMed.id, 1);
    }

    setAdministrations(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          status: 'Administered',
          administeredAt: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        };
      }
      return a;
    }));

    logAction('MEDICINE_ADMINISTERED', 'pharmacy', {
      recordId: administration.patientId,
      oldValue: 'Pending',
      newValue: `Administered: ${administration.medicineName} (${administration.dosage}) for ${administration.patientName}`
    });

    toast.success(`Marked as Administered: ${administration.dosage} of ${administration.medicineName} signed off for ${administration.patientName}.`);
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
      icon: <Bell className="h-4 w-4 text-amber-500 animate-bounce" />
    });
  };

  const handleScheduleAdministration = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMedId) {
      toast.error("Please select a medication from the Pharmacy list");
      return;
    }

    const selectedMed = medicines.find(m => m.id === selectedMedId);
    if (!selectedMed) return;

    const newAdmin: MedicationAdministration = {
      id: `admin-${Date.now()}`,
      patientId: targetPatient === 'Sarah Johnson' ? 'P-1001' : targetPatient === 'John Doe' ? 'P-1002' : 'P-1003',
      patientName: targetPatient,
      medicineId: selectedMed.id,
      medicineName: selectedMed.name,
      dosage: targetDosage,
      scheduledTime: targetTime,
      status: 'Pending',
      assignedStaff,
      criticalNotes: notes
    };

    setAdministrations(prev => [...prev, newAdmin]);
    setShowScheduleForm(false);
    
    // Create audit log
    logAction('MED_ADMINISTRATION_SCHEDULED', 'pharmacy', {
      recordId: selectedMed.id,
      newValue: `Scheduled: ${targetPatient} - ${selectedMed.name} at ${targetTime}`
    });

    toast.success(`Successfully scheduled ${targetDosage} of ${selectedMed.name} for ${targetPatient} at ${targetTime}.`);

    // Reset fields
    setSelectedMedId('');
    setNotes('');
  };

  // Stats summaries
  const totalDoses = administrations.length;
  const completedDoses = administrations.filter(a => a.status === 'Administered').length;
  const pendingDoses = administrations.filter(a => a.status === 'Pending').length;
  const overdueDoses = administrations.filter(a => a.status === 'Overdue').length;

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
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-slate-50/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Doses Completed</span>
              <p className="text-xl font-bold text-emerald-600">{completedDoses}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-slate-50/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pending Doses</span>
              <p className="text-xl font-bold text-blue-600">{pendingDoses}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-slate-50/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Overdue Alerts</span>
              <p className="text-xl font-bold text-red-600 animate-pulse">{overdueDoses}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-red-50 text-red-600">
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
                        <div className="text-[10px] text-muted-foreground">{admin.patientId}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-900 dark:text-slate-200 flex items-center gap-1.5 font-bold">
                          <Pill className="h-3 w-3 text-indigo-500 shrink-0" /> {admin.medicineName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Dosage: {admin.dosage}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-slate-800 dark:text-slate-300">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {admin.scheduledTime}
                        </div>
                        {admin.administeredAt && (
                          <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">Given: {admin.administeredAt}</div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {admin.assignedStaff}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={`text-[10px] font-bold py-0.5 px-2 capitalize shrink-0 ${
                          admin.status === 'Administered' ? 'bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border-emerald-200' :
                          admin.status === 'Overdue' ? 'bg-red-50 hover:bg-red-50 text-red-700 border-red-200 animate-pulse' :
                          'bg-amber-50 hover:bg-amber-50 text-amber-700 border-amber-200'
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
                                  className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 shrink-0"
                                  title="Broadcast Urgency Pager Alert"
                                >
                                  <Bell className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleAdminister(admin.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] h-7 px-2 shrink-0 cursor-pointer"
                              >
                                Sign-off
                              </Button>
                            </>
                          )}
                          {admin.status === 'Administered' && (
                            <span className="text-emerald-600 font-bold flex items-center gap-1 text-[10px] pr-1.5 py-1">
                              <CheckCircle className="h-3.5 w-3.5" /> Checked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    >
                      <option value="Sarah Johnson">Sarah Johnson (P-1001)</option>
                      <option value="John Doe">John Doe (P-1002)</option>
                      <option value="David Mensah">David Mensah (P-1003)</option>
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
                          {m.name} (Stock: {m.stock} available)
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
                      <option value="Nurse Gifty Adjei">Nurse Gifty Adjei</option>
                      <option value="Nurse Kwame Boateng">Nurse Kwame Boateng</option>
                      <option value="Nurse Mary Appiah">Nurse Mary Appiah</option>
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
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 font-semibold cursor-pointer"
                    >
                      Confirm Schedule
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
                <div className="flex gap-2 p-2.5 rounded bg-amber-50 dark:bg-amber-500/5 text-amber-800 dark:text-amber-400 border border-amber-200/50">
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
                  <div className="flex justify-between">
                    <span>Paracetamol 500mg:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-300">Tied to Stock</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Insulin Glargine:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-300">Tied to Stock</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
