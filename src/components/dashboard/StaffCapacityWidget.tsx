import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  ShieldAlert, 
  Download, 
  TrendingUp, 
  Clock, 
  FileSpreadsheet, 
  Sparkles,
  AlertOctagon,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';
import jsPDF from 'jspdf';

interface DepartmentBreakdown {
  department: string;
  count: number;
  nextSlot: string;
}

interface DailyTrendPoint {
  day: string;
  load: number;
}

interface FuturePredictionPoint {
  day: string;
  date: string;
  predictedLoad: number;
  capacity: number;
  surgeRisk: 'low' | 'moderate' | 'high';
}

export type ShiftType = 'All' | 'Morning' | 'Afternoon' | 'Night';

interface Clinician {
  id: string;
  name: string;
  role: string;
  specialty: string;
  shifts: ('Morning' | 'Afternoon' | 'Night')[];
  load: number;
  maxCapacity: number;
  weeklyAppointments: number;
  weeklyQuota: number;
  status: 'optimal' | 'warning' | 'critical';
  departmentBreakdown: DepartmentBreakdown[];
  historicalTrend: DailyTrendPoint[];
  forecast7Days: FuturePredictionPoint[];
}

const INITIAL_CLINICIANS: Clinician[] = [
  { 
    id: '1', 
    name: 'Dr. Michael Chen', 
    role: 'Senior Physician', 
    specialty: 'Cardiology', 
    shifts: ['Morning', 'Afternoon'],
    load: 10, 
    maxCapacity: 10, 
    weeklyAppointments: 48,
    weeklyQuota: 40,
    status: 'critical',
    departmentBreakdown: [
      { department: 'Cardiology Outpatient', count: 28, nextSlot: 'Today, 2:30 PM' },
      { department: 'Cardiac ICU Consults', count: 12, nextSlot: 'Tomorrow, 9:00 AM' },
      { department: 'Vascular Diagnostics', count: 8, nextSlot: 'Sep 9, 11:15 AM' }
    ],
    historicalTrend: [
      { day: 'Mon', load: 7 },
      { day: 'Tue', load: 8 },
      { day: 'Wed', load: 9 },
      { day: 'Thu', load: 10 },
      { day: 'Fri', load: 10 },
      { day: 'Sat', load: 6 },
      { day: 'Sun', load: 4 },
    ],
    forecast7Days: [
      { day: 'Mon', date: 'Sep 8', predictedLoad: 9, capacity: 10, surgeRisk: 'high' },
      { day: 'Tue', date: 'Sep 9', predictedLoad: 11, capacity: 10, surgeRisk: 'high' },
      { day: 'Wed', date: 'Sep 10', predictedLoad: 10, capacity: 10, surgeRisk: 'high' },
      { day: 'Thu', date: 'Sep 11', predictedLoad: 8, capacity: 10, surgeRisk: 'moderate' },
      { day: 'Fri', date: 'Sep 12', predictedLoad: 9, capacity: 10, surgeRisk: 'high' },
      { day: 'Sat', date: 'Sep 13', predictedLoad: 5, capacity: 10, surgeRisk: 'low' },
      { day: 'Sun', date: 'Sep 14', predictedLoad: 3, capacity: 10, surgeRisk: 'low' }
    ]
  },
  { 
    id: '2', 
    name: 'Dr. Sarah Amankwah', 
    role: 'Lead Resident', 
    specialty: 'General Medicine', 
    shifts: ['Morning', 'Night'],
    load: 8, 
    maxCapacity: 8, 
    weeklyAppointments: 42,
    weeklyQuota: 35,
    status: 'critical',
    departmentBreakdown: [
      { department: 'General Internal Med', count: 25, nextSlot: 'Today, 3:00 PM' },
      { department: 'Acute Assessment Unit', count: 17, nextSlot: 'Tomorrow, 10:30 AM' }
    ],
    historicalTrend: [
      { day: 'Mon', load: 6 },
      { day: 'Tue', load: 7 },
      { day: 'Wed', load: 8 },
      { day: 'Thu', load: 8 },
      { day: 'Fri', load: 8 },
      { day: 'Sat', load: 5 },
      { day: 'Sun', load: 3 },
    ],
    forecast7Days: [
      { day: 'Mon', date: 'Sep 8', predictedLoad: 8, capacity: 8, surgeRisk: 'high' },
      { day: 'Tue', date: 'Sep 9', predictedLoad: 9, capacity: 8, surgeRisk: 'high' },
      { day: 'Wed', date: 'Sep 10', predictedLoad: 8, capacity: 8, surgeRisk: 'high' },
      { day: 'Thu', date: 'Sep 11', predictedLoad: 7, capacity: 8, surgeRisk: 'moderate' },
      { day: 'Fri', date: 'Sep 12', predictedLoad: 8, capacity: 8, surgeRisk: 'high' },
      { day: 'Sat', date: 'Sep 13', predictedLoad: 4, capacity: 8, surgeRisk: 'low' },
      { day: 'Sun', date: 'Sep 14', predictedLoad: 2, capacity: 8, surgeRisk: 'low' }
    ]
  },
  { 
    id: '3', 
    name: 'Dr. David Osei', 
    role: 'Physician Specialist', 
    specialty: 'Pediatrics', 
    shifts: ['Morning', 'Afternoon'],
    load: 4, 
    maxCapacity: 10, 
    weeklyAppointments: 22,
    weeklyQuota: 30,
    status: 'optimal',
    departmentBreakdown: [
      { department: 'Pediatric Clinic A', count: 15, nextSlot: 'Today, 4:00 PM' },
      { department: 'Neonatal Follow-ups', count: 7, nextSlot: 'Sep 9, 9:30 AM' }
    ],
    historicalTrend: [
      { day: 'Mon', load: 3 },
      { day: 'Tue', load: 5 },
      { day: 'Wed', load: 4 },
      { day: 'Thu', load: 4 },
      { day: 'Fri', load: 5 },
      { day: 'Sat', load: 2 },
      { day: 'Sun', load: 1 },
    ],
    forecast7Days: [
      { day: 'Mon', date: 'Sep 8', predictedLoad: 5, capacity: 10, surgeRisk: 'low' },
      { day: 'Tue', date: 'Sep 9', predictedLoad: 6, capacity: 10, surgeRisk: 'low' },
      { day: 'Wed', date: 'Sep 10', predictedLoad: 5, capacity: 10, surgeRisk: 'low' },
      { day: 'Thu', date: 'Sep 11', predictedLoad: 4, capacity: 10, surgeRisk: 'low' },
      { day: 'Fri', date: 'Sep 12', predictedLoad: 5, capacity: 10, surgeRisk: 'low' },
      { day: 'Sat', date: 'Sep 13', predictedLoad: 3, capacity: 10, surgeRisk: 'low' },
      { day: 'Sun', date: 'Sep 14', predictedLoad: 2, capacity: 10, surgeRisk: 'low' }
    ]
  },
  { 
    id: '4', 
    name: 'Dr. Emily Davis', 
    role: 'Consultant', 
    specialty: 'Internal Medicine', 
    shifts: ['Afternoon', 'Night'],
    load: 8, 
    maxCapacity: 10, 
    weeklyAppointments: 34,
    weeklyQuota: 35,
    status: 'warning',
    departmentBreakdown: [
      { department: 'Metabolic Clinic', count: 20, nextSlot: 'Tomorrow, 8:30 AM' },
      { department: 'Diagnostic Review', count: 14, nextSlot: 'Sep 10, 1:00 PM' }
    ],
    historicalTrend: [
      { day: 'Mon', load: 5 },
      { day: 'Tue', load: 6 },
      { day: 'Wed', load: 7 },
      { day: 'Thu', load: 8 },
      { day: 'Fri', load: 8 },
      { day: 'Sat', load: 4 },
      { day: 'Sun', load: 2 },
    ],
    forecast7Days: [
      { day: 'Mon', date: 'Sep 8', predictedLoad: 7, capacity: 10, surgeRisk: 'moderate' },
      { day: 'Tue', date: 'Sep 9', predictedLoad: 8, capacity: 10, surgeRisk: 'moderate' },
      { day: 'Wed', date: 'Sep 10', predictedLoad: 8, capacity: 10, surgeRisk: 'moderate' },
      { day: 'Thu', date: 'Sep 11', predictedLoad: 9, capacity: 10, surgeRisk: 'high' },
      { day: 'Fri', date: 'Sep 12', predictedLoad: 7, capacity: 10, surgeRisk: 'moderate' },
      { day: 'Sat', date: 'Sep 13', predictedLoad: 4, capacity: 10, surgeRisk: 'low' },
      { day: 'Sun', date: 'Sep 14', predictedLoad: 3, capacity: 10, surgeRisk: 'low' }
    ]
  },
  { 
    id: '5', 
    name: 'Dr. Kofi Mensah', 
    role: 'Clinical Officer', 
    specialty: 'Emergency Triage', 
    shifts: ['Morning', 'Afternoon', 'Night'],
    load: 11, 
    maxCapacity: 10, 
    weeklyAppointments: 55,
    weeklyQuota: 45,
    status: 'critical',
    departmentBreakdown: [
      { department: 'Emergency Trauma Bay', count: 35, nextSlot: 'Immediate' },
      { department: 'Urgent Care Walk-in', count: 20, nextSlot: 'Today, 5:00 PM' }
    ],
    historicalTrend: [
      { day: 'Mon', load: 9 },
      { day: 'Tue', load: 10 },
      { day: 'Wed', load: 10 },
      { day: 'Thu', load: 11 },
      { day: 'Fri', load: 11 },
      { day: 'Sat', load: 8 },
      { day: 'Sun', load: 6 },
    ],
    forecast7Days: [
      { day: 'Mon', date: 'Sep 8', predictedLoad: 11, capacity: 10, surgeRisk: 'high' },
      { day: 'Tue', date: 'Sep 9', predictedLoad: 12, capacity: 10, surgeRisk: 'high' },
      { day: 'Wed', date: 'Sep 10', predictedLoad: 11, capacity: 10, surgeRisk: 'high' },
      { day: 'Thu', date: 'Sep 11', predictedLoad: 10, capacity: 10, surgeRisk: 'high' },
      { day: 'Fri', date: 'Sep 12', predictedLoad: 11, capacity: 10, surgeRisk: 'high' },
      { day: 'Sat', date: 'Sep 13', predictedLoad: 7, capacity: 10, surgeRisk: 'moderate' },
      { day: 'Sun', date: 'Sep 14', predictedLoad: 5, capacity: 10, surgeRisk: 'low' }
    ]
  },
  { 
    id: '6', 
    name: 'Dr. Abena Boateng', 
    role: 'Family Practitioner', 
    specialty: 'Obstetrics/Gynecology', 
    shifts: ['Morning'],
    load: 3, 
    maxCapacity: 8, 
    weeklyAppointments: 18,
    weeklyQuota: 30,
    status: 'optimal',
    departmentBreakdown: [
      { department: 'Antenatal Care', count: 12, nextSlot: 'Sep 9, 10:00 AM' },
      { department: 'Gynecology Outpatient', count: 6, nextSlot: 'Sep 11, 2:00 PM' }
    ],
    historicalTrend: [
      { day: 'Mon', load: 4 },
      { day: 'Tue', load: 3 },
      { day: 'Wed', load: 3 },
      { day: 'Thu', load: 3 },
      { day: 'Fri', load: 4 },
      { day: 'Sat', load: 1 },
      { day: 'Sun', load: 0 },
    ],
    forecast7Days: [
      { day: 'Mon', date: 'Sep 8', predictedLoad: 4, capacity: 8, surgeRisk: 'low' },
      { day: 'Tue', date: 'Sep 9', predictedLoad: 4, capacity: 8, surgeRisk: 'low' },
      { day: 'Wed', date: 'Sep 10', predictedLoad: 3, capacity: 8, surgeRisk: 'low' },
      { day: 'Thu', date: 'Sep 11', predictedLoad: 3, capacity: 8, surgeRisk: 'low' },
      { day: 'Fri', date: 'Sep 12', predictedLoad: 4, capacity: 8, surgeRisk: 'low' },
      { day: 'Sat', date: 'Sep 13', predictedLoad: 2, capacity: 8, surgeRisk: 'low' },
      { day: 'Sun', date: 'Sep 14', predictedLoad: 1, capacity: 8, surgeRisk: 'low' }
    ]
  },
];

export default function StaffCapacityWidget() {
  const [clinicians, setClinicians] = useState<Clinician[]>(INITIAL_CLINICIANS);
  const [selectedShift, setSelectedShift] = useState<ShiftType>('All');
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [expandedClinicianIds, setExpandedClinicianIds] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'live' | 'forecast'>('live');

  const toggleExpand = (id: string) => {
    setExpandedClinicianIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filter clinicians based on selected shift
  const filteredClinicians = clinicians.filter(c => {
    if (selectedShift === 'All') return true;
    return c.shifts.includes(selectedShift);
  });

  const totalLoad = filteredClinicians.reduce((acc, c) => acc + c.load, 0);
  const totalCapacity = filteredClinicians.reduce((acc, c) => acc + c.maxCapacity, 0);
  const overallPercentage = totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0;

  // Clinicians exceeding daily threshold (load >= maxCapacity)
  const exceededDailyThresholdCount = filteredClinicians.filter(c => c.load >= c.maxCapacity).length;
  // Clinicians exceeding weekly quota
  const quotaExceededCount = filteredClinicians.filter(c => c.weeklyAppointments > c.weeklyQuota).length;

  const handleRebalance = () => {
    setIsRebalancing(true);
    setTimeout(() => {
      setClinicians(prev => {
        return prev.map(c => {
          if (c.load >= c.maxCapacity) {
            const newLoad = Math.max(1, c.load - 2);
            const newWeekly = Math.max(c.weeklyQuota - 2, c.weeklyAppointments - 5);
            return {
              ...c,
              load: newLoad,
              weeklyAppointments: newWeekly,
              status: newLoad >= c.maxCapacity ? 'critical' : (newLoad / c.maxCapacity >= 0.8 ? 'warning' : 'optimal')
            };
          }
          if (c.status === 'optimal' && c.load < c.maxCapacity - 1) {
            const newLoad = c.load + 1;
            const newWeekly = c.weeklyAppointments + 3;
            return {
              ...c,
              load: newLoad,
              weeklyAppointments: newWeekly,
              status: newLoad / c.maxCapacity >= 0.8 ? 'warning' : 'optimal'
            };
          }
          return c;
        });
      });
      setIsRebalancing(false);
      toast.success('Successfully rebalanced triage queues and workload allocations.');
    }, 1200);
  };

  // Export CSV Report
  const handleExportCSV = () => {
    const headers = ['Clinician Name', 'Role', 'Specialty', 'Shifts', 'Daily Load', 'Max Capacity', 'Daily Saturation %', 'Weekly Appointments', 'Weekly Quota', 'Daily Threshold Exceeded', 'Weekly Quota Exceeded'];
    const rows = filteredClinicians.map(c => [
      `"${c.name}"`,
      `"${c.role}"`,
      `"${c.specialty}"`,
      `"${c.shifts.join(', ')}"`,
      c.load,
      c.maxCapacity,
      `${Math.round((c.load / c.maxCapacity) * 100)}%`,
      c.weeklyAppointments,
      c.weeklyQuota,
      c.load >= c.maxCapacity ? 'YES' : 'NO',
      c.weeklyAppointments > c.weeklyQuota ? 'YES' : 'NO'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Staff_Utilization_Report_${selectedShift}_Shift_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Staff Utilization CSV report generated successfully!');
  };

  // Export PDF Report
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Smart Health Manager - Staff Utilization Report', 14, 20);
      doc.setFontSize(10);
      doc.text(`Shift: ${selectedShift} | Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Total Active Shift Load: ${totalLoad}/${totalCapacity} slots (${overallPercentage}% saturation)`, 14, 34);

      let startY = 44;
      doc.setFontSize(11);
      doc.text('Clinician Capacity Summary:', 14, startY);
      startY += 8;

      doc.setFontSize(9);
      filteredClinicians.forEach((c, idx) => {
        const line = `${idx + 1}. ${c.name} (${c.specialty}) - Shift: ${c.shifts.join('/')} | Load: ${c.load}/${c.maxCapacity} (${Math.round((c.load/c.maxCapacity)*100)}%) | Wkly: ${c.weeklyAppointments}/${c.weeklyQuota}`;
        doc.text(line, 14, startY);
        startY += 6;
        if (startY > 280) {
          doc.addPage();
          startY = 20;
        }
      });

      doc.save(`Staff_Utilization_Report_${selectedShift}_Shift.pdf`);
      toast.success('Staff Utilization PDF report downloaded!');
    } catch (e) {
      toast.error('Failed to generate PDF. Downloading CSV report instead.');
      handleExportCSV();
    }
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-accent" />
              Staff Capacity & Load Balancer
            </CardTitle>
            <CardDescription>
              Real-time clinician saturation, 7-day predictive workload forecast, and shift filtering
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {exceededDailyThresholdCount > 0 && (
              <Badge variant="destructive" className="gap-1 animate-pulse shadow-sm">
                <AlertOctagon className="h-3 w-3" />
                {exceededDailyThresholdCount} Threshold Exceeded
              </Badge>
            )}
            {quotaExceededCount > 0 && (
              <Badge variant="destructive" className="gap-1 bg-amber-600 dark:bg-amber-700 text-white shadow-sm">
                <ShieldAlert className="h-3 w-3" />
                {quotaExceededCount} Over Quota
              </Badge>
            )}
            
            {/* Export Actions */}
            <div className="flex items-center gap-1.5 ml-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs gap-1"
                onClick={handleExportCSV}
                title="Download CSV Report"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export CSV</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs gap-1"
                onClick={handleExportPDF}
                title="Download PDF Summary"
              >
                <Download className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span>PDF</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Controls Bar: Shift Filters & View Mode Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
          {/* Shift Filter Buttons */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/80 overflow-x-auto text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground px-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Shift:
            </span>
            {(['All', 'Morning', 'Afternoon', 'Night'] as ShiftType[]).map(shift => (
              <button
                key={shift}
                onClick={() => setSelectedShift(shift)}
                className={`px-2.5 py-1 rounded-md transition-all font-medium whitespace-nowrap ${
                  selectedShift === shift
                    ? 'bg-background text-foreground font-bold shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {shift === 'All' ? 'All Shifts' : `${shift}`}
              </button>
            ))}
          </div>

          {/* View Mode Tabs (Live vs 7-Day Forecast) */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/80 text-xs shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                activeTab === 'live'
                  ? 'bg-background text-foreground font-bold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-accent" />
              <span>Live Capacity</span>
            </button>
            <button
              onClick={() => setActiveTab('forecast')}
              className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                activeTab === 'forecast'
                  ? 'bg-background text-foreground font-bold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
              <span>7-Day AI Forecast</span>
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Indicator & Rebalance */}
        <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-2">
              <span>Overall {selectedShift === 'All' ? 'Clinic' : `${selectedShift} Shift`} Saturation</span>
              <Badge variant="outline" className="text-[10px] py-0 font-normal">
                {filteredClinicians.length} Clinicians
              </Badge>
            </div>
            <div className="text-xl font-extrabold flex items-center gap-2 text-foreground">
              {overallPercentage}% Capacity
              <span className="text-sm font-normal text-muted-foreground">({totalLoad}/{totalCapacity} active slots)</span>
            </div>
          </div>
          
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
            onClick={handleRebalance}
            disabled={isRebalancing || (exceededDailyThresholdCount === 0 && quotaExceededCount === 0)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRebalancing ? 'animate-spin' : ''}`} />
            <span>Rebalance Queues</span>
          </Button>
        </div>

        {/* TAB 1: LIVE CAPACITY VIEW */}
        {activeTab === 'live' && (
          <div className="space-y-3">
            {filteredClinicians.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs rounded-xl border border-dashed border-border">
                No clinicians scheduled for the {selectedShift} shift.
              </div>
            ) : (
              filteredClinicians.map((clinician) => {
                const isExceededThreshold = clinician.load >= clinician.maxCapacity;
                const isOverQuota = clinician.weeklyAppointments > clinician.weeklyQuota;
                const percentage = Math.round((clinician.load / clinician.maxCapacity) * 100);
                const isExpanded = !!expandedClinicianIds[clinician.id];
                
                let statusColor = "bg-emerald-500";
                let textColor = "text-emerald-500 bg-emerald-500/10";
                let cardBorder = "border-border";
                let statusLabel = "Optimal";

                if (percentage >= 100) {
                  statusColor = "bg-rose-500";
                  textColor = "text-rose-500 bg-rose-500/10 font-bold";
                  cardBorder = "border-rose-300 dark:border-rose-900/80 bg-rose-500/[0.03] shadow-xs";
                  statusLabel = "CRITICAL / OVER THRESHOLD";
                } else if (percentage >= 80) {
                  statusColor = "bg-amber-500";
                  textColor = "text-amber-500 bg-amber-500/10 font-semibold";
                  cardBorder = "border-amber-300 dark:border-amber-950";
                  statusLabel = "Nearing Limit";
                }

                return (
                  <div 
                    key={clinician.id} 
                    className={`p-3.5 rounded-xl border transition-all duration-200 ${cardBorder} flex flex-col space-y-2.5 relative overflow-hidden`}
                  >
                    {/* Visual Alert Pulse Line for Threshold Exceeded */}
                    {isExceededThreshold && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500 animate-pulse" />
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="cursor-pointer select-none flex-1" onClick={() => toggleExpand(clinician.id)}>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Pulsing Visual Status Alert Icon */}
                          {isExceededThreshold ? (
                            <div className="relative flex items-center justify-center shrink-0">
                              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-rose-400 opacity-75" />
                              <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400 relative z-10" />
                            </div>
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          )}

                          <h5 className="font-bold text-sm text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                            {clinician.name}
                          </h5>

                          {/* Shift Badges */}
                          <div className="flex gap-1">
                            {clinician.shifts.map(s => (
                              <span key={s} className="text-[10px] px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground font-mono">
                                {s}
                              </span>
                            ))}
                          </div>

                          {/* Visual Alert Badge for Exceeded Threshold */}
                          {isExceededThreshold && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white shadow-xs animate-bounce">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              DAILY THRESHOLD EXCEEDED ({clinician.load}/{clinician.maxCapacity})
                            </span>
                          )}

                          {isOverQuota && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-900">
                              <ShieldAlert className="h-2.5 w-2.5" />
                              QUOTA OVERFLOW
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-1">
                          {clinician.role} • <span className="font-medium text-slate-700 dark:text-slate-300">{clinician.specialty}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-extrabold shrink-0 ${textColor}`}>
                          {statusLabel}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => toggleExpand(clinician.id)}
                          title="Toggle details & trend line"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar & Numerical Metrics */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">
                          Patient Load: <span className={`font-mono font-bold ${isExceededThreshold ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-slate-800 dark:text-slate-200'}`}>{clinician.load} / {clinician.maxCapacity}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Weekly Appointments: <span className={`font-mono font-bold ${isOverQuota ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>{clinician.weeklyAppointments} / {clinician.weeklyQuota} quota</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${statusColor}`} 
                          style={{ width: `${Math.min(100, percentage)}%` }} 
                        />
                      </div>
                    </div>

                    {/* Expanded View: Recharts Trend Line + Department Breakdown */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/60 bg-muted/30 rounded-lg p-3 space-y-4 animate-in fade-in-50 duration-200">
                        {/* 1. Recharts Trend Line Chart */}
                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-accent" />
                              Daily Load Fluctuation (Past 7 Days)
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              Max Capacity Line: {clinician.maxCapacity}
                            </span>
                          </div>

                          <div className="h-28 w-full bg-card rounded-lg border border-border p-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={clinician.historicalTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#888888" />
                                <YAxis domain={[0, Math.max(clinician.maxCapacity + 2, 12)]} tick={{ fontSize: 10 }} stroke="#888888" />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', fontSize: '11px', borderRadius: '6px' }}
                                  formatter={(val) => [`${val} patients`, 'Daily Load']}
                                />
                                <ReferenceLine y={clinician.maxCapacity} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Capacity Limit', fill: '#ef4444', fontSize: 9, position: 'top' }} />
                                <Line 
                                  type="monotone" 
                                  dataKey="load" 
                                  stroke="#3b82f6" 
                                  strokeWidth={2.5} 
                                  dot={{ r: 3, fill: '#3b82f6' }} 
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* 2. Department Breakdown */}
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-accent" />
                            Upcoming Appointments Breakdown by Department
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {clinician.departmentBreakdown.map((dept, idx) => (
                              <div key={idx} className="bg-card p-2.5 rounded-lg border border-border flex items-center justify-between text-xs">
                                <div>
                                  <div className="font-semibold text-foreground">{dept.department}</div>
                                  <div className="text-[11px] text-muted-foreground">Next: {dept.nextSlot}</div>
                                </div>
                                <Badge variant="outline" className="font-mono text-xs font-bold">
                                  {dept.count} pts
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: 7-DAY AI FORECAST VIEW */}
        {activeTab === 'forecast' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs space-y-1">
              <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                AI Workload Prediction Engine (Next 7 Days)
              </div>
              <p className="text-muted-foreground">
                Workload predictions calculated using historical patient surge patterns, seasonal triage volume, and scheduled appointment bookings for the upcoming week.
              </p>
            </div>

            <div className="space-y-3">
              {filteredClinicians.map((clinician) => {
                const highSurgeDays = clinician.forecast7Days.filter(f => f.surgeRisk === 'high').length;
                const peakDay = [...clinician.forecast7Days].sort((a, b) => b.predictedLoad - a.predictedLoad)[0];

                return (
                  <div key={clinician.id} className="p-3.5 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="font-bold text-sm text-foreground flex items-center gap-2">
                          {clinician.name}
                          <span className="text-xs font-normal text-muted-foreground">({clinician.specialty})</span>
                        </h5>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Peak Predicted Load: <span className="font-mono font-bold text-foreground">{peakDay.predictedLoad} pts</span> on {peakDay.day} ({peakDay.date})
                        </p>
                      </div>

                      {highSurgeDays > 0 && (
                        <Badge variant="outline" className="text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900 bg-rose-500/10 text-[10px] font-bold">
                          {highSurgeDays} High Surge Days Projected
                        </Badge>
                      )}
                    </div>

                    {/* 7-Day Grid Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                      {clinician.forecast7Days.map((point, idx) => {
                        const isOver = point.predictedLoad >= point.capacity;
                        let badgeColor = 'border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 dark:text-emerald-300';
                        if (point.surgeRisk === 'high') {
                          badgeColor = 'border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300 font-bold';
                        } else if (point.surgeRisk === 'moderate') {
                          badgeColor = 'border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300';
                        }

                        return (
                          <div key={idx} className={`p-2 rounded-lg border text-center text-xs space-y-1 ${badgeColor}`}>
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                              {point.day} ({point.date.split(' ')[1]})
                            </div>
                            <div className="text-sm font-extrabold font-mono">
                              {point.predictedLoad} <span className="text-[10px] font-normal text-muted-foreground">/ {point.capacity}</span>
                            </div>
                            {isOver && (
                              <div className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-tighter">
                                OVER CAPACITY
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
