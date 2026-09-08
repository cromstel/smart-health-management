import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Activity,
  Heart,
  Thermometer,
  Gauge,
  Wind,
  ShieldCheck,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowRight,
} from 'lucide-react';
import { vitalsService } from '@/services/vitalsService';
import type { VitalsRecord } from '@/types/vitals';

interface AlertsSummaryProps {
  patientId: string;
  patientName: string;
  className?: string;
  vitals?: VitalsRecord[];
}

interface TrendState {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  changeValue: number;
  unit: string;
  isAbnormalTrend: boolean;
  message: string;
  severity: 'critical' | 'warning' | 'stable';
}

export function AlertsSummary({
  patientId,
  patientName,
  className = '',
  vitals: providedVitals,
}: AlertsSummaryProps) {
  const [localVitals, setLocalVitals] = useState<VitalsRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (providedVitals) {
      setLocalVitals(providedVitals);
    } else {
      const fetchLocalVitals = async () => {
        setLoading(true);
        try {
          const records = await vitalsService.getPatientVitals(patientId);
          setLocalVitals(records);
        } catch (error) {
          console.error('Error fetching patient vitals for AlertsSummary:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchLocalVitals();
    }
  }, [patientId, providedVitals]);

  const activeVitals = providedVitals || localVitals;

  // Sort chronological ascending to compute trends
  const chronoVitals = useMemo(() => {
    return [...activeVitals].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
  }, [activeVitals]);

  const latestRecord = chronoVitals[chronoVitals.length - 1];
  const previousRecord = chronoVitals.length > 1 ? chronoVitals[chronoVitals.length - 2] : null;

  // Computes explicit vital sign trends (comparing last 2 readings)
  const trends = useMemo<TrendState[]>(() => {
    if (!latestRecord || !previousRecord) return [];

    const list: TrendState[] = [];

    // 1. Systolic BP
    const sysDiff = latestRecord.systolicBp - previousRecord.systolicBp;
    let sysDir: 'up' | 'down' | 'stable' = 'stable';
    if (sysDiff > 2) sysDir = 'up';
    else if (sysDiff < -2) sysDir = 'down';

    const sysIsElevating = sysDir === 'up' && latestRecord.systolicBp >= 130;
    list.push({
      metric: 'Systolic BP',
      direction: sysDir,
      changeValue: Math.abs(sysDiff),
      unit: 'mmHg',
      isAbnormalTrend: sysIsElevating,
      severity: latestRecord.systolicBp >= 140 && sysDir === 'up' ? 'critical' : sysIsElevating ? 'warning' : 'stable',
      message: sysIsElevating
        ? `Systolic pressure rose by ${Math.abs(sysDiff)} mmHg to an abnormal ${latestRecord.systolicBp} mmHg.`
        : sysDir === 'up'
        ? `Systolic pressure increased slightly (+${Math.abs(sysDiff)} mmHg).`
        : sysDir === 'down'
        ? `Systolic pressure dropped by ${Math.abs(sysDiff)} mmHg.`
        : 'Systolic pressure remains stable.',
    });

    // 2. Diastolic BP
    const diaDiff = latestRecord.diastolicBp - previousRecord.diastolicBp;
    let diaDir: 'up' | 'down' | 'stable' = 'stable';
    if (diaDiff > 2) diaDir = 'up';
    else if (diaDiff < -2) diaDir = 'down';

    const diaIsElevating = diaDir === 'up' && latestRecord.diastolicBp >= 80;
    list.push({
      metric: 'Diastolic BP',
      direction: diaDir,
      changeValue: Math.abs(diaDiff),
      unit: 'mmHg',
      isAbnormalTrend: diaIsElevating,
      severity: latestRecord.diastolicBp >= 90 && diaDir === 'up' ? 'critical' : diaIsElevating ? 'warning' : 'stable',
      message: diaIsElevating
        ? `Diastolic pressure rose by ${Math.abs(diaDiff)} mmHg to an abnormal ${latestRecord.diastolicBp} mmHg.`
        : diaDir === 'up'
        ? `Diastolic pressure increased slightly (+${Math.abs(diaDiff)} mmHg).`
        : diaDir === 'down'
        ? `Diastolic pressure dropped by ${Math.abs(diaDiff)} mmHg.`
        : 'Diastolic pressure remains stable.',
    });

    // 3. Heart Rate
    const hrDiff = latestRecord.heartRate - previousRecord.heartRate;
    let hrDir: 'up' | 'down' | 'stable' = 'stable';
    if (hrDiff > 3) hrDir = 'up';
    else if (hrDiff < -3) hrDir = 'down';

    const hrIsElevating = hrDir === 'up' && latestRecord.heartRate > 100;
    const hrIsCritical = (hrDir === 'up' && latestRecord.heartRate >= 120) || (hrDir === 'down' && latestRecord.heartRate < 50);
    list.push({
      metric: 'Heart Rate',
      direction: hrDir,
      changeValue: Math.abs(hrDiff),
      unit: 'bpm',
      isAbnormalTrend: hrIsElevating || (hrDir === 'down' && latestRecord.heartRate < 55),
      severity: hrIsCritical ? 'critical' : hrIsElevating ? 'warning' : 'stable',
      message: hrIsCritical
        ? `Heart rate trend is critically abnormal. Latest: ${latestRecord.heartRate} bpm.`
        : hrIsElevating
        ? `Heart rate rose by ${Math.abs(hrDiff)} bpm to a tachycardic ${latestRecord.heartRate} bpm.`
        : hrDir === 'down' && latestRecord.heartRate < 55
        ? `Heart rate dropped by ${Math.abs(hrDiff)} bpm to a bradycardic ${latestRecord.heartRate} bpm.`
        : hrDir === 'up'
        ? `Heart rate increased (+${Math.abs(hrDiff)} bpm).`
        : hrDir === 'down'
        ? `Heart rate decreased (-${Math.abs(hrDiff)} bpm).`
        : 'Heart rate remains stable.',
    });

    // 4. Body Temperature
    const tempDiff = latestRecord.temperature - previousRecord.temperature;
    let tempDir: 'up' | 'down' | 'stable' = 'stable';
    if (tempDiff > 0.2) tempDir = 'up';
    else if (tempDiff < -0.2) tempDir = 'down';

    const tempIsSpiking = tempDir === 'up' && latestRecord.temperature >= 37.5;
    const tempIsCritical = latestRecord.temperature >= 39.0 && tempDir === 'up';
    list.push({
      metric: 'Temperature',
      direction: tempDir,
      changeValue: Math.abs(tempDiff),
      unit: '°C',
      isAbnormalTrend: tempIsSpiking,
      severity: tempIsCritical ? 'critical' : tempIsSpiking ? 'warning' : 'stable',
      message: tempIsCritical
        ? `Temperature spiking critically. Core: ${latestRecord.temperature.toFixed(1)}°C.`
        : tempIsSpiking
        ? `Fever onset detected. Temperature rose by ${Math.abs(tempDiff).toFixed(1)}°C to ${latestRecord.temperature.toFixed(1)}°C.`
        : tempDir === 'down' && latestRecord.temperature >= 38.0
        ? `Temperature dropped by ${Math.abs(tempDiff).toFixed(1)}°C, but remains febrile at ${latestRecord.temperature.toFixed(1)}°C.`
        : tempDir === 'down'
        ? `Temperature decreased by ${Math.abs(tempDiff).toFixed(1)}°C.`
        : 'Temperature remains stable.',
    });

    // 5. Oxygen Saturation (SpO2)
    if (latestRecord.oxygenSaturation && previousRecord.oxygenSaturation) {
      const o2Diff = latestRecord.oxygenSaturation - previousRecord.oxygenSaturation;
      let o2Dir: 'up' | 'down' | 'stable' = 'stable';
      if (o2Diff > 1) o2Dir = 'up';
      else if (o2Diff < -1) o2Dir = 'down';

      const o2IsDesaturating = o2Dir === 'down' && latestRecord.oxygenSaturation < 95;
      const o2IsCritical = latestRecord.oxygenSaturation < 90;
      list.push({
        metric: 'Oxygen Saturation',
        direction: o2Dir,
        changeValue: Math.abs(o2Diff),
        unit: '%',
        isAbnormalTrend: o2IsDesaturating || o2IsCritical,
        severity: o2IsCritical ? 'critical' : o2IsDesaturating ? 'warning' : 'stable',
        message: o2IsCritical
          ? `Critical hypoxemia detected. Oxygen saturation: ${latestRecord.oxygenSaturation}%.`
          : o2IsDesaturating
          ? `Oxygen saturation dropped by ${Math.abs(o2Diff)}% to a sub-optimal ${latestRecord.oxygenSaturation}%.`
          : o2Dir === 'up'
          ? `Oxygen saturation improved (+${Math.abs(o2Diff)}%).`
          : 'Oxygen saturation remains stable.',
      });
    }

    return list;
  }, [latestRecord, previousRecord]);

  // Generate warning badges based on the latest record
  const warningBadges = useMemo(() => {
    if (!latestRecord) return [];

    const badges: Array<{ label: string; severity: 'critical' | 'high' | 'elevated' | 'hypo'; desc: string; icon: any }> = [];

    // Blood Pressure Warnings
    if (latestRecord.systolicBp >= 180 || latestRecord.diastolicBp >= 120) {
      badges.push({
        label: 'Hypertensive Crisis',
        severity: 'critical',
        desc: `Blood Pressure is critically high at ${latestRecord.systolicBp}/${latestRecord.diastolicBp} mmHg.`,
        icon: Gauge,
      });
    } else if (latestRecord.systolicBp >= 140 || latestRecord.diastolicBp >= 90) {
      badges.push({
        label: 'Stage 2 Hypertension',
        severity: 'high',
        desc: `Significant BP elevation detected: ${latestRecord.systolicBp}/${latestRecord.diastolicBp} mmHg.`,
        icon: Gauge,
      });
    } else if (latestRecord.systolicBp >= 125 || latestRecord.diastolicBp >= 83) {
      badges.push({
        label: 'Elevated Blood Pressure',
        severity: 'elevated',
        desc: `Vitals trend indicates borderline hypertension: ${latestRecord.systolicBp}/${latestRecord.diastolicBp} mmHg.`,
        icon: Gauge,
      });
    } else if (latestRecord.systolicBp < 90 || latestRecord.diastolicBp < 60) {
      badges.push({
        label: 'Hypotension Warning',
        severity: 'hypo',
        desc: `Low blood pressure detected: ${latestRecord.systolicBp}/${latestRecord.diastolicBp} mmHg.`,
        icon: Gauge,
      });
    }

    // Heart Rate Warnings
    if (latestRecord.heartRate >= 125) {
      badges.push({
        label: 'Severe Tachycardia',
        severity: 'critical',
        desc: `Cardiac rate is critically elevated at ${latestRecord.heartRate} bpm.`,
        icon: Heart,
      });
    } else if (latestRecord.heartRate > 100) {
      badges.push({
        label: 'Mild Tachycardia',
        severity: 'high',
        desc: `Resting heart rate exceeds optimal threshold: ${latestRecord.heartRate} bpm.`,
        icon: Heart,
      });
    } else if (latestRecord.heartRate < 50) {
      badges.push({
        label: 'Severe Bradycardia',
        severity: 'critical',
        desc: `Resting heart rate is abnormally slow: ${latestRecord.heartRate} bpm.`,
        icon: Heart,
      });
    }

    // Body Temperature Warnings
    if (latestRecord.temperature >= 39.5) {
      badges.push({
        label: 'Critical Hyperpyrexia',
        severity: 'critical',
        desc: `Extreme body temperature recorded: ${latestRecord.temperature.toFixed(1)}°C.`,
        icon: Thermometer,
      });
    } else if (latestRecord.temperature >= 38.0) {
      badges.push({
        label: 'High Fever',
        severity: 'high',
        desc: `Patient is febrile: ${latestRecord.temperature.toFixed(1)}°C.`,
        icon: Thermometer,
      });
    } else if (latestRecord.temperature < 35.5) {
      badges.push({
        label: 'Hypothermia Danger',
        severity: 'high',
        desc: `Sub-normal body temperature: ${latestRecord.temperature.toFixed(1)}°C.`,
        icon: Thermometer,
      });
    }

    // SpO2 Warnings
    if (latestRecord.oxygenSaturation !== undefined && latestRecord.oxygenSaturation > 0) {
      if (latestRecord.oxygenSaturation < 90) {
        badges.push({
          label: 'Critical Hypoxemia',
          severity: 'critical',
          desc: `Oxygen saturation level is dangerously low at ${latestRecord.oxygenSaturation}%.`,
          icon: Wind,
        });
      } else if (latestRecord.oxygenSaturation < 95) {
        badges.push({
          label: 'Mild Hypoxemia',
          severity: 'elevated',
          desc: `Oxygen saturation level is sub-optimal: ${latestRecord.oxygenSaturation}%.`,
          icon: Wind,
        });
      }
    }

    return badges;
  }, [latestRecord]);

  const activeAbnormalTrendsCount = trends.filter((t) => t.isAbnormalTrend).length;
  const isOk = warningBadges.length === 0 && activeAbnormalTrendsCount === 0;

  const getTrendIcon = (direction: 'up' | 'down' | 'stable', severity: string) => {
    switch (direction) {
      case 'up':
        return <ArrowUp className={`h-4 w-4 ${severity === 'critical' ? 'text-rose-600' : severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />;
      case 'down':
        return <ArrowDown className={`h-4 w-4 ${severity === 'critical' ? 'text-rose-600' : severity === 'warning' ? 'text-amber-500' : 'text-emerald-500'}`} />;
      case 'stable':
      default:
        return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeStyle = (severity: 'critical' | 'high' | 'elevated' | 'hypo') => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white border-red-700 hover:bg-red-700 font-semibold';
      case 'high':
        return 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600 font-medium';
      case 'elevated':
        return 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium';
      case 'hypo':
        return 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-400 font-medium';
    }
  };

  if (loading) {
    return (
      <Card className={`border border-border ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            Analyzing Trends & Alerts...
          </CardTitle>
        </CardHeader>
        <CardContent className="h-24 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Computing telemetry analytics...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border border-border shadow-sm overflow-hidden ${className}`}>
      <CardHeader className="pb-4 bg-muted/20 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${warningBadges.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
              <CardTitle className="text-base font-bold text-foreground">
                Alerts & Trends Summary
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Clinical telemetry analysis and trend monitoring for {patientName}
            </CardDescription>
          </div>
          {latestRecord && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground self-start sm:self-auto bg-background/80 border border-border px-2 py-1 rounded-md">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Last updated: {latestRecord.recordedAt}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {isOk ? (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Patient Biometrics Excellent
              </h5>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Biometric levels comply perfectly with normal baseline thresholds. No clinical concerns or abnormal trends are indicated across blood pressure, cardiac, or hyperthermia metrics.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning Badges Section */}
            {warningBadges.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Active Physiological Warnings ({warningBadges.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {warningBadges.map((badge, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-border bg-card flex items-start gap-3"
                    >
                      <div className={`p-1.5 rounded-md ${badge.severity === 'critical' ? 'bg-red-500/15 text-red-600' : 'bg-rose-500/15 text-rose-500'} shrink-0`}>
                        <badge.icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {badge.label}
                          </span>
                          <Badge className={`text-[10px] px-1.5 py-0 ${getBadgeStyle(badge.severity)}`}>
                            {badge.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {badge.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Longitudinal Trend Analysis */}
            {trends.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Consecutive Trend Trajectory Analysis
                </div>
                <div className="space-y-2">
                  {trends.map((trend, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-md border text-xs flex items-center justify-between gap-4 ${
                        trend.isAbnormalTrend
                          ? trend.severity === 'critical'
                            ? 'bg-red-500/5 border-red-500/30'
                            : 'bg-amber-500/5 border-amber-500/30'
                          : 'bg-muted/10 border-border/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1 rounded-md shrink-0 ${
                          trend.isAbnormalTrend
                            ? trend.severity === 'critical'
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-amber-500/10 text-amber-600'
                            : 'bg-muted/50 text-muted-foreground'
                        }`}>
                          {getTrendIcon(trend.direction, trend.severity)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{trend.metric}</span>
                            {trend.direction !== 'stable' && (
                              <span className={`text-[10px] font-mono ${trend.isAbnormalTrend ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}>
                                ({trend.direction === 'up' ? '+' : '-'}{trend.changeValue.toFixed(1)} {trend.unit})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate" title={trend.message}>
                            {trend.message}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {trend.isAbnormalTrend ? (
                          <Badge variant="destructive" className="text-[9px] uppercase tracking-wider font-semibold py-0">
                            {trend.severity === 'critical' ? 'Unstable Spike' : 'Abnormal Rate'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 py-0 font-medium">
                            Stable
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
