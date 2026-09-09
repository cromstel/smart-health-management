import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { patientService } from '@/api/services/patientService';
import type { PatientApiResponse } from '@/api/schemas/patient';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Activity, Heart, Thermometer, Wind, Loader2 } from 'lucide-react';

// Mock historical trend data for vitals over the last 7 checkups / timepoints
const MOCK_VITALS_TRENDS = [
  { time: '08:00 AM', heartRate: 72, bpSys: 120, bpDia: 80, spo2: 98, temp: 98.6 },
  { time: '10:00 AM', heartRate: 78, bpSys: 124, bpDia: 82, spo2: 97, temp: 98.8 },
  { time: '12:00 PM', heartRate: 85, bpSys: 130, bpDia: 85, spo2: 96, temp: 99.1 },
  { time: '02:00 PM', heartRate: 74, bpSys: 118, bpDia: 78, spo2: 99, temp: 98.6 },
  { time: '04:00 PM', heartRate: 76, bpSys: 122, bpDia: 80, spo2: 98, temp: 98.7 },
  { time: '06:00 PM', heartRate: 80, bpSys: 125, bpDia: 82, spo2: 97, temp: 98.9 },
  { time: '08:00 PM', heartRate: 72, bpSys: 119, bpDia: 79, spo2: 98, temp: 98.6 },
];

export function PatientVitalsTrendsDashboard() {
  const [patients, setPatients] = useState<PatientApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  useEffect(() => {
    async function loadPatients() {
      try {
        const data = await patientService.getPatients();
        setPatients(data);
        if (data.length > 0) {
          setSelectedPatientId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load patients for vitals trends', err);
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground font-medium">Loading Vitals Telemetry...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="patient-vitals-trends-dashboard">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Patient Vitals Analytics & Trends Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Visualizing real-time telemetry and vital sign fluctuations over time using Recharts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="vitals-patient-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Patient:
          </label>
          <select
            id="vitals-patient-select"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="h-9 px-3 text-sm rounded-md bg-background border border-input text-foreground font-medium focus:ring-2 focus:ring-primary"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.condition ? `(${p.condition})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedPatient && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Heart Rate</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">74 <span className="text-xs font-normal text-muted-foreground">bpm</span></h3>
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 mt-1">Normal Sinus Rhythm</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Heart className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Blood Pressure</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">120/80 <span className="text-xs font-normal text-muted-foreground">mmHg</span></h3>
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 mt-1">Optimal Range</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Activity className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Blood Oxygen (SpO2)</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">98%</h3>
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 mt-1">Fully Saturated</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Wind className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Temperature</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">98.6°F</h3>
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 mt-1">Afebrille</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Thermometer className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recharts Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              Heart Rate & Blood Pressure Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_VITALS_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[60, 150]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="heartRate" name="Heart Rate (bpm)" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="bpSys" name="Systolic BP (mmHg)" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Wind className="h-4 w-4 text-emerald-500" />
              Blood Oxygen & Temperature Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_VITALS_TRENDS}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[90, 102]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="temp" name="Temperature (°F)" stroke="#d97706" fill="#d97706" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
