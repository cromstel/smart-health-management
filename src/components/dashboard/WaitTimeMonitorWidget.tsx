import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Clock,
  ShieldAlert,
  Send,
  UserPlus,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface DepartmentWaitData {
  id: string;
  department: string;
  avgWaitMins: number;
  targetMins: number;
  waitingCount: number;
  status: 'CRITICAL' | 'WARNING' | 'NORMAL';
  longestWaitingPatient: string;
  longestWaitTimeMins: number;
  trend: { time: string; waitTime: number }[];
}

const INITIAL_WAIT_DATA: DepartmentWaitData[] = [
  {
    id: 'DEPT-ER',
    department: 'Emergency & Trauma',
    avgWaitMins: 38,
    targetMins: 15,
    waitingCount: 14,
    status: 'CRITICAL',
    longestWaitingPatient: 'Kwame Mensah (Triage Level 3)',
    longestWaitTimeMins: 52,
    trend: [
      { time: '08:00', waitTime: 12 },
      { time: '10:00', waitTime: 22 },
      { time: '12:00', waitTime: 31 },
      { time: '13:00', waitTime: 38 },
    ],
  },
  {
    id: 'DEPT-TRIAGE',
    department: 'Triage Assessment',
    avgWaitMins: 22,
    targetMins: 10,
    waitingCount: 8,
    status: 'WARNING',
    longestWaitingPatient: 'Ama Serwaa (Level 4)',
    longestWaitTimeMins: 31,
    trend: [
      { time: '08:00', waitTime: 8 },
      { time: '10:00', waitTime: 14 },
      { time: '12:00', waitTime: 18 },
      { time: '13:00', waitTime: 22 },
    ],
  },
  {
    id: 'DEPT-PEDS',
    department: 'General Pediatrics',
    avgWaitMins: 28,
    targetMins: 20,
    waitingCount: 9,
    status: 'WARNING',
    longestWaitingPatient: 'Kofi Badu (Pediatric OPD)',
    longestWaitTimeMins: 36,
    trend: [
      { time: '08:00', waitTime: 15 },
      { time: '10:00', waitTime: 20 },
      { time: '12:00', waitTime: 25 },
      { time: '13:00', waitTime: 28 },
    ],
  },
  {
    id: 'DEPT-CARD',
    department: 'Outpatient Cardiology',
    avgWaitMins: 12,
    targetMins: 20,
    waitingCount: 3,
    status: 'NORMAL',
    longestWaitingPatient: 'Sarah Connor (Follow-up)',
    longestWaitTimeMins: 16,
    trend: [
      { time: '08:00', waitTime: 10 },
      { time: '10:00', waitTime: 11 },
      { time: '12:00', waitTime: 14 },
      { time: '13:00', waitTime: 12 },
    ],
  },
  {
    id: 'DEPT-RAD',
    department: 'Radiology & Imaging',
    avgWaitMins: 18,
    targetMins: 25,
    waitingCount: 5,
    status: 'NORMAL',
    longestWaitingPatient: 'Emmanuel Owusu (CT Scan)',
    longestWaitTimeMins: 22,
    trend: [
      { time: '08:00', waitTime: 20 },
      { time: '10:00', waitTime: 19 },
      { time: '12:00', waitTime: 18 },
      { time: '13:00', waitTime: 18 },
    ],
  },
];

export function WaitTimeMonitorWidget() {
  const [departments, setDepartments] = useState<DepartmentWaitData[]>(INITIAL_WAIT_DATA);
  const [selectedDeptForIntervention, setSelectedDeptForIntervention] = useState<DepartmentWaitData | null>(null);
  const [isInterventionModalOpen, setIsInterventionModalOpen] = useState(false);
  const [isReallocating, setIsReallocating] = useState(false);

  // Administrative intervention action
  const handleReallocateStaff = (deptId: string) => {
    setIsReallocating(true);
    const toastId = toast.loading('Dispatching 2 Floating Clinicians to Emergency & Trauma...');

    setTimeout(() => {
      setDepartments((prev) =>
        prev.map((d) => {
          if (d.id === deptId) {
            const newAvg = Math.max(d.targetMins, d.avgWaitMins - 14);
            return {
              ...d,
              avgWaitMins: newAvg,
              status: newAvg <= d.targetMins ? 'NORMAL' : newAvg <= d.targetMins * 1.5 ? 'WARNING' : 'CRITICAL',
              trend: [...d.trend, { time: 'Now', waitTime: newAvg }],
            };
          }
          return d;
        })
      );

      toast.success('Staff Reallocated! Average ER wait time reduced to 24 mins.', {
        id: toastId,
        description: 'Assigned Nurse David Osei & Dr. Elena Rostova to Fast-Track Triage Bay 02.',
      });
      setIsReallocating(false);
      setIsInterventionModalOpen(false);
    }, 1200);
  };

  const handleNotifyChargeNurse = (deptName: string) => {
    toast.success(`Priority Administrative SMS dispatched to ${deptName} Charge Nurse`, {
      description: 'Alert: Immediate staff intervention required due to wait time threshold exceedance (>30m).',
    });
    setIsInterventionModalOpen(false);
  };

  const criticalCount = departments.filter((d) => d.status === 'CRITICAL').length;
  const warningCount = departments.filter((d) => d.status === 'WARNING').length;

  return (
    <Card className="border shadow-md">
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
              Real-Time Department Wait Time Monitor
            </CardTitle>
            <CardDescription className="text-xs">
              Live tracking of patient wait durations per department with automated delay alerts
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-rose-600 text-white font-bold animate-bounce text-[10px]">
                🔴 {criticalCount} CRITICAL DELAY
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-amber-500 text-black font-bold text-[10px]">
                🟡 {warningCount} DELAY WARNING
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Department Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className={`p-3.5 rounded-xl border transition-all ${
                dept.status === 'CRITICAL'
                  ? 'bg-rose-950/20 border-rose-500/50 shadow-rose-500/10'
                  : dept.status === 'WARNING'
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-card border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-foreground">{dept.department}</span>
                <Badge
                  className={`text-[9px] font-bold font-mono ${
                    dept.status === 'CRITICAL'
                      ? 'bg-rose-600 text-white'
                      : dept.status === 'WARNING'
                      ? 'bg-amber-500 text-black'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {dept.avgWaitMins} mins avg
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between text-[11px]">
                  <span>Target Wait:</span>
                  <span className="font-mono text-foreground font-semibold">&lt;{dept.targetMins} mins</span>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span>In Queue:</span>
                  <span className="font-mono font-bold text-foreground">{dept.waitingCount} Patients</span>
                </div>

                <div className="pt-1 border-t text-[10px] text-muted-foreground truncate">
                  Longest: <strong className="text-foreground">{dept.longestWaitingPatient}</strong> ({dept.longestWaitTimeMins}m)
                </div>

                <div className="h-10 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dept.trend}>
                      <Line
                        type="monotone"
                        dataKey="waitTime"
                        stroke={dept.status === 'CRITICAL' ? '#f43f5e' : dept.status === 'WARNING' ? '#f59e0b' : '#10b981'}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {dept.status !== 'NORMAL' && (
                <Button
                  size="sm"
                  className="w-full mt-3 h-7 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1"
                  onClick={() => {
                    setSelectedDeptForIntervention(dept);
                    setIsInterventionModalOpen(true);
                  }}
                >
                  <ShieldAlert className="h-3 w-3" />
                  <span>Admin Intervention</span>
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Intervention Modal */}
      {selectedDeptForIntervention && (
        <Dialog open={isInterventionModalOpen} onOpenChange={setIsInterventionModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-rose-500">
                <ShieldAlert className="h-5 w-5" />
                Administrative Delay Intervention
              </DialogTitle>
              <DialogDescription className="text-xs">
                Active bottleneck detected in <strong>{selectedDeptForIntervention.department}</strong> (Average wait: {selectedDeptForIntervention.avgWaitMins} mins vs target {selectedDeptForIntervention.targetMins} mins)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-1">
                <p className="font-bold text-rose-700 dark:text-rose-300">Longest Delayed Patient:</p>
                <p className="text-foreground font-semibold">
                  {selectedDeptForIntervention.longestWaitingPatient} — Waiting {selectedDeptForIntervention.longestWaitTimeMins} mins
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2">
                <Button
                  onClick={() => handleReallocateStaff(selectedDeptForIntervention.id)}
                  disabled={isReallocating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Dispatch Floating Staff (+2 Clinicians)</span>
                </Button>

                <Button
                  onClick={() => handleNotifyChargeNurse(selectedDeptForIntervention.department)}
                  variant="outline"
                  className="font-semibold h-9 gap-2 border-rose-500/30 text-rose-600 dark:text-rose-400"
                >
                  <Send className="h-4 w-4" />
                  <span>Send Urgent SMS to Charge Nurse</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
