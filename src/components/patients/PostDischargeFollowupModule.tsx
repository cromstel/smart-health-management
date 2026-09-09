import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  PhoneCall,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Plus,
  Search,
  ShieldAlert,
  Calendar,
} from 'lucide-react';

export interface FollowupTask {
  id: string;
  patientId: string;
  patientName: string;
  dischargeDate: string;
  diagnosis: string;
  phase: 'Day 1 (24h Meds)' | 'Day 3 (72h Wound/Vitals)' | 'Day 7 (Primary Care)' | 'Day 14 (Milestone)';
  dueDate: string;
  assignedNurse: string;
  status: 'DUE_TODAY' | 'OVERDUE' | 'COMPLETED' | 'ESCALATED';
  readmissionRisk: 'LOW' | 'MODERATE' | 'HIGH';
  callOutcomeNotes?: string;
}

const INITIAL_TASKS: FollowupTask[] = [
  {
    id: 'TASK-101',
    patientId: 'P-1002',
    patientName: 'Sarah Connor',
    dischargeDate: '2026-09-07',
    diagnosis: 'Post-Op Cardiac Bypass',
    phase: 'Day 1 (24h Meds)',
    dueDate: '2026-09-08 (Today)',
    assignedNurse: 'Nurse Amina Yeboah',
    status: 'DUE_TODAY',
    readmissionRisk: 'HIGH',
  },
  {
    id: 'TASK-102',
    patientId: 'P-1005',
    patientName: 'Kwame Mensah',
    dischargeDate: '2026-09-05',
    diagnosis: 'Type 2 Diabetes Exacerbation',
    phase: 'Day 3 (72h Wound/Vitals)',
    dueDate: '2026-09-08 (Today)',
    assignedNurse: 'Nurse David Osei',
    status: 'DUE_TODAY',
    readmissionRisk: 'MODERATE',
  },
  {
    id: 'TASK-103',
    patientId: 'P-1009',
    patientName: 'Amina Yeboah',
    dischargeDate: '2026-09-01',
    diagnosis: 'Abdominal Surgery / Appendectomy',
    phase: 'Day 7 (Primary Care)',
    dueDate: '2026-09-07 (Yesterday)',
    assignedNurse: 'Nurse Grace Tagoe',
    status: 'OVERDUE',
    readmissionRisk: 'LOW',
  },
  {
    id: 'TASK-104',
    patientId: 'P-1012',
    patientName: 'Emmanuel Owusu',
    dischargeDate: '2026-08-25',
    diagnosis: 'Congestive Heart Failure',
    phase: 'Day 14 (Milestone)',
    dueDate: '2026-09-08 (Today)',
    assignedNurse: 'Nurse Amina Yeboah',
    status: 'COMPLETED',
    readmissionRisk: 'LOW',
    callOutcomeNotes: 'Patient feeling energetic, blood pressure 122/80 over phone, confirmed primary care appointment.',
  },
];

export function PostDischargeFollowupModule() {
  const [tasks, setTasks] = useState<FollowupTask[]>(INITIAL_TASKS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedTask, setSelectedTask] = useState<FollowupTask | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  // Form state for call logging
  const [callNotes, setCallNotes] = useState('');
  const [reportedBp, setReportedBp] = useState('120/80');
  const [reportedTemp, setReportedTemp] = useState('36.8');
  const [hasFever, setHasFever] = useState(false);
  const [hasSeverePain, setHasSeverePain] = useState(false);
  const [hasSwelling, setHasSwelling] = useState(false);

  // New enrollment form
  const [newEnrollment, setNewEnrollment] = useState({
    patientName: '',
    patientId: '',
    diagnosis: '',
    dischargeDate: new Date().toISOString().slice(0, 10),
    assignedNurse: 'Nurse Amina Yeboah',
    readmissionRisk: 'MODERATE' as 'LOW' | 'MODERATE' | 'HIGH',
  });

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.diagnosis.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && t.status === statusFilter;
  });

  const dueTodayCount = tasks.filter((t) => t.status === 'DUE_TODAY').length;
  const overdueCount = tasks.filter((t) => t.status === 'OVERDUE').length;
  const highRiskCount = tasks.filter((t) => t.readmissionRisk === 'HIGH').length;

  const handleOpenCallModal = (task: FollowupTask) => {
    setSelectedTask(task);
    setCallNotes('');
    setHasFever(false);
    setHasSeverePain(false);
    setHasSwelling(false);
    setIsCallModalOpen(true);
  };

  const handleSaveCallOutcome = (escalate: boolean) => {
    if (!selectedTask) return;

    const isRedFlag = hasFever || hasSeverePain || hasSwelling || escalate;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === selectedTask.id) {
          return {
            ...t,
            status: isRedFlag ? 'ESCALATED' : 'COMPLETED',
            callOutcomeNotes: `Vitals: BP ${reportedBp}, Temp ${reportedTemp}°C. Notes: ${callNotes}${
              isRedFlag ? ' [RED FLAG SYMPTOMS DETECTED]' : ''
            }`,
          };
        }
        return t;
      })
    );

    if (isRedFlag) {
      toast.error(`Outreach Escalated to Attending Physician!`, {
        description: `Red flag symptoms recorded for ${selectedTask.patientName}. Physician notified for immediate follow-up.`,
      });
    } else {
      toast.success(`Post-Discharge Outreach Logged for ${selectedTask.patientName}`, {
        description: `Task marked complete. Next outreach scheduled automatically.`,
      });
    }

    setIsCallModalOpen(false);
  };

  const handleEnrollPatient = () => {
    if (!newEnrollment.patientName) {
      toast.error('Please enter patient name');
      return;
    }

    const newTask: FollowupTask = {
      id: `TASK-${Date.now()}`,
      patientId: newEnrollment.patientId || `P-${Math.floor(1000 + Math.random() * 9000)}`,
      patientName: newEnrollment.patientName,
      dischargeDate: newEnrollment.dischargeDate,
      diagnosis: newEnrollment.diagnosis || 'Post-Surgical Care',
      phase: 'Day 1 (24h Meds)',
      dueDate: `${newEnrollment.dischargeDate} (Tomorrow)`,
      assignedNurse: newEnrollment.assignedNurse,
      status: 'DUE_TODAY',
      readmissionRisk: newEnrollment.readmissionRisk,
    };

    setTasks([newTask, ...tasks]);
    toast.success(`Automated 4-Phase Post-Discharge Plan Created for ${newEnrollment.patientName}!`, {
      description: 'Scheduled outreach calls for 24h, 72h, 1 Week, and 2 Weeks.',
    });
    setIsEnrollModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
            <PhoneCall className="h-7 w-7 text-emerald-400 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                Automated Post-Discharge Outreach & Task Center
              </h2>
              <Badge className="bg-emerald-600 text-white font-mono text-[10px]">READMISSION PREVENTION</Badge>
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              Automatically schedules and assigns 4-phase nurse follow-up outreach calls to prevent 30-day hospital readmissions
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsEnrollModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 shadow-lg gap-2 border border-emerald-400/30 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Schedule Post-Discharge Plan</span>
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-emerald-500/30 bg-emerald-950/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider">Outreach Calls Due Today</p>
              <p className="text-2xl font-black text-emerald-500">{dueTodayCount} Calls</p>
            </div>
            <Clock className="h-7 w-7 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-950/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider">Overdue Outreach Tasks</p>
              <p className="text-2xl font-black text-rose-500">{overdueCount} Patients</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-rose-500" />
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-950/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">High Readmission Risk</p>
              <p className="text-2xl font-black text-amber-500">{highRiskCount} Patients</p>
            </div>
            <ShieldAlert className="h-7 w-7 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="border-indigo-500/30 bg-indigo-950/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Nursing Team Lead</p>
              <p className="text-xl font-bold text-indigo-300">Nurse Amina Y.</p>
            </div>
            <UserCheck className="h-7 w-7 text-indigo-400" />
          </CardContent>
        </Card>
      </div>

      {/* Task List Table */}
      <Card>
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-500" />
              Patient Outreach Task Queue
            </CardTitle>
            <CardDescription className="text-xs">
              Nurse-led post-discharge telephonic outreach roster
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DUE_TODAY">Due Today</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ESCALATED">🔴 Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Patient & Diagnosis</TableHead>
                <TableHead className="text-xs">Outreach Phase</TableHead>
                <TableHead className="text-xs">Risk Index</TableHead>
                <TableHead className="text-xs">Assigned Nurse</TableHead>
                <TableHead className="text-xs">Due Date</TableHead>
                <TableHead className="text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/10">
                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-foreground block">{t.patientName} ({t.patientId})</span>
                      <span className="text-[10px] text-muted-foreground block">{t.diagnosis} • Discharged {t.dischargeDate}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                      {t.phase}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge
                      className={`text-[9px] font-bold font-mono ${
                        t.readmissionRisk === 'HIGH'
                          ? 'bg-rose-600 text-white'
                          : t.readmissionRisk === 'MODERATE'
                          ? 'bg-amber-500 text-black'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {t.readmissionRisk} RISK
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">{t.assignedNurse}</TableCell>

                  <TableCell className="text-xs font-mono">
                    <span
                      className={
                        t.status === 'OVERDUE'
                          ? 'text-rose-600 font-bold'
                          : t.status === 'DUE_TODAY'
                          ? 'text-emerald-600 font-semibold'
                          : 'text-muted-foreground'
                      }
                    >
                      {t.dueDate}
                    </span>
                  </TableCell>

                  <TableCell className="text-right">
                    {t.status === 'COMPLETED' ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </Badge>
                    ) : t.status === 'ESCALATED' ? (
                      <Badge className="bg-rose-600 text-white text-[10px] gap-1">
                        <ShieldAlert className="h-3 w-3" /> Escalated
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        onClick={() => handleOpenCallModal(t)}
                      >
                        <PhoneCall className="h-3 w-3" />
                        <span>Perform Call</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Perform Call Modal */}
      {selectedTask && (
        <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-emerald-600 dark:text-emerald-400">
                <PhoneCall className="h-5 w-5" />
                Perform Post-Discharge Call — {selectedTask.patientName}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {selectedTask.phase} Outreach • Diagnosis: <strong>{selectedTask.diagnosis}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Telephonic Checklist */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <p className="font-bold text-emerald-800 dark:text-emerald-200">Standard Nurse Script Checklist:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-[11px]">
                  <li>Verify patient has picked up all prescribed discharge medications</li>
                  <li>Inquire about current pain level (Scale 1-10) and wound recovery</li>
                  <li>Confirm upcoming primary care / specialist follow-up appointment date</li>
                </ul>
              </div>

              {/* Patient Reported Vitals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="bp" className="text-xs">Reported Blood Pressure</Label>
                  <Input
                    id="bp"
                    value={reportedBp}
                    onChange={(e) => setReportedBp(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="temp" className="text-xs">Reported Temp (°C)</Label>
                  <Input
                    id="temp"
                    value={reportedTemp}
                    onChange={(e) => setReportedTemp(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Red Flag Symptoms */}
              <div className="space-y-2 pt-1 border-t">
                <Label className="text-xs font-bold text-rose-500 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Red-Flag Symptom Screening
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="fever" checked={hasFever} onCheckedChange={(c) => setHasFever(!!c)} />
                    <Label htmlFor="fever" className="text-[11px] cursor-pointer">Fever &gt; 38.5°C</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="pain" checked={hasSeverePain} onCheckedChange={(c) => setHasSeverePain(!!c)} />
                    <Label htmlFor="pain" className="text-[11px] cursor-pointer">Severe Pain</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="swelling" checked={hasSwelling} onCheckedChange={(c) => setHasSwelling(!!c)} />
                    <Label htmlFor="swelling" className="text-[11px] cursor-pointer">Wound Bleeding</Label>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs">Call Summary Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Patient reports taking medications as instructed. Pain well controlled..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="text-xs h-20"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-between gap-2 pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="font-bold gap-1 text-xs"
                  onClick={() => handleSaveCallOutcome(true)}
                >
                  <ShieldAlert className="h-3.5 w-3.5" /> Escalate to Physician
                </Button>

                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 text-xs"
                  onClick={() => handleSaveCallOutcome(false)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete Outreach
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Enroll Patient Modal */}
      <Dialog open={isEnrollModalOpen} onOpenChange={setIsEnrollModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-emerald-600 dark:text-emerald-400">
              <Plus className="h-5 w-5" />
              Schedule Post-Discharge Follow-up Plan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generates an automated 4-phase outreach workflow for a newly discharged patient
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="pName" className="text-xs">Patient Full Name</Label>
              <Input
                id="pName"
                placeholder="e.g. Ama Serwaa"
                value={newEnrollment.patientName}
                onChange={(e) => setNewEnrollment({ ...newEnrollment, patientName: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="diag" className="text-xs">Discharge Diagnosis / Procedure</Label>
              <Input
                id="diag"
                placeholder="e.g. Total Knee Arthroplasty"
                value={newEnrollment.diagnosis}
                onChange={(e) => setNewEnrollment({ ...newEnrollment, diagnosis: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="risk" className="text-xs">Readmission Risk</Label>
                <Select
                  value={newEnrollment.readmissionRisk}
                  onValueChange={(val: any) => setNewEnrollment({ ...newEnrollment, readmissionRisk: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low Risk</SelectItem>
                    <SelectItem value="MODERATE">Moderate Risk</SelectItem>
                    <SelectItem value="HIGH">High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="nurse" className="text-xs">Assigned Nurse</Label>
                <Input
                  id="nurse"
                  value={newEnrollment.assignedNurse}
                  onChange={(e) => setNewEnrollment({ ...newEnrollment, assignedNurse: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 mt-2"
              onClick={handleEnrollPatient}
            >
              Generate 4-Phase Outreach Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
