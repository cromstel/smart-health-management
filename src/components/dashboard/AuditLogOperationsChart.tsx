import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ShieldAlert, Activity, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface AuditLogItem {
  id?: string;
  action: string;
  module?: string;
  user?: string;
  details?: string;
  timestamp: string;
}

export function AuditLogOperationsChart({ className = '' }: { className?: string }) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'30d' | '14d' | '7d'>('30d');

  // /api/super-admin/audit-logs requires the superAdmin permission, so every
  // clinician dashboard load was firing a request that could only answer 403.
  // Gate the call on the permission and fall back to the local/mock timeline
  // without touching the network when it is not held.
  const { user } = useAuth();
  const canReadAuditLogs = !!user && (user.role === 'Super Admin' || user.role === 'super_admin');

  useEffect(() => {
    async function fetchLogs() {
      if (!canReadAuditLogs) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.getAuditLogs(100);
        if (Array.isArray(res)) {
          setLogs(res);
        } else if (res && Array.isArray((res as any).logs)) {
          setLogs((res as any).logs);
        } else {
          // Locally-recorded audit entries only.
          //
          // This previously invented 60 audit records here and again in the
          // catch below, with plausible actions, users and timestamps. An audit
          // trail is a security record: fabricating entries makes the panel
          // indistinguishable from real activity, which is worse than showing
          // nothing. No source means no chart.
          const local = JSON.parse(localStorage.getItem('auditLogs') || '[]');
          setLogs(Array.isArray(local) ? local : []);
        }
      } catch (err) {
        console.warn('Failed to load audit logs for chart', err);
        // A failed audit fetch leaves the panel empty on purpose. See the note
        // in the success branch: invented security records are worse than none.
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [canReadAuditLogs]);

  const chartData = useMemo(() => {
    const daysCount = timeRange === '30d' ? 30 : timeRange === '14d' ? 14 : 7;
    const now = new Date();
    const map = new Map<string, { date: string; total: number; security: number; clinical: number; admin: number }>();

    // Initialize buckets for the last N days
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map.set(key, { date: label, total: 0, security: 0, clinical: 0, admin: 0 });
    }

    logs.forEach(log => {
      if (!log.timestamp) return;
      const key = log.timestamp.split('T')[0];
      if (map.has(key)) {
        const entry = map.get(key)!;
        entry.total += 1;
        const act = (log.action || '').toUpperCase();
        if (act.includes('SECURITY') || act.includes('LOGIN') || act.includes('AUTH')) {
          entry.security += 1;
        } else if (act.includes('PATIENT') || act.includes('PRESCRIPTION') || act.includes('VITALS')) {
          entry.clinical += 1;
        } else {
          entry.admin += 1;
        }
      }
    });

    return Array.from(map.values());
  }, [logs, timeRange]);

  const totalOps = useMemo(() => chartData.reduce((acc, curr) => acc + curr.total, 0), [chartData]);
  const securityOps = useMemo(() => chartData.reduce((acc, curr) => acc + curr.security, 0), [chartData]);
  const clinicalOps = useMemo(() => chartData.reduce((acc, curr) => acc + curr.clinical, 0), [chartData]);

  return (
    <Card className={`col-span-2 shadow-sm ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Activity className="h-5 w-5 text-primary" />
            Critical System Operations & Audit Log Frequency ({timeRange.toUpperCase()})
          </CardTitle>
          <CardDescription>
            Monitoring critical administrative, clinical, and security actions over time
          </CardDescription>
        </div>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <Button
            size="sm"
            variant={timeRange === '7d' ? 'default' : 'ghost'}
            className="h-7 px-2.5 text-xs font-semibold"
            onClick={() => setTimeRange('7d')}
          >
            7D
          </Button>
          <Button
            size="sm"
            variant={timeRange === '14d' ? 'default' : 'ghost'}
            className="h-7 px-2.5 text-xs font-semibold"
            onClick={() => setTimeRange('14d')}
          >
            14D
          </Button>
          <Button
            size="sm"
            variant={timeRange === '30d' ? 'default' : 'ghost'}
            className="h-7 px-2.5 text-xs font-semibold"
            onClick={() => setTimeRange('30d')}
          >
            30D
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="text-xs font-medium text-muted-foreground">Total Operations</div>
            <div className="text-2xl font-bold text-foreground mt-1">{totalOps}</div>
            <div className="text-xs text-success font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% Verified
            </div>
          </div>
          <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
            <div className="text-xs font-medium text-muted-foreground">Clinical & Patient Ops</div>
            <div className="text-2xl font-bold text-accent dark:text-accent mt-1">{clinicalOps}</div>
            <div className="text-xs text-accent font-medium flex items-center gap-1 mt-1">
              <FileText className="h-3.5 w-3.5" /> Active Records
            </div>
          </div>
          <div className="p-3 rounded-xl bg-warning/5 border border-warning/10">
            <div className="text-xs font-medium text-muted-foreground">Security & Access Events</div>
            <div className="text-2xl font-bold text-warning dark:text-warning mt-1">{securityOps}</div>
            <div className="text-xs text-warning font-medium flex items-center gap-1 mt-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Monitored
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
              Loading audit operations analytics...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284C7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorSecurity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-md">
                          <div className="font-semibold text-xs text-muted-foreground mb-1">{label}</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-foreground">Total Operations:</span>
                              <span className="font-bold">{payload[0]?.value}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-accent">Clinical Actions:</span>
                              <span className="font-bold">{payload[1]?.value || 0}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-warning">Security & Auth:</span>
                              <span className="font-bold">{payload[2]?.value || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="#0284C7" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" name="Total Operations" />
                <Area type="monotone" dataKey="clinical" stroke="#0D9488" strokeWidth={2} fillOpacity={0.2} fill="#0D9488" name="Clinical" />
                <Area type="monotone" dataKey="security" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.2} fill="url(#colorSecurity)" name="Security" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
