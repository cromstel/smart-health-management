import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/services/shmsApiClient';

export default function PatientPortalPage() {
  const [portal, setPortal] = useState<{ first_name?: string; last_name?: string; email?: string; status?: string } | null>(null);
  const [appointments, setAppointments] = useState<{ id: number; appointment_date: string; status: string; notes?: string }[]>([]);
  const [summaries, setSummaries] = useState<{ id: number; title?: string; created_at: string }[]>([]);

  useEffect(() => {
    apiRequest('/api/patient-portal').then((r: any) => setPortal(r.record || null)).catch(() => setPortal(null));
    apiRequest('/api/patient-portal/appointments').then((r: any) => setAppointments(r.appointments || [])).catch(() => setAppointments([]));
    apiRequest('/api/patient-portal/summaries').then((r: any) => setSummaries(r.summaries || [])).catch(() => setSummaries([]));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <header>
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground tracking-tight">Patient Portal</h1>
        <p className="text-muted-foreground mt-2">Your records, appointments, and shared summaries — scoped to your account.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-card border-border shadow-none md:col-span-2">
          <CardHeader>
            <CardTitle className="font-sans text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-sea-blue text-white flex items-center justify-center font-mono text-lg" aria-label="Profile initials">
                {(portal?.first_name?.[0] || 'P') + (portal?.last_name?.[0] || '')}
              </div>
              <div>
                <div className="font-medium text-foreground">{portal?.first_name ? `${portal.first_name} ${portal.last_name}` : 'Patient'}</div>
                <div className="text-sm text-muted-foreground">{portal?.email}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Badge variant="secondary">Role: Patient</Badge>
              <Badge variant="outline">{portal?.status || 'Active'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-none">
          <CardHeader>
            <CardTitle className="font-sans text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="/appointments">My Appointments</a>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="/financial">Billing & Invoicing</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold text-foreground">Upcoming Appointments</h2>
        <Separator className="my-3" />
        {appointments.length === 0 ? (
          <p className="text-muted-foreground">No appointments recorded.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {appointments.map((a) => (
              <Card key={a.id} className="bg-card border-border shadow-none">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground">{new Date(a.appointment_date).toLocaleDateString()}</span>
                    <Badge variant={a.status === 'scheduled' ? 'secondary' : 'outline'}>{a.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{a.notes || 'No notes provided.'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-foreground">Shared Summaries</h2>
        <Separator className="my-3" />
        {summaries.length === 0 ? (
          <p className="text-muted-foreground">No shared summaries yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {summaries.map((s) => (
              <Card key={s.id} className="bg-card border-border shadow-none">
                <CardContent className="pt-5 space-y-2">
                  <div className="font-medium text-foreground">{s.title || 'Shared Summary'}</div>
                  <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
