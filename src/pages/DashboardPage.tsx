import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calendar, 
  Hospital, 
  DollarSign, 
  TrendingUp, 
  Activity, 
  Heart, 
  ArrowRight, 
  ShieldCheck,
  GripVertical,
  MoveUp,
  MoveDown,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Settings2,
  Save,
  RotateCcw,
  Sparkles,
  Siren,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { api } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import RecentActivityWidget from '@/components/dashboard/RecentActivityWidget';
import UpcomingAppointmentsAlertWidget from '@/components/dashboard/UpcomingAppointmentsAlertWidget';
import CriticalVitalsAlertWidget from '@/components/dashboard/CriticalVitalsAlertWidget';
import AppointmentDensityHeatMap from '@/components/dashboard/AppointmentDensityHeatMap';
import StaffCapacityWidget from '@/components/dashboard/StaffCapacityWidget';
import { WaitTimeMonitorWidget } from '@/components/dashboard/WaitTimeMonitorWidget';
import { D3PatientVitalsTrendChart } from '@/components/dashboard/D3PatientVitalsTrendChart';
import { AuditLogOperationsChart } from '@/components/dashboard/AuditLogOperationsChart';
import { Patient7DayVitalsTrendWidget } from '@/components/dashboard/Patient7DayVitalsTrendWidget';
import { EmergencyModeModule } from '@/components/emergency/EmergencyModeModule';
import { ShiftHandoverModal } from '@/components/handover/ShiftHandoverModal';
import { LogVitalsDialog } from '@/components/vitals/LogVitalsDialog';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

const chartConfig = {
  patients: { label: 'Patients', color: '#00BFFF' },
  appointments: { label: 'Appointments', color: '#00BFFF' },
};

interface PatientLoadPrediction {
  day: string;
  predictedLoad: number;
}

interface PatientLoadPredictionsResponse {
  predictions: PatientLoadPrediction[];
}

interface DashboardModule {
  id: string;
  title: string;
  gridClass: string; // col-span-1 or col-span-2
  visible: boolean;
}

const DEFAULT_MODULES: DashboardModule[] = [
  { id: 'd3VitalsTrend', title: 'D3.js Patient Health Vitals Trend Analytics', gridClass: 'col-span-2', visible: true },
  { id: 'vitals7Day', title: '7-Day Patient Heart Rate & Blood Pressure Trends', gridClass: 'col-span-2', visible: true },
  { id: 'auditChart', title: 'Critical System Operations & Audit Log Frequency', gridClass: 'col-span-2', visible: true },
  { id: 'waitTime', title: 'Real-Time Department Wait Time Monitor', gridClass: 'col-span-2', visible: true },
  { id: 'appointments', title: 'Upcoming Appointments & Alerts', gridClass: 'col-span-2', visible: true },
  { id: 'vitals', title: 'Critical Patient Vitals Alerts', gridClass: 'col-span-2', visible: true },
  { id: 'staffCapacity', title: 'Staff Capacity & Load Balancer', gridClass: 'col-span-2', visible: true },
  { id: 'aiInsights', title: 'Clinical AI Insights Hub', gridClass: 'col-span-2', visible: true },
  { id: 'vitalsBanner', title: 'Quick Patient Vitals Access Banner', gridClass: 'col-span-2', visible: true },
  { id: 'heatmap', title: 'Clinic Activity Heat Map', gridClass: 'col-span-2', visible: true },
  { id: 'analytics', title: 'Patient Load Predictions & National Health Alerts', gridClass: 'col-span-2', visible: true },
  { id: 'growth', title: 'Patient Growth & Weekly Appointments Visualizers', gridClass: 'col-span-2', visible: true },
  { id: 'recent', title: 'Recent Activity Feed', gridClass: 'col-span-2', visible: true }
];

function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    if (!value || value <= 0) {
      setDisplayValue(0);
      return;
    }

    let startTime: number | null = null;
    const duration = 1200; // 1.2s count animation

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Smooth cubic ease-out
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(easeProgress * value));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    const animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [value]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [patientGrowth, setPatientGrowth] = useState<any[]>([]);
  const [weeklyAppointments, setWeeklyAppointments] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [patientLoadPredictions, setPatientLoadPredictions] = useState<any[]>([]);
  const [ghanaHealthData, setGhanaHealthData] = useState<any[]>([]);

  // Layout customization state
  const [modules, setModules] = useState<DashboardModule[]>(() => {
    const saved = localStorage.getItem('dashboard_layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const parsedIds = parsed.map((m: any) => m.id);
        const missing = DEFAULT_MODULES.filter(m => !parsedIds.includes(m.id));
        return [...parsed, ...missing];
      } catch {
        return DEFAULT_MODULES;
      }
    }
    return DEFAULT_MODULES;
  });
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Emergency Mode & Handover state
  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(() => {
    return localStorage.getItem('emergency_mode_active') === 'true';
  });
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isLogVitalsOpen, setIsLogVitalsOpen] = useState(false);

  const toggleEmergencyMode = (checked: boolean) => {
    setIsEmergencyMode(checked);
    localStorage.setItem('emergency_mode_active', String(checked));
  };

  // Manual layout reordering and resizing methods
  const handleMove = (id: string, direction: 'up' | 'down') => {
    const index = modules.findIndex(m => m.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const newModules = [...modules];
    const temp = newModules[index];
    newModules[index] = newModules[targetIndex];
    newModules[targetIndex] = temp;
    setModules(newModules);
  };

  const handleResize = (id: string) => {
    setModules(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          gridClass: m.gridClass === 'col-span-2' ? 'col-span-1' : 'col-span-2'
        };
      }
      return m;
    }));
  };

  const handleToggleVisibility = (id: string) => {
    setModules(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, visible: !m.visible };
      }
      return m;
    }));
  };

  const handleSaveLayout = () => {
    localStorage.setItem('dashboard_layout', JSON.stringify(modules));
    setIsCustomizing(false);
  };

  const handleResetLayout = () => {
    setModules(DEFAULT_MODULES);
    localStorage.removeItem('dashboard_layout');
    setIsCustomizing(false);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const draggedIndex = modules.findIndex(m => m.id === draggedId);
    const targetIndex = modules.findIndex(m => m.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newModules = [...modules];
    const [draggedItem] = newModules.splice(draggedIndex, 1);
    newModules.splice(targetIndex, 0, draggedItem);

    setModules(newModules);
    setDraggedId(null);
  };

  useEffect(() => {
    loadDashboardData();
    const intervalSetting = localStorage.getItem('dashboard_refresh_interval');
    const intervalSeconds = intervalSetting ? parseInt(intervalSetting, 10) : 30;
    if (intervalSeconds > 0) {
      const timer = setInterval(() => {
        loadDashboardData();
      }, intervalSeconds * 1000);
      return () => clearInterval(timer);
    }
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats() as any;
      setStats(data.stats);
      setPatientGrowth(data.patientGrowth || []);
      setWeeklyAppointments(data.weeklyAppointments || []);
      setRecentActivities(data.recentActivities || []);

      // Fetch patient load predictions
      const predictions = await api.getPatientLoadPredictions() as PatientLoadPredictionsResponse;
      setPatientLoadPredictions(predictions.predictions || []);

      // Fetch Ghana Health Service data
      const ghanaData = await api.getGhanaHealthData();
      setGhanaHealthData(ghanaData || []);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Use fallback data
      const predictions: PatientLoadPredictionsResponse = {
        predictions: [
          { day: 'Monday', predictedLoad: 40 },
          { day: 'Tuesday', predictedLoad: 45 },
          { day: 'Wednesday', predictedLoad: 50 },
          { day: 'Thursday', predictedLoad: 48 },
          { day: 'Friday', predictedLoad: 55 },
          { day: 'Saturday', predictedLoad: 30 },
          { day: 'Sunday', predictedLoad: 25 },
        ],
      };
      setStats({
        totalPatients: 2543,
        todayAppointments: 48,
        activeHospitals: 12,
        monthlyRevenue: 45231
      });
      setPatientGrowth([
        { month: 'Jan', patients: 400 },
        { month: 'Feb', patients: 450 },
        { month: 'Mar', patients: 520 },
        { month: 'Apr', patients: 480 },
        { month: 'May', patients: 600 },
        { month: 'Jun', patients: 650 },
      ]);
      setWeeklyAppointments([
        { day: 'Mon', appointments: 45 },
        { day: 'Tue', appointments: 52 },
        { day: 'Wed', appointments: 48 },
        { day: 'Thu', appointments: 61 },
        { day: 'Fri', appointments: 55 },
        { day: 'Sat', appointments: 38 },
        { day: 'Sun', appointments: 25 },
      ]);
      setRecentActivities([
        { action: 'New patient registered', name: 'Sarah Johnson', time: '5 minutes ago' },
        { action: 'Appointment scheduled', name: 'Dr. Michael Chen', time: '15 minutes ago' },
        { action: 'Lab report uploaded', name: 'Patient #2543', time: '1 hour ago' },
        { action: 'Prescription issued', name: 'Dr. Emily Davis', time: '2 hours ago' },
      ]);
      setPatientLoadPredictions(predictions.predictions);
      setGhanaHealthData([]);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = stats ? [
    { title: 'Total Patients', rawValue: stats.totalPatients, prefix: '', suffix: '', change: '+12%', icon: Users, color: 'text-blue-500' },
    { title: 'Appointments Today', rawValue: stats.todayAppointments, prefix: '', suffix: '', change: '+5%', icon: Calendar, color: 'text-green-500' },
    { title: 'Active Hospitals', rawValue: stats.activeHospitals, prefix: '', suffix: '', change: '+2', icon: Hospital, color: 'text-purple-500' },
    { title: 'Monthly Revenue', rawValue: stats.monthlyRevenue, prefix: 'GHS ', suffix: '', change: '+18%', icon: DollarSign, color: 'text-yellow-500' },
  ] : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/20 border border-border/60 p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            {isEmergencyMode && (
              <Badge className="bg-rose-600 text-white font-bold animate-pulse gap-1">
                <Siren className="h-3.5 w-3.5" /> Emergency Mode
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">Welcome back! Here's what's happening today.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Emergency Mode Toggle Control */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
            isEmergencyMode 
              ? 'bg-rose-600/10 border-rose-500 text-rose-600 dark:text-rose-400 font-bold animate-pulse' 
              : 'bg-card border-border text-muted-foreground'
          }`}>
            <Siren className={`h-4 w-4 ${isEmergencyMode ? 'text-rose-600 animate-spin' : 'text-muted-foreground'}`} />
            <span className="text-xs font-semibold">Emergency Mode</span>
            <Switch
              checked={isEmergencyMode}
              onCheckedChange={toggleEmergencyMode}
            />
          </div>

          {/* Shift Handover Report Action */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-semibold h-9 gap-1.5 border-accent text-accent hover:bg-accent/10"
            onClick={() => setIsHandoverModalOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Shift Handover</span>
          </Button>

          {isCustomizing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold h-9 gap-1.5 border-dashed border-red-500/50 text-red-600 hover:bg-red-50"
                onClick={handleResetLayout}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Layout</span>
              </Button>
              <Button
                size="sm"
                className="text-xs font-semibold h-9 gap-1.5"
                onClick={handleSaveLayout}
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Workspace</span>
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold h-9 gap-1.5"
              onClick={() => setIsCustomizing(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Customize Workspace</span>
            </Button>
          )}
        </div>
      </div>

      {isCustomizing && (
        <div className="p-3 bg-accent/10 border border-accent/30 text-accent-foreground text-xs rounded-xl flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent shrink-0" />
          <span>
            <strong>Workspace Customization Mode:</strong> Drag modules by their handle to reorder, or use action controls to hide/show and resize (Half-width vs Full-width) key dashboard modules.
          </span>
        </div>
      )}

      {isEmergencyMode && (
        <EmergencyModeModule
          onOpenLogVitals={() => setIsLogVitalsOpen(true)}
          onOpenHandover={() => setIsHandoverModalOpen(true)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                <AnimatedCounter value={stat.rawValue} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {modules.map((module) => {
          if (!module.visible && !isCustomizing) return null;

          let component = null;

          switch (module.id) {
            case 'd3VitalsTrend':
              component = <D3PatientVitalsTrendChart />;
              break;
            case 'vitals7Day':
              component = <Patient7DayVitalsTrendWidget />;
              break;
            case 'auditChart':
              component = <AuditLogOperationsChart />;
              break;
            case 'waitTime':
              component = <WaitTimeMonitorWidget />;
              break;
            case 'appointments':
              component = <UpcomingAppointmentsAlertWidget />;
              break;
            case 'vitals':
              component = <CriticalVitalsAlertWidget />;
              break;
            case 'staffCapacity':
              component = <StaffCapacityWidget />;
              break;
            case 'vitalsBanner':
              component = (
                <Card className="border border-border bg-card">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                        <Heart className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          Patient Vitals & Biometric Trend Monitoring
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Log blood pressure, heart rate, and temperature readings or review longitudinal chart analytics.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1.5 shrink-0"
                      onClick={() => navigate('/patients?tab=vitals')}
                    >
                      <span>Open Patient Vitals</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
              break;
            case 'heatmap':
              component = <AppointmentDensityHeatMap />;
              break;
            case 'aiInsights':
              component = (
                <Card className="border border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Clinical AI Insights Hub
                      </CardTitle>
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200">ACTIVE COGNITION</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {}}
                        className="text-xs h-7"
                      >
                        Vitals Analysis
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {}}
                        className="text-xs h-7"
                      >
                        Medication Alerts
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {}}
                        className="text-xs h-7"
                      >
                        Follow-up Tests
                      </Button>
                    </div>

                    <div className="text-xs space-y-3 leading-relaxed text-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                      <p>
                        <strong className="text-amber-950 font-bold">Patient #1024 (Sarah Johnson):</strong> Mild systolic blood pressure increase. Consider scheduling a lipid profile update and recommending reduced sodium intake.
                      </p>
                      <p>
                        <strong className="text-amber-950 font-bold">Patient #2543 (Ebenezer Mensah):</strong> Oxygen levels occasionally dip during physical syncs (94% spO2). Suggest ambulatory pulse oximetry monitoring for a 24-hour cycle.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
              break;
            case 'analytics':
              component = (
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-accent" />
                        Patient Load Predictions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {patientLoadPredictions.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={patientLoadPredictions} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" opacity={0.5} />
                              <XAxis dataKey="day" stroke="#8892b0" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke="#8892b0" fontSize={12} tickLine={false} axisLine={false} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar dataKey="predictedLoad" fill="#00BFFF" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                          No prediction data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Hospital className="h-5 w-5 text-accent" />
                        Ghana Health Service Alerts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {ghanaHealthData.length > 0 ? (
                        <ul className="space-y-3">
                          {ghanaHealthData.map((item, index) => (
                            <li key={index} className="p-3 rounded-md bg-muted/40 border border-border/50 flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm text-foreground">{item.title || 'Health Alert'}</span>
                                <Badge variant="outline" className="text-[10px] uppercase">{item.region || 'National'}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">{item.description || JSON.stringify(item)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[200px] text-center p-4 bg-muted/20 rounded-md border border-dashed border-border">
                          <ShieldCheck className="h-8 w-8 text-emerald-500 mb-2 opacity-80" />
                          <span className="text-sm font-medium text-foreground">No Active Health Advisories</span>
                          <span className="text-xs text-muted-foreground mt-1">National health parameters are currently stable.</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
              break;
            case 'growth':
              component = (
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-accent" />
                        Patient Growth
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={patientGrowth}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                            <XAxis dataKey="month" stroke="#8892b0" />
                            <YAxis stroke="#8892b0" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line
                              type="monotone"
                              dataKey="patients"
                              stroke="#00BFFF"
                              strokeWidth={2}
                              dot={{ fill: '#00BFFF' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-accent" />
                        Weekly Appointments
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyAppointments}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                            <XAxis dataKey="day" stroke="#8892b0" />
                            <YAxis stroke="#8892b0" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="appointments" fill="#00BFFF" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              );
              break;
            case 'recent':
              component = <RecentActivityWidget initialActivities={recentActivities} />;
              break;
            default:
              break;
          }

          const colSpanClass = module.gridClass === 'col-span-1' ? 'col-span-1' : 'lg:col-span-2';

          return (
            <div
              key={module.id}
              className={`relative group/module transition-all duration-300 ${colSpanClass} ${
                isCustomizing ? 'border-2 border-dashed border-accent/40 rounded-xl p-3 bg-accent/5 shadow-inner' : ''
              } ${!module.visible ? 'opacity-40 filter grayscale' : ''}`}
              draggable={isCustomizing}
              onDragStart={(e) => handleDragStart(e, module.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, module.id)}
            >
              {isCustomizing && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-background border border-border px-2 py-1 rounded-lg shadow-md">
                  <div className="flex items-center gap-1 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground mr-1">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Drag</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleMove(module.id, 'up')}
                    title="Move Up"
                  >
                    <MoveUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleMove(module.id, 'down')}
                    title="Move Down"
                  >
                    <MoveDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleResize(module.id)}
                    title={module.gridClass === 'col-span-2' ? 'Make Half Width' : 'Make Full Width'}
                  >
                    {module.gridClass === 'col-span-2' ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleToggleVisibility(module.id)}
                    title={module.visible ? 'Hide Module' : 'Show Module'}
                  >
                    {module.visible ? (
                      <Eye className="h-3.5 w-3.5 text-accent" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              )}
              <ErrorBoundary fallbackTitle={`Error loading module: ${module.title}`}>
                {component}
              </ErrorBoundary>
            </div>
          );
        })}
      </div>

      <ShiftHandoverModal
        open={isHandoverModalOpen}
        onOpenChange={setIsHandoverModalOpen}
      />

      <LogVitalsDialog
        open={isLogVitalsOpen}
        onOpenChange={setIsLogVitalsOpen}
        patientId="P-1002"
        patientName="Sarah Connor"
        patientsList={[
          { id: 'P-1002', name: 'Sarah Connor' },
          { id: 'P-1005', name: 'Kwame Mensah' },
          { id: 'P-1009', name: 'Amina Yeboah' },
        ]}
      />
    </div>
  );
}