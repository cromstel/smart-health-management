import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, CheckCircle2, ShieldAlert, Activity } from 'lucide-react';
import { toast } from 'sonner';
import type { VitalsRecord } from '@/types/vitals';

interface DiagnosticOutlier {
  id: string;
  metric: 'systolic' | 'diastolic' | 'heartRate' | 'temperature' | 'spO2' | 'respiratoryRate';
  metricLabel: string;
  value: string;
  normalRange: string;
  severity: 'critical' | 'high' | 'moderate';
  message: string;
  clinicalGuideline: string;
}

interface DiagnosticHelperBannerProps {
  latestVital?: VitalsRecord;
  patientName: string;
  patientId: string;
  onNotifyClinician?: () => void;
}

export function DiagnosticHelperBanner({
  latestVital,
  patientName,
  patientId,
  onNotifyClinician,
}: DiagnosticHelperBannerProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [notified, setNotified] = useState(false);

  // Compute outliers from latest vital reading
  const outliers = useMemo(() => {
    if (!latestVital) return [];

    const list: DiagnosticOutlier[] = [];

    // 1. Blood Pressure Outlier
    if (latestVital.systolicBp >= 140 || latestVital.diastolicBp >= 90) {
      const isCritical = latestVital.systolicBp >= 180 || latestVital.diastolicBp >= 120;
      list.push({
        id: 'bp-high',
        metric: 'systolic',
        metricLabel: 'Blood Pressure',
        value: `${latestVital.systolicBp}/${latestVital.diastolicBp} mmHg`,
        normalRange: '90–120 / 60–80 mmHg',
        severity: isCritical ? 'critical' : 'high',
        message: isCritical
          ? 'Hypertensive Crisis: Abnormally elevated blood pressure.'
          : 'Stage 2 Hypertension Outlier: Blood pressure exceeds normal upper threshold.',
        clinicalGuideline: 'AHA Guideline: Evaluate for target organ strain and initiate blood pressure control.',
      });
    } else if (latestVital.systolicBp < 90 || latestVital.diastolicBp < 60) {
      list.push({
        id: 'bp-low',
        metric: 'systolic',
        metricLabel: 'Blood Pressure',
        value: `${latestVital.systolicBp}/${latestVital.diastolicBp} mmHg`,
        normalRange: '90–120 / 60–80 mmHg',
        severity: 'high',
        message: 'Hypotension Outlier: Abnormally low blood pressure reading.',
        clinicalGuideline: 'Check fluid status, orthostatic changes, or medication side effects.',
      });
    }

    // 2. Heart Rate Outlier
    if (latestVital.heartRate >= 100) {
      const isCritical = latestVital.heartRate >= 130;
      list.push({
        id: 'hr-high',
        metric: 'heartRate',
        metricLabel: 'Heart Rate (Pulse)',
        value: `${latestVital.heartRate} bpm`,
        normalRange: '60–100 bpm',
        severity: isCritical ? 'critical' : 'high',
        message: 'Tachycardia Outlier: Pulse rate significantly elevated.',
        clinicalGuideline: 'Monitor ECG rhythm, evaluate stress, fever, or cardiac arrhythmia.',
      });
    } else if (latestVital.heartRate < 50) {
      list.push({
        id: 'hr-low',
        metric: 'heartRate',
        metricLabel: 'Heart Rate (Pulse)',
        value: `${latestVital.heartRate} bpm`,
        normalRange: '60–100 bpm',
        severity: 'high',
        message: 'Bradycardia Outlier: Abnormally low resting heart rate.',
        clinicalGuideline: 'Evaluate athletic baseline vs. SA node dysfunction or beta-blocker overdose.',
      });
    }

    // 3. Body Temperature Outlier
    if (latestVital.temperature >= 38.0) {
      const isCritical = latestVital.temperature >= 39.5;
      list.push({
        id: 'temp-high',
        metric: 'temperature',
        metricLabel: 'Body Temperature',
        value: `${latestVital.temperature.toFixed(1)} °C`,
        normalRange: '36.1–37.2 °C',
        severity: isCritical ? 'critical' : 'high',
        message: 'Pyrexia (Fever) Outlier: Temperature exceeds hyperthermic threshold.',
        clinicalGuideline: 'Initiate fever reduction, order CBC/CRP, and screen for acute infection.',
      });
    } else if (latestVital.temperature < 35.0) {
      list.push({
        id: 'temp-low',
        metric: 'temperature',
        metricLabel: 'Body Temperature',
        value: `${latestVital.temperature.toFixed(1)} °C`,
        normalRange: '36.1–37.2 °C',
        severity: 'high',
        message: 'Hypothermia Outlier: Core temperature below safe range.',
        clinicalGuideline: 'Provide active rewarming and monitor electrolyte balance.',
      });
    }

    // 4. Oxygen Saturation Outlier
    if (latestVital.oxygenSaturation && latestVital.oxygenSaturation < 92) {
      const isCritical = latestVital.oxygenSaturation < 88;
      list.push({
        id: 'spo2-low',
        metric: 'spO2',
        metricLabel: 'Oxygen Saturation (SpO2)',
        value: `${latestVital.oxygenSaturation}%`,
        normalRange: '95–100%',
        severity: isCritical ? 'critical' : 'high',
        message: 'Hypoxemia Outlier: Blood oxygen saturation below safe physiological levels.',
        clinicalGuideline: 'Administer supplemental oxygen therapy immediately and assess airway clearance.',
      });
    }

    return list;
  }, [latestVital]);

  // Trigger immediate alert to clinician when outliers are detected
  useEffect(() => {
    if (outliers.length > 0 && !acknowledged) {
      const primaryOutlier = outliers[0];
      toast.error(`DIAGNOSTIC ALERT: ${primaryOutlier.metricLabel} Outlier!`, {
        description: `Patient ${patientName} (${patientId}): Recorded ${primaryOutlier.value}. ${primaryOutlier.message}`,
        duration: 8000,
      });
    }
  }, [outliers, patientName, patientId, acknowledged]);

  if (!latestVital || outliers.length === 0) {
    return (
      <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold">Diagnostic Helper Check: Nominal Vitals</span>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 opacity-90">
              All biometrics (BP, Pulse, Temperature, SpO2) are within standard clinical physiological thresholds.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px]">
          No Outliers
        </Badge>
      </div>
    );
  }

  const handleTriggerNotification = () => {
    setNotified(true);
    if (onNotifyClinician) onNotifyClinician();
    toast.success(`Stat diagnostic alert dispatched to attending clinician for ${patientName}`, {
      description: `Notified regarding ${outliers.length} active outlier parameter(s).`,
    });
  };

  return (
    <Card className="border-2 border-rose-500/80 bg-rose-50/70 dark:bg-rose-950/40 shadow-sm overflow-hidden">
      <div className="bg-rose-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 animate-bounce" />
          <span>DIAGNOSTIC HELPER: OUTLIER PARAMETER ALERT DETECTED ({outliers.length})</span>
        </div>
        <Badge variant="secondary" className="bg-white text-rose-700 text-[10px] uppercase font-extrabold">
          Immediate Action Required
        </Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        <div className="text-xs text-rose-950 dark:text-rose-200">
          <p className="font-semibold text-sm mb-1 text-rose-900 dark:text-rose-100">
            Outlier biometrics recorded for <span className="underline">{patientName}</span> ({patientId}) at{' '}
            <span className="font-mono">{latestVital.recordedAt}</span>:
          </p>
        </div>

        {/* Outliers List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {outliers.map((outlier) => (
            <div
              key={outlier.id}
              className="p-3 rounded-lg border-2 border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-sm space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  {outlier.metricLabel}
                </span>
                {/* Outlier value highlighted in bold red */}
                <span className="font-mono font-extrabold text-sm text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800">
                  {outlier.value}
                </span>
              </div>

              <div className="text-[11px] text-rose-800 dark:text-rose-300 font-medium leading-tight">
                {outlier.message}
              </div>

              <div className="text-[10px] text-muted-foreground pt-1 border-t border-rose-100 dark:border-slate-800 flex justify-between">
                <span>Normal Target: {outlier.normalRange}</span>
                <span className="text-rose-600 font-semibold uppercase">{outlier.severity}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-rose-200 dark:border-rose-900/60 text-xs">
          <div className="text-[11px] text-rose-800 dark:text-rose-300 italic flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-rose-600 shrink-0" />
            <span>Automatic diagnostic telemetry system flagged outlier bounds.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!acknowledged ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-rose-300 text-rose-800 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-950"
                onClick={() => setAcknowledged(true)}
              >
                Acknowledge Alert
              </Button>
            ) : (
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Alert Acknowledged
              </span>
            )}

            <Button
              size="sm"
              className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5 shadow-sm"
              onClick={handleTriggerNotification}
              disabled={notified}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>{notified ? 'Clinician Notified' : 'Dispatch Stat Alert'}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
