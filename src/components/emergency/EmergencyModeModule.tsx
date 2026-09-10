import { useState } from 'react';
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

interface EmergencyPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  triageLevel: 'RED' | 'AMBER';
  condition: string;
  bed: string;
  bp: string;
  hr: number;
  spo2: number;
  timeAdmitted: string;
}

interface ErBed {
  id: string;
  label: string;
  status: 'OCCUPIED' | 'AVAILABLE' | 'CLEANING';
  patient: string | null;
  triage: string | null;
}

const INITIAL_EMERGENCY_PATIENTS: EmergencyPatient[] = [
  {
    id: 'P-1002',
    name: 'Sarah Connor',
    age: 42,
    gender: 'Female',
    triageLevel: 'RED',
    condition: 'Acute Chest Pain / Suspected STEMI',
    bed: 'ER-BAY-01',
    bp: '165/102',
    hr: 112,
    spo2: 93,
    timeAdmitted: '8 mins ago',
  },
  {
    id: 'P-1005',
    name: 'Kwame Mensah',
    age: 58,
    gender: 'Male',
    triageLevel: 'RED',
    condition: 'Severe Respiratory Distress / Asthma Exacerbation',
    bed: 'ER-BAY-03',
    bp: '148/92',
    hr: 124,
    spo2: 88,
    timeAdmitted: '14 mins ago',
  },
  {
    id: 'P-1009',
    name: 'Amina Yeboah',
    age: 31,
    gender: 'Female',
    triageLevel: 'AMBER',
    condition: 'Anaphylactic Reaction (Penicillin Allergy)',
    bed: 'ER-BAY-04',
    bp: '95/60',
    hr: 105,
    spo2: 95,
    timeAdmitted: '22 mins ago',
  },
];

const ER_BEDS: ErBed[] = [
  { id: 'ER-BAY-01', label: 'Bay 01 (Trauma)', status: 'OCCUPIED', patient: 'Sarah Connor', triage: 'RED' },
  { id: 'ER-BAY-02', label: 'Bay 02 (Resus)', status: 'AVAILABLE', patient: null, triage: null },
  { id: 'ER-BAY-03', label: 'Bay 03 (Trauma)', status: 'OCCUPIED', patient: 'Kwame Mensah', triage: 'RED' },
  { id: 'ER-BAY-04', label: 'Bay 04 (General)', status: 'OCCUPIED', patient: 'Amina Yeboah', triage: 'AMBER' },
  { id: 'ER-BAY-05', label: 'Bay 05 (General)', status: 'AVAILABLE', patient: null, triage: null },
  { id: 'ER-BAY-06', label: 'Bay 06 (Isolation)', status: 'CLEANING', patient: null, triage: null },
];

interface EmergencyModeModuleProps {
  onOpenLogVitals: () => void;
  onOpenHandover: () => void;
}

export function EmergencyModeModule({ onOpenLogVitals, onOpenHandover }: EmergencyModeModuleProps) {
  const [patients] = useState<EmergencyPatient[]>(INITIAL_EMERGENCY_PATIENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [beds, setBeds] = useState<ErBed[]>(ER_BEDS);
  const [statActionRunning, setStatActionRunning] = useState<string | null>(null);

  const handleCodeBlueBroadcast = () => {
    setStatActionRunning('code_blue');
    const toastId = toast.loading('BROADCASTING CODE BLUE ALERT TO RESUSCITATION TEAM...');
    
    setTimeout(() => {
      toast.error('🚨 CODE BLUE BROADCASTED TO ALL TRAUMA WORKSTATIONS & ICU LEADS', {
        id: toastId,
        duration: 6000,
      });
      setStatActionRunning(null);
    }, 1200);
  };

  const handleAllocateBed = (bedId: string) => {
    setBeds((prev) =>
      prev.map((b) => {
        if (b.id === bedId) {
          const newStatus = b.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
          toast.info(`Bed ${b.label} status changed to ${newStatus}`);
          return {
            ...b,
            status: newStatus,
            patient: newStatus === 'OCCUPIED' ? 'Incoming STAT Patient' : null,
            triage: newStatus === 'OCCUPIED' ? 'RED' : null,
          };
        }
        return b;
      })
    );
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.condition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* High-Pressure Emergency Banner Header */}
      <div className="p-4 rounded-xl bg-primary border-2 border-rose-600 text-primary-foreground shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-600/30 border border-rose-500 animate-pulse text-rose-300">
            <Siren className="h-8 w-8 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight uppercase flex items-center gap-2 text-rose-100">
                STAT Emergency Triage View
              </h2>
              <Badge className="bg-rose-600 text-white font-bold border-rose-400 animate-pulse">
                HIGH PRESSURE MODE ACTIVE
              </Badge>
            </div>
            <p className="text-xs text-rose-200/90 mt-0.5">
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
            className="h-9 px-3 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white border border-rose-400 shadow-md gap-1.5 animate-bounce"
          >
            <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
            <span>Broadcast CODE BLUE</span>
          </Button>

          <Button
            size="sm"
            onClick={onOpenLogVitals}
            className="h-9 px-3 text-xs font-bold bg-white text-rose-950 hover:bg-slate-100 shadow-md gap-1.5"
          >
            <Stethoscope className="h-4 w-4 text-rose-600" />
            <span>Log STAT Vitals</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenHandover}
            className="h-9 px-3 text-xs font-bold border-rose-400 text-white hover:bg-rose-900/50 gap-1.5"
          >
            <FileText className="h-4 w-4 text-rose-300" />
            <span>Shift Handover</span>
          </Button>
        </div>
      </div>

      {/* Triage Stats Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-rose-950/20 border-rose-500/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Level-1 Red Cases</p>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {patients.filter((p) => p.triageLevel === 'RED').length} STAT
              </p>
            </div>
            <ShieldAlert className="h-7 w-7 text-rose-500" />
          </CardContent>
        </Card>

        <Card className="bg-amber-950/20 border-amber-500/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Level-2 Amber Cases</p>
              <p className="text-2xl font-black text-amber-500">
                {patients.filter((p) => p.triageLevel === 'AMBER').length} Urgent
              </p>
            </div>
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          </CardContent>
        </Card>

        <Card className="bg-emerald-950/20 border-emerald-500/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Available ER Bays</p>
              <p className="text-2xl font-black text-emerald-500">
                {beds.filter((b) => b.status === 'AVAILABLE').length} / {beds.length}
              </p>
            </div>
            <Bed className="h-7 w-7 text-emerald-500" />
          </CardContent>
        </Card>

        <Card className="bg-sky-950/20 border-sky-500/30">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Trauma Hotline</p>
              <p className="text-sm font-bold text-sky-300 flex items-center gap-1">
                <PhoneCall className="h-3.5 w-3.5" />
                Ext. 911 / 4402
              </p>
            </div>
            <Activity className="h-7 w-7 text-sky-400" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Emergency Patient List */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-rose-500/40 shadow-md">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <Heart className="h-5 w-5 text-rose-500 animate-pulse" />
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
                <div key={p.id} className="p-4 hover:bg-rose-500/5 transition-colors space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`text-xs font-bold ${
                          p.triageLevel === 'RED'
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-amber-500 text-black'
                        }`}
                      >
                        {p.triageLevel} STAT
                      </Badge>
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          {p.name}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({p.age}y, {p.gender})
                          </span>
                        </h4>
                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                          {p.condition}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge variant="outline" className="text-xs font-mono border-rose-500/40">
                        {p.bed}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" /> {p.timeAdmitted}
                      </p>
                    </div>
                  </div>

                  {/* Vitals Quick Gauge Bar */}
                  <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-lg border text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        Blood Pressure
                      </span>
                      <span className="font-mono font-bold text-foreground">{p.bp} mmHg</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        Heart Rate
                      </span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{p.hr} bpm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        SpO2 Saturation
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{p.spo2}%</span>
                    </div>
                  </div>

                  {/* Immediate Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast.success(`Administered STAT IV Therapy order for ${p.name}`);
                      }}
                      className="h-7 text-xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    >
                      STAT Therapy Order
                    </Button>
                    <Button
                      size="sm"
                      onClick={onOpenLogVitals}
                      className="h-7 text-xs bg-rose-600 text-white hover:bg-rose-700"
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
                <Bed className="h-4 w-4 text-emerald-500" />
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
                      {b.patient ? `Patient: ${b.patient}` : 'Ready for admission'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={b.status === 'AVAILABLE' ? 'default' : 'outline'}
                    onClick={() => handleAllocateBed(b.id)}
                    className={`h-7 text-[11px] font-bold ${
                      b.status === 'AVAILABLE'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'border-rose-500/40 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {b.status}
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
