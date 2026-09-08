import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Gauge,
  HeartPulse,
  Flame,
  Wind,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { vitalsService } from '@/services/vitalsService';
import type { CriticalHealthAlert } from '@/types/vitals';

export function CriticalVitalsAlertWidget({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<CriticalHealthAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await vitalsService.getAllActiveCriticalAlerts();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load critical alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'high').length;

  const getCategoryIcon = (category: CriticalHealthAlert['category']) => {
    switch (category) {
      case 'blood_pressure':
        return <Gauge className="h-4 w-4" />;
      case 'heart_rate':
        return <HeartPulse className="h-4 w-4" />;
      case 'temperature':
        return <Flame className="h-4 w-4" />;
      case 'oxygen':
        return <Wind className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <Card
      id="dashboard-critical-health-alerts-widget"
      className={`border-2 ${
        criticalCount > 0
          ? 'border-red-600 bg-card'
          : warningCount > 0
          ? 'border-amber-500 bg-card'
          : 'border-border bg-card'
      } ${className}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg text-white ${
                criticalCount > 0
                  ? 'bg-red-600'
                  : warningCount > 0
                  ? 'bg-amber-600'
                  : 'bg-emerald-600'
              }`}
            >
              {criticalCount > 0 ? (
                <AlertOctagon className="h-5 w-5 animate-pulse" />
              ) : warningCount > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-foreground">
                  Critical Patient Health Alerts
                </CardTitle>
                {alerts.length > 0 && (
                  <Badge
                    variant="destructive"
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                      criticalCount > 0
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {criticalCount > 0 ? `${criticalCount} Crisis` : `${warningCount} Abnormal`}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Real-time abnormal blood pressure, cardiac, and fever alerts across patients
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={fetchAlerts}
              title="Refresh Vitals Alerts"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 font-medium border-border"
              onClick={() => navigate('/patients?tab=vitals')}
            >
              <span>Vitals Hub</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Checking patient vital telemetry...
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-5 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              All Active Inpatients & Outpatients Stable
            </p>
            <p className="text-[11px] text-muted-foreground">
              No abnormal blood pressure, tachycardic, or fever readings detected in recent records.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => {
              const isCritical = alert.severity === 'critical';

              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isCritical
                      ? 'border-red-500/50 bg-red-500/5 dark:bg-red-950/20'
                      : 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                        isCritical
                          ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {getCategoryIcon(alert.category)}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {alert.patientName}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          ({alert.patientId})
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase px-1.5 py-0 ${
                            isCritical
                              ? 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300'
                              : 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {alert.title}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-foreground/80 font-medium">
                        <span>{alert.metricLabel}:</span>
                        <span className="font-mono font-bold text-foreground">
                          {alert.metricValue}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          (Recorded {alert.recordedAt})
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={isCritical ? 'destructive' : 'default'}
                    className={`h-7 text-xs font-semibold shrink-0 gap-1 ${
                      isCritical
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                    onClick={() =>
                      navigate(
                        `/patients?tab=vitals&patientId=${encodeURIComponent(
                          alert.patientId
                        )}`
                      )
                    }
                  >
                    <span>Inspect Patient</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CriticalVitalsAlertWidget;
