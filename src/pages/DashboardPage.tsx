import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Hospital, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { api } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [patientGrowth, setPatientGrowth] = useState<any[]>([]);
  const [weeklyAppointments, setWeeklyAppointments] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [patientLoadPredictions, setPatientLoadPredictions] = useState<any[]>([]);
  const [ghanaHealthData, setGhanaHealthData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
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
      setGhanaHealthData((ghanaData as any)?.ghanaHealthData || []);

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
    { title: 'Total Patients', value: stats.totalPatients.toLocaleString(), change: '+12%', icon: Users, color: 'text-blue-500' },
    { title: 'Appointments Today', value: stats.todayAppointments.toString(), change: '+5%', icon: Calendar, color: 'text-green-500' },
    { title: 'Active Hospitals', value: stats.activeHospitals.toString(), change: '+2', icon: Hospital, color: 'text-purple-500' },
    { title: 'Monthly Revenue', value: `GHS ${stats.monthlyRevenue.toLocaleString()}`, change: '+18%', icon: DollarSign, color: 'text-yellow-500' },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        </div>
      </div>

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
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Patient Load Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {patientLoadPredictions.map((prediction) => (
                <li key={prediction.day}>
                  {prediction.day}: {prediction.predictedLoad}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ghana Health Service Data</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {ghanaHealthData.map((item, index) => (
                <li key={index}>
                  {JSON.stringify(item)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.name}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {typeof activity.time === 'string' ? activity.time : new Date(activity.time).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}