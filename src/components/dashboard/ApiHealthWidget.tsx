import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Server, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '@/config/api';

export function ApiHealthWidget() {
  const [status, setStatus] = useState<'online' | 'degraded' | 'offline'>('online');
  const [latency, setLatency] = useState<number | null>(null);
  const [history, setHistory] = useState<{ id: number; latency: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const measureHealth = useCallback(async () => {
    setLoading(true);
    const start = performance.now();
    try {
      // The probe goes to the configured API base. It used to use a relative
      // path, which assumed the app and the API share an origin -- true in
      // production behind one host, false in development, where it made the
      // widget report the API as unreachable.
      //
      // The probe asks the service whether it is alive. It used to post to
      // the sign-in route, which is refused before it runs -- the sign-in
      // route requires a request token, and a probe has none -- so the probe
      // measured a refusal and called it healthy. The health route answers
      // exactly the question being asked.
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }).catch(() => null);

      const end = performance.now();
      const duration = Math.round(end - start);

      if (response) {
        setLatency(duration);
        let currentStatus: 'online' | 'degraded' | 'offline' = 'online';
        if (duration > 350) {
          currentStatus = 'degraded';
        }
        setStatus(currentStatus);

        setHistory((prev) => {
          const next = [...prev, { id: Date.now(), latency: duration }].slice(-15);
          return next;
        });
      } else {
        setStatus('offline');
        setLatency(null);
      }
    } catch {
      setStatus('offline');
      setLatency(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    measureHealth();
    // Refresh every 15 seconds
    const interval = setInterval(measureHealth, 15000);
    return () => clearInterval(interval);
  }, [measureHealth]);

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        {/* Wraps at narrow widths instead of overflowing. As a single
            justify-between row the title, status badge and refresh control
            together exceeded a 375px viewport, pushing the card 51px past the
            edge and giving the document a 607px scroll width. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            API Telemetry &amp; Latency
          </CardTitle>
          <div className="flex items-center gap-2">
            {status === 'online' && (
              <Badge className="bg-success/10 text-success hover:bg-success/20 border-success/20 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                OPERATIONAL
              </Badge>
            )}
            {status === 'degraded' && (
              <Badge className="bg-warning/10 text-warning hover:bg-warning/20 border-warning/20 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                DEGRADED LATENCY
              </Badge>
            )}
            {status === 'offline' && (
              <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                UNREACHABLE
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-md"
              onClick={measureHealth}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Response Latency
            </span>
            <span className="text-3xl font-bold tracking-tight text-foreground mt-2">
              {latency !== null ? `${latency} ms` : '—'}
            </span>
            <span className="text-[10px] text-muted-foreground mt-1">
              {latency !== null && latency < 150 ? 'Excellent connection speed' : latency !== null && latency < 350 ? 'Standard response time' : 'High network latency detected'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Service Endpoint
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground truncate mt-2 font-mono">
              /api
            </span>
            <span className="text-[10px] text-muted-foreground mt-1">
              Active Server Gateway
            </span>
          </div>
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Telemetry Ping History</span>
              <span>Last 15 requests</span>
            </div>
            <div className="h-12 w-full rounded-lg border border-border/40 overflow-hidden bg-muted/10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#0ea5e9"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#latencyGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
