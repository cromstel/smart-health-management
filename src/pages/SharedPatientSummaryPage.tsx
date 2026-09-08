import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { vitalsService } from '@/services/vitalsService';
import type { VitalsRecord } from '@/types/vitals';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Activity,
  Heart,
  Thermometer,
  Gauge,
  Calendar,
  Lock,
  Clock,
  ShieldAlert,
  Printer,
} from 'lucide-react';

interface SharedSummaryData {
  patientId: string;
  patientName: string;
  expiresAt: string;
  appointments: Array<{
    id: string;
    appointment_id: string;
    appointment_date: string;
    appointment_time: string;
    doctor_name: string;
    department: string;
    type: string;
    status: string;
    notes?: string;
  }>;
}

export default function SharedPatientSummaryPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedData, setSharedData] = useState<SharedSummaryData | null>(null);
  const [vitalsList, setVitalsList] = useState<VitalsRecord[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    async function fetchSharedData() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/shared/patient-summary?token=${token}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch shared health summary');
        }
        const data: SharedSummaryData = await response.json();
        setSharedData(data);

        // Fetch local patient vitals
        const patientVitals = await vitalsService.getPatientVitals(data.patientId);
        setVitalsList(patientVitals);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'The secure link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    }

    fetchSharedData();
  }, [token]);

  // Expiration timer countdown
  useEffect(() => {
    if (!sharedData?.expiresAt) return;

    const timer = setInterval(() => {
      const difference = new Date(sharedData.expiresAt).getTime() - Date.now();
      if (difference <= 0) {
        setError('The secure temporary link has expired.');
        setSharedData(null);
        clearInterval(timer);
        return;
      }

      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      setTimeLeft(`${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [sharedData]);

  const latestVitals = useMemo(() => {
    if (vitalsList.length === 0) return null;
    return [...vitalsList].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    )[0];
  }, [vitalsList]);

  const chartData = useMemo(() => {
    return [...vitalsList]
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .slice(-6); // Last 6 readings
  }, [vitalsList]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6" id="loading-container">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-800 mb-4" id="loading-spinner"></div>
        <p className="text-slate-600 font-medium">Verifying secure digital health token...</p>
      </div>
    );
  }

  if (error || !sharedData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6" id="error-container">
        <Card className="w-full max-w-md border-slate-200 shadow-sm" id="error-card">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4" id="error-icon-wrapper">
              <ShieldAlert className="h-6 w-6" id="error-icon" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900" id="error-title">Access Denied</CardTitle>
            <CardDescription id="error-description">Secure Temporary Link Failed</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4 pt-2">
            <p className="text-sm text-slate-600" id="error-text">
              {error || 'This temporary secure health summary link is invalid, revoked, or has expired. Please contact your clinical coordinator to generate a new active token.'}
            </p>
            <div className="pt-4" id="error-action-wrapper">
              <Link to="/login">
                <Button className="w-full bg-slate-950 hover:bg-slate-850 text-white" id="error-login-button">
                  Access Portal Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8" id="shared-summary-container">
      <div className="max-w-5xl mx-auto space-y-6" id="shared-summary-wrapper">
        {/* Print controls bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 px-4 rounded-xl border border-slate-200 shadow-sm no-print" id="print-controls">
          <span className="text-xs text-slate-500 font-medium">Need physical chart logs? Print an officially-formatted physical medical summary.</span>
          <Button
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-all self-stretch sm:self-auto justify-center"
            id="print-summary-btn"
          >
            <Printer className="w-4 h-4 text-accent animate-pulse" /> Print Summary Report
          </Button>
        </div>

        {/* Verification & Banner Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm" id="banner-header">
          <div className="space-y-1" id="banner-title-block">
            <div className="flex items-center gap-2" id="banner-badge-row">
              <Badge className="bg-emerald-500 hover:bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded flex items-center gap-1 text-xs" id="secure-badge">
                <Lock className="w-3 h-3" /> Secure Link Active
              </Badge>
              <span className="text-slate-400 text-xs">Expires in: {timeLeft || 'Calculating...'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" id="banner-heading">Smart Health Patient Summary</h1>
            <p className="text-xs sm:text-sm text-slate-400">Official, view-only health record summary compiled directly from clinical observations.</p>
          </div>
          <div className="text-right sm:text-left self-stretch sm:self-auto pt-2 sm:pt-0 border-t border-slate-800 sm:border-0" id="banner-meta-block">
            <p className="text-xs text-slate-400">Patient Identity</p>
            <p className="font-semibold text-sm sm:text-lg text-emerald-400">{sharedData.patientName}</p>
            <p className="text-xs text-slate-500">ID: {sharedData.patientId}</p>
          </div>
        </div>

        {/* Core Vitals Overview & Visual Trends */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="vitals-dashboard-grid">
          {/* Latest Metric Cards */}
          <div className="md:col-span-1 space-y-4" id="vitals-metric-cards-col">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2" id="metrics-heading">
              <Activity className="w-5 h-5 text-slate-500" /> Latest Health Readings
            </h2>

            {latestVitals ? (
              <div className="grid grid-cols-1 gap-3" id="metric-cards-list">
                {/* Blood Pressure */}
                <Card className="border-slate-200 shadow-none bg-white hover:border-slate-300 transition-colors" id="bp-card">
                  <CardContent className="p-4 flex items-center justify-between" id="bp-card-content">
                    <div className="flex items-center gap-3" id="bp-info-block">
                      <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg" id="bp-icon-bg">
                        <Gauge className="w-5 h-5" />
                      </div>
                      <div id="bp-labels">
                        <p className="text-xs font-semibold text-slate-500">Blood Pressure</p>
                        <p className="text-xl font-bold text-slate-950">{latestVitals.systolicBp}/{latestVitals.diastolicBp} <span className="text-xs font-normal text-slate-500">mmHg</span></p>
                      </div>
                    </div>
                    <Badge className={`text-xs font-semibold px-2 py-0.5 capitalize ${
                      latestVitals.status === 'normal' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      latestVitals.status === 'elevated' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`} variant="outline" id="bp-badge">
                      {latestVitals.status}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Heart Rate */}
                <Card className="border-slate-200 shadow-none bg-white hover:border-slate-300 transition-colors" id="hr-card">
                  <CardContent className="p-4 flex items-center justify-between" id="hr-card-content">
                    <div className="flex items-center gap-3" id="hr-info-block">
                      <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg animate-pulse" id="hr-icon-bg">
                        <Heart className="w-5 h-5 fill-rose-600" />
                      </div>
                      <div id="hr-labels">
                        <p className="text-xs font-semibold text-slate-500">Heart Rate</p>
                        <p className="text-xl font-bold text-slate-950">{latestVitals.heartRate} <span className="text-xs font-normal text-slate-500">bpm</span></p>
                      </div>
                    </div>
                    <Badge className="bg-slate-50 text-slate-700 border-slate-200 text-xs font-semibold" variant="outline" id="hr-badge">
                      {latestVitals.heartRate > 100 ? 'Elevated' : latestVitals.heartRate < 60 ? 'Low' : 'Normal'}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Oxygen Saturation */}
                <Card className="border-slate-200 shadow-none bg-white hover:border-slate-300 transition-colors" id="spo2-card">
                  <CardContent className="p-4 flex items-center justify-between" id="spo2-card-content">
                    <div className="flex items-center gap-3" id="spo2-info-block">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg" id="spo2-icon-bg">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div id="spo2-labels">
                        <p className="text-xs font-semibold text-slate-500">Oxygen Level</p>
                        <p className="text-xl font-bold text-slate-950">
                          {latestVitals.oxygenSaturation !== undefined ? `${latestVitals.oxygenSaturation}%` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs font-semibold px-2 py-0.5 capitalize ${
                      latestVitals.oxygenSaturation !== undefined && latestVitals.oxygenSaturation >= 95 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`} variant="outline" id="spo2-badge">
                      {latestVitals.oxygenSaturation !== undefined && latestVitals.oxygenSaturation >= 95 ? 'Normal' : 'Low / Unknown'}
                    </Badge>
                  </CardContent>
                </Card>

                {/* Body Temperature */}
                <Card className="border-slate-200 shadow-none bg-white hover:border-slate-300 transition-colors" id="temp-card">
                  <CardContent className="p-4 flex items-center justify-between" id="temp-card-content">
                    <div className="flex items-center gap-3" id="temp-info-block">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg" id="temp-icon-bg">
                        <Thermometer className="w-5 h-5" />
                      </div>
                      <div id="temp-labels">
                        <p className="text-xs font-semibold text-slate-500">Temperature</p>
                        <p className="text-xl font-bold text-slate-950">{latestVitals.temperature}°C</p>
                      </div>
                    </div>
                    <Badge className={`text-xs font-semibold px-2 py-0.5 capitalize ${
                      latestVitals.temperature >= 38.0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`} variant="outline" id="temp-badge">
                      {latestVitals.temperature >= 38.0 ? 'Fever' : 'Normal'}
                    </Badge>
                  </CardContent>
                </Card>

                <p className="text-[10px] text-slate-400 text-center pt-1" id="metrics-footer-text">
                  Last updated: {latestVitals.recordedAt}
                </p>
              </div>
            ) : (
              <Card className="border-slate-200 shadow-none bg-white py-8" id="no-vitals-card">
                <CardContent className="text-center text-slate-500 text-sm" id="no-vitals-content">
                  No biometrics are logged on this record yet.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Graphical Trends */}
          <div className="md:col-span-2 space-y-4" id="vitals-chart-col">
            <h2 className="text-lg font-bold text-slate-900" id="trends-heading">Historical Vitals Trend (Last 6 Readings)</h2>
            <Card className="border-slate-200 shadow-none bg-white p-4" id="trends-chart-card">
              <CardContent className="p-0 pt-2" id="trends-chart-content">
                {chartData.length > 0 ? (
                  <div className="h-64 sm:h-72 w-full" id="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%" id="chart-container">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} id="recharts-line-chart">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="recordedAt"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                        <Line
                          name="Systolic BP"
                          type="monotone"
                          dataKey="systolicBp"
                          stroke="#e11d48"
                          strokeWidth={2.5}
                          activeDot={{ r: 6 }}
                          dot={{ r: 3 }}
                        />
                        <Line
                          name="Diastolic BP"
                          type="monotone"
                          dataKey="diastolicBp"
                          stroke="#f43f5e"
                          strokeWidth={1.5}
                          activeDot={{ r: 4 }}
                          dot={{ r: 2 }}
                        />
                        <Line
                          name="Heart Rate"
                          type="monotone"
                          dataKey="heartRate"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          activeDot={{ r: 5 }}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500 text-sm" id="no-chart-data">
                    Insufficient historical data to plot vitals timeline.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="space-y-4" id="appointments-section">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2" id="appointments-heading">
            <Calendar className="w-5 h-5 text-slate-500" /> Upcoming Clinic Appointments
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="appointments-grid">
            {sharedData.appointments.length > 0 ? (
              sharedData.appointments.map((appt) => (
                <Card key={appt.id} className="border-slate-200 shadow-none bg-white" id={`appt-card-${appt.id}`}>
                  <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between space-y-0" id={`appt-card-header-${appt.id}`}>
                    <div id={`appt-header-meta-${appt.id}`}>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-semibold text-[10px]" id={`appt-badge-type-${appt.id}`}>
                        {appt.type}
                      </Badge>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold capitalize text-[10px]" variant="outline" id={`appt-badge-status-${appt.id}`}>
                      {appt.status}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3" id={`appt-card-content-${appt.id}`}>
                    <div className="flex items-center gap-3 text-slate-600 text-sm" id={`appt-datetime-block-${appt.id}`}>
                      <div className="p-1.5 bg-slate-100 rounded text-slate-800" id={`appt-clock-icon-bg-${appt.id}`}>
                        <Clock className="w-4 h-4" />
                      </div>
                      <div id={`appt-datetime-text-${appt.id}`}>
                        <p className="font-semibold text-slate-900">{appt.appointment_date}</p>
                        <p className="text-xs text-slate-500">{appt.appointment_time}</p>
                      </div>
                    </div>

                    <div className="text-sm border-t border-slate-50 pt-2" id={`appt-doctor-block-${appt.id}`}>
                      <p className="text-xs font-semibold text-slate-400">Consultant Practitioner</p>
                      <p className="font-semibold text-slate-800">{appt.doctor_name}</p>
                      <p className="text-xs text-slate-500">{appt.department} Clinic</p>
                    </div>

                    {appt.notes && (
                      <div className="bg-slate-50 p-2.5 rounded-lg text-xs text-slate-600 italic" id={`appt-notes-block-${appt.id}`}>
                        Notes: {appt.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-slate-200 shadow-none bg-white col-span-2 py-8" id="no-appointments-card">
                <CardContent className="text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2" id="no-appointments-content">
                  <Calendar className="w-8 h-8 text-slate-300" />
                  <p>No upcoming clinic visits are scheduled at this time.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer info & warnings */}
        <div className="bg-slate-100 p-4 rounded-xl text-center space-y-1 border border-slate-200" id="shared-footer-warnings">
          <p className="text-xs text-slate-500 font-semibold flex items-center justify-center gap-1" id="footer-secure-message">
            <Lock className="w-3.5 h-3.5 text-emerald-600" /> This clinical summary is securely generated and will self-expire in {timeLeft || '0s'}.
          </p>
          <p className="text-[10px] text-slate-400" id="footer-confidential-message">
            CONFIDENTIAL MEDICAL REPORT. Strictly intended for the patient and validated healthcare partners. Do not share credentials or duplicate access tokens.
          </p>
        </div>
      </div>
    </div>
  );
}
