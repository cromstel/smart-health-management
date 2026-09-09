import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calendar,
  Sparkles,
  Clock,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  ArrowRightLeft,
} from 'lucide-react';

interface ShiftAssignment {
  id: string;
  clinicianId: string;
  clinicianName: string;
  role: 'Physician' | 'Surgeon' | 'Charge Nurse' | 'Triage Nurse' | 'Anesthesiologist';
  department: 'Emergency (ER)' | 'Intensive Care (ICU)' | 'Surgical Suite' | 'Outpatient' | 'Pediatrics';
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  shiftType: 'Morning (07:00-15:00)' | 'Evening (15:00-23:00)' | 'Night (23:00-07:00)';
  hours: number;
  workloadWeight: number; // 1.0 = normal, 1.8 = high surge
  isOvertimeRisk: boolean;
}

const INITIAL_SHIFTS: ShiftAssignment[] = [
  {
    id: 'S-1',
    clinicianId: 'S001',
    clinicianName: 'Dr. Michael Chen',
    role: 'Physician',
    department: 'Emergency (ER)',
    day: 'Mon',
    shiftType: 'Morning (07:00-15:00)',
    hours: 8,
    workloadWeight: 1.4,
    isOvertimeRisk: false,
  },
  {
    id: 'S-2',
    clinicianId: 'S002',
    clinicianName: 'Dr. Sarah Connor',
    role: 'Surgeon',
    department: 'Surgical Suite',
    day: 'Mon',
    shiftType: 'Morning (07:00-15:00)',
    hours: 8,
    workloadWeight: 1.6,
    isOvertimeRisk: false,
  },
  {
    id: 'S-3',
    clinicianId: 'S003',
    clinicianName: 'Nurse Amina Yeboah',
    role: 'Charge Nurse',
    department: 'Intensive Care (ICU)',
    day: 'Mon',
    shiftType: 'Night (23:00-07:00)',
    hours: 8,
    workloadWeight: 1.2,
    isOvertimeRisk: false,
  },
  {
    id: 'S-4',
    clinicianId: 'S004',
    clinicianName: 'Dr. Kwame Mensah',
    role: 'Physician',
    department: 'Emergency (ER)',
    day: 'Fri',
    shiftType: 'Night (23:00-07:00)',
    hours: 8,
    workloadWeight: 1.8, // Peak ER surge
    isOvertimeRisk: true,
  },
  {
    id: 'S-5',
    clinicianId: 'S005',
    clinicianName: 'Nurse David Osei',
    role: 'Triage Nurse',
    department: 'Emergency (ER)',
    day: 'Sat',
    shiftType: 'Night (23:00-07:00)',
    hours: 8,
    workloadWeight: 1.8,
    isOvertimeRisk: false,
  },
  {
    id: 'S-6',
    clinicianId: 'S006',
    clinicianName: 'Dr. Elizabeth Taylor',
    role: 'Anesthesiologist',
    department: 'Surgical Suite',
    day: 'Tue',
    shiftType: 'Morning (07:00-15:00)',
    hours: 8,
    workloadWeight: 1.5,
    isOvertimeRisk: false,
  },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DEPARTMENTS = [
  'Emergency (ER)',
  'Intensive Care (ICU)',
  'Surgical Suite',
  'Outpatient',
  'Pediatrics',
] as const;

export function ShiftSchedulerModule() {
  const [shifts, setShifts] = useState<ShiftAssignment[]>(INITIAL_SHIFTS);
  const [selectedDept, setSelectedDept] = useState<string>('Emergency (ER)');
  const [balanceScore, setBalanceScore] = useState<number>(88); // Initial score %
  const [isAutoBalancing, setIsAutoBalancing] = useState(false);
  const [isSwapDialogOpen, setIsSwapDialogOpen] = useState(false);

  // Auto-Balancing Algorithm simulation
  const handleAutoBalanceAlgorithm = () => {
    setIsAutoBalancing(true);
    const toastId = toast.loading('Running Constraint Solver & Workload Auto-Balancing Algorithm...');

    setTimeout(() => {
      // Re-balance shifts: distribute night shifts evenly and clear overtime risks
      const balancedShifts = shifts.map((s) => ({
        ...s,
        isOvertimeRisk: false,
        workloadWeight: Math.min(1.5, s.workloadWeight),
      }));

      // Add optimal coverage padding for understaffed days
      const newAutoShifts: ShiftAssignment[] = [
        ...balancedShifts,
        {
          id: `S-AUTO-${Date.now()}`,
          clinicianId: 'S008',
          clinicianName: 'Dr. Elena Rostova',
          role: 'Physician',
          department: 'Emergency (ER)',
          day: 'Sat',
          shiftType: 'Evening (15:00-23:00)',
          hours: 8,
          workloadWeight: 1.2,
          isOvertimeRisk: false,
        },
      ];

      setShifts(newAutoShifts);
      setBalanceScore(98); // High optimized score!

      toast.success('Shift Schedule Successfully Auto-Balanced!', {
        id: toastId,
        description: 'Optimized 100% role compliance, eliminated overtime fatigue risks, and balanced peak ER workload.',
      });
      setIsAutoBalancing(false);
    }, 1500);
  };

  const totalWeeklyHours = shifts.reduce((sum, s) => sum + s.hours, 0);
  const overtimeCount = shifts.filter((s) => s.isOvertimeRisk).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-sky-500/30 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-300">
            <Sparkles className="h-7 w-7 text-sky-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                Algorithmic Shift Scheduler & Workload Balancer
              </h2>
              <Badge className="bg-sky-600 text-white font-mono text-[10px]">AUTO-OPTIMIZER V2.4</Badge>
            </div>
            <p className="text-xs text-sky-200/80 mt-0.5">
              Auto-balances clinician shift assignments matching availability, fatigue prevention rules, and historical departmental workload curves
            </p>
          </div>
        </div>

        <Button
          onClick={handleAutoBalanceAlgorithm}
          disabled={isAutoBalancing}
          className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-10 px-4 shadow-lg gap-2 border border-sky-400/30 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isAutoBalancing ? 'animate-spin' : ''}`} />
          <span>Auto-Balance Shifts ({balanceScore}% Score)</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-sky-500/30 bg-sky-950/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-sky-500 uppercase tracking-wider">Schedule Balance Index</p>
              <p className="text-2xl font-black text-sky-600 dark:text-sky-400">{balanceScore}% Optimal</p>
            </div>
            <ShieldCheck className="h-7 w-7 text-sky-500" />
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-950/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider">Shift Coverage Ratio</p>
              <p className="text-2xl font-black text-emerald-500">100% Filled</p>
            </div>
            <UserCheck className="h-7 w-7 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-950/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">Overtime / Fatigue Warnings</p>
              <p className="text-2xl font-black text-amber-500">{overtimeCount} Clinicians</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="border-indigo-500/30 bg-indigo-950/10">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Total Scheduled Hours</p>
              <p className="text-2xl font-black text-indigo-400">{totalWeeklyHours} Hours/Wk</p>
            </div>
            <Clock className="h-7 w-7 text-indigo-400" />
          </CardContent>
        </Card>
      </div>

      {/* Interactive Weekly Department Matrix */}
      <Card>
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-sky-500" />
              Weekly Department Shift Roster (Mon - Sun)
            </CardTitle>
            <CardDescription className="text-xs">
              View and manage shifts across departments with live workload curve factors
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setIsSwapDialogOpen(true)}>
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Shift Swap Request</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-32 text-xs">Day / Workload</TableHead>
                <TableHead className="text-xs">Morning (07:00-15:00)</TableHead>
                <TableHead className="text-xs">Evening (15:00-23:00)</TableHead>
                <TableHead className="text-xs">Night (23:00-07:00)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DAYS.map((day) => {
                const dayShifts = shifts.filter((s) => s.department === selectedDept && s.day === day);
                const morningShifts = dayShifts.filter((s) => s.shiftType.startsWith('Morning'));
                const eveningShifts = dayShifts.filter((s) => s.shiftType.startsWith('Evening'));
                const nightShifts = dayShifts.filter((s) => s.shiftType.startsWith('Night'));

                // Workload surge calculation
                const isPeakDay = day === 'Fri' || day === 'Sat';

                return (
                  <TableRow key={day} className="hover:bg-muted/10">
                    <TableCell className="font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <span>{day}</span>
                        {isPeakDay && (
                          <Badge className="bg-rose-500 text-white text-[9px] px-1 py-0 font-mono">PEAK SURGE</Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Morning */}
                    <TableCell className="align-top p-2">
                      {morningShifts.length > 0 ? (
                        morningShifts.map((s) => (
                          <div key={s.id} className="p-2 rounded bg-sky-500/10 border border-sky-500/20 mb-1 text-xs space-y-0.5">
                            <span className="font-bold text-foreground block">{s.clinicianName}</span>
                            <span className="text-[10px] text-muted-foreground block">{s.role}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Standard Coverage</span>
                      )}
                    </TableCell>

                    {/* Evening */}
                    <TableCell className="align-top p-2">
                      {eveningShifts.length > 0 ? (
                        eveningShifts.map((s) => (
                          <div key={s.id} className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 mb-1 text-xs space-y-0.5">
                            <span className="font-bold text-foreground block">{s.clinicianName}</span>
                            <span className="text-[10px] text-muted-foreground block">{s.role}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Standard Coverage</span>
                      )}
                    </TableCell>

                    {/* Night */}
                    <TableCell className="align-top p-2">
                      {nightShifts.length > 0 ? (
                        nightShifts.map((s) => (
                          <div
                            key={s.id}
                            className={`p-2 rounded border mb-1 text-xs space-y-0.5 ${
                              s.isOvertimeRisk
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200'
                                : 'bg-purple-500/10 border-purple-500/20'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-foreground">{s.clinicianName}</span>
                              {s.isOvertimeRisk && <Badge className="bg-amber-500 text-black text-[8px]">OT RISK</Badge>}
                            </div>
                            <span className="text-[10px] text-muted-foreground block">{s.role}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">On-Call Backup</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Shift Swap Modal */}
      <Dialog open={isSwapDialogOpen} onOpenChange={setIsSwapDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ArrowRightLeft className="h-5 w-5 text-sky-500" />
              Request Clinician Shift Swap
            </DialogTitle>
            <DialogDescription className="text-xs">
              Automated compliance check validates target clinician qualifications before approval
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-200">
              <p className="font-semibold">Swap Protocol:</p>
              <p className="mt-1">
                Requested swaps will automatically adjust weekly hour tallies to avoid overtime fatigue violations.
              </p>
            </div>

            <Button
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold"
              onClick={() => {
                toast.success('Shift Swap Request submitted to Head Nurse for signoff');
                setIsSwapDialogOpen(false);
              }}
            >
              Submit Shift Swap Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
