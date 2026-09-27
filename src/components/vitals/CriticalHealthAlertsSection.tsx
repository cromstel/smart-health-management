import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  HeartPulse,
  Flame,
  Gauge,
  Wind,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  Info,
} from 'lucide-react';
import type { CriticalHealthAlert } from '@/types/vitals';
import { toast } from 'sonner';

interface CriticalHealthAlertsSectionProps {
  alerts: CriticalHealthAlert[];
  patientName: string;
  patientId: string;
  onOpenLogDialog?: () => void;
  className?: string;
}

export function CriticalHealthAlertsSection({
  alerts,
  patientName,
  patientId,
  onOpenLogDialog,
  className = '',
}: CriticalHealthAlertsSectionProps) {
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<string[]>([]);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const activeAlerts = alerts.filter((a) => !acknowledgedAlertIds.includes(a.id));
  const hasCritical = activeAlerts.some((a) => a.severity === 'critical');
  const hasAlerts = activeAlerts.length > 0;

  const handleAcknowledge = (id: string, title: string) => {
    setAcknowledgedAlertIds((prev) => [...prev, id]);
    toast.success(`Alert acknowledged: ${title}`);
  };

  const handleNotifyTeam = (alert: CriticalHealthAlert) => {
    toast.success(
      `Urgent alert dispatched to attending care team for ${patientName} (${alert.metricLabel}: ${alert.metricValue})`
    );
  };

  const getCategoryIcon = (category: CriticalHealthAlert['category']) => {
    switch (category) {
      case 'blood_pressure':
        return <Gauge className="h-5 w-5 shrink-0" />;
      case 'heart_rate':
        return <HeartPulse className="h-5 w-5 shrink-0" />;
      case 'temperature':
        return <Flame className="h-5 w-5 shrink-0" />;
      case 'oxygen':
        return <Wind className="h-5 w-5 shrink-0" />;
      default:
        return <AlertTriangle className="h-5 w-5 shrink-0" />;
    }
  };

  if (!hasAlerts) {
    return (
      <Card
        id={`patient-health-status-ok-${patientId}`}
        className={`border border-success/30 bg-success/5 dark:bg-success/20 ${className}`}
      >
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/20 text-success dark:text-success">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    Vital Signs Stable — No Critical Alerts
                  </h4>
                  <Badge
                    variant="outline"
                    className="border-success/40 bg-success/10 text-success dark:text-emerald-300 text-[11px] font-medium"
                  >
                    Clinical Status: Normal
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Latest biometrics for <span className="font-medium text-foreground">{patientName}</span> comply with clinical target ranges (BP &lt;120/80 mmHg, HR 60-100 bpm, Temp 36.1-37.2°C).
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 self-start sm:self-auto border-border"
              onClick={() => setShowGuidelines(!showGuidelines)}
            >
              <Info className="h-3.5 w-3.5" />
              <span>{showGuidelines ? 'Hide Thresholds' : 'View Clinical Guidelines'}</span>
            </Button>
          </div>

          {showGuidelines && (
            <div className="mt-3 pt-3 border-t border-success/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-card/80 border border-border space-y-0.5">
                <span className="font-semibold text-foreground">Blood Pressure</span>
                <p className="text-muted-foreground text-[11px]">Normal: &lt;120/80 mmHg</p>
                <p className="text-warning dark:text-warning text-[11px]">Stage 2 Alert: ≥140/90 mmHg</p>
              </div>
              <div className="p-2 rounded bg-card/80 border border-border space-y-0.5">
                <span className="font-semibold text-foreground">Heart Rate</span>
                <p className="text-muted-foreground text-[11px]">Normal: 60 - 100 bpm</p>
                <p className="text-destructive dark:text-destructive text-[11px]">Critical: ≥125 bpm or &lt;50 bpm</p>
              </div>
              <div className="p-2 rounded bg-card/80 border border-border space-y-0.5">
                <span className="font-semibold text-foreground">Temperature</span>
                <p className="text-muted-foreground text-[11px]">Normal: 36.1 - 37.2 °C</p>
                <p className="text-warning dark:text-warning text-[11px]">Fever Alert: ≥38.0 °C</p>
              </div>
              <div className="p-2 rounded bg-card/80 border border-border space-y-0.5">
                <span className="font-semibold text-foreground">Oxygen Saturation</span>
                <p className="text-muted-foreground text-[11px]">Optimal: ≥95 %</p>
                <p className="text-destructive dark:text-destructive text-[11px]">Hypoxemia Alert: &lt;90 %</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} id={`critical-alerts-container-${patientId}`}>
      {/* High-Visibility Warning Banner Card */}
      <Card
        className={`border-2 shadow-sm ${
          hasCritical
            ? 'border-destructive bg-destructive/10 dark:bg-destructive/30'
            : 'border-warning bg-warning/10 dark:bg-warning/30'
        }`}
      >
        <CardContent className="p-4 sm:p-5">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg flex items-center justify-center text-white ${
                  hasCritical ? 'bg-destructive' : 'bg-warning'
                }`}
              >
                {hasCritical ? (
                  <AlertOctagon className="h-6 w-6 animate-pulse" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-foreground tracking-tight">
                    Critical Health Alert: {patientName}
                  </h3>
                  <Badge
                    variant="destructive"
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 ${
                      hasCritical
                        ? 'bg-destructive hover:bg-destructive text-white'
                        : 'bg-warning hover:bg-warning text-white'
                    }`}
                  >
                    {hasCritical ? '⚠️ HIGH PRIORITY CRISIS' : '⚠️ ABNORMAL VITALS DETECTED'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({activeAlerts.length} active {activeAlerts.length === 1 ? 'alert' : 'alerts'})
                  </span>
                </div>
                <p className="text-xs text-foreground/80 mt-1">
                  Abnormal biometric reading requiring physician triage and therapeutic intervention.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {onOpenLogDialog && (
                <Button
                  size="sm"
                  onClick={onOpenLogDialog}
                  className={`h-8 text-xs font-semibold gap-1.5 shadow-sm text-white ${
                    hasCritical
                      ? 'bg-destructive hover:bg-destructive'
                      : 'bg-warning hover:bg-warning'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Log Follow-up Reading</span>
                </Button>
              )}
            </div>
          </div>

          {/* List of active alert cards */}
          <div className="mt-3.5 space-y-3">
            {activeAlerts.map((alert) => {
              const isCritical = alert.severity === 'critical';
              const isExpanded = expandedAlertId === alert.id;

              return (
                <div
                  key={alert.id}
                  id={`alert-card-${alert.id}`}
                  className={`p-3.5 rounded-lg border transition-all ${
                    isCritical
                      ? 'border-destructive/60 bg-card text-foreground'
                      : 'border-warning/60 bg-card text-foreground'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    {/* Alert Icon and Info */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-md shrink-0 mt-0.5 ${
                          isCritical
                            ? 'bg-destructive/20 text-destructive dark:text-destructive'
                            : 'bg-warning/20 text-warning dark:text-warning'
                        }`}
                      >
                        {getCategoryIcon(alert.category)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-foreground">
                            {alert.title}
                          </h4>
                          <span
                            className={`font-mono text-sm font-extrabold px-2 py-0.5 rounded border ${
                              isCritical
                                ? 'bg-destructive/15 border-destructive/40 text-destructive dark:text-red-300'
                                : 'bg-warning/15 border-warning/40 text-warning dark:text-amber-300'
                            }`}
                          >
                            {alert.metricValue}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            (Threshold: {alert.thresholdLabel})
                          </span>
                        </div>

                        <p className="text-xs text-foreground/90 font-medium">
                          {alert.message}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                          <span>Recorded: {alert.recordedAt}</span>
                          <span>•</span>
                          <span>By: {alert.recordedBy}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons per alert */}
                    <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedAlertId(isExpanded ? null : alert.id)
                        }
                        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground gap-1"
                      >
                        <span>{isExpanded ? 'Less info' : 'Guideline & actions'}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNotifyTeam(alert)}
                        className="h-7 text-[11px] px-2.5 gap-1 border-border"
                        title="Alert attending clinician"
                      >
                        <Send className="h-3 w-3" />
                        <span>Dispatch Care Alert</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAcknowledge(alert.id, alert.title)}
                        className="h-7 text-[11px] px-2.5 gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        <span>Acknowledge</span>
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Guideline & Recommendation Panel */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded bg-muted/40 border border-border space-y-1">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 text-accent" />
                          Clinical Guideline
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          {alert.clinicalGuideline}
                        </p>
                      </div>

                      <div className="p-2.5 rounded bg-muted/40 border border-border space-y-1">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                          Recommended Clinical Action
                        </span>
                        <p className="text-foreground/90 font-medium leading-relaxed">
                          {alert.recommendedAction}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CriticalHealthAlertsSection;
