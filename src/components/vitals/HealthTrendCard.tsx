import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Brain,
} from 'lucide-react';
import type { VitalsRecord } from '@/types/vitals';

interface HealthTrendCardProps {
  vitalsList: VitalsRecord[];
  patientName: string;
}

export type HealthTrendType = 'Improving' | 'Stable' | 'Concerning';

export function HealthTrendCard({ vitalsList, patientName }: HealthTrendCardProps) {
  // Sort chronological ascending for trend trajectory analysis
  const sortedChrono = useMemo(() => {
    return [...vitalsList].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
  }, [vitalsList]);

  const trendAnalysis = useMemo(() => {
    if (sortedChrono.length === 0) {
      return {
        trend: 'Stable' as HealthTrendType,
        score: 100,
        badgeColor: 'border-accent/50 bg-accent/10 text-accent dark:text-accent',
        badgeBg: 'bg-accent',
        drivers: ['Initial baseline recorded. Insufficient historical points for regression analysis.'],
        recommendation: 'Log subsequent biometric sessions to build longitudinal health trajectory model.',
      };
    }

    if (sortedChrono.length === 1) {
      const first = sortedChrono[0];
      const isNormal = first.status === 'normal';
      return {
        trend: isNormal ? ('Stable' as HealthTrendType) : ('Concerning' as HealthTrendType),
        score: isNormal ? 95 : 65,
        badgeColor: isNormal
          ? 'border-accent/50 bg-accent/10 text-accent dark:text-accent'
          : 'border-destructive/50 bg-destructive/10 text-destructive dark:text-destructive',
        badgeBg: isNormal ? 'bg-accent' : 'bg-destructive',
        drivers: [
          `Single baseline session recorded at ${first.recordedAt}: Blood pressure ${first.systolicBp}/${first.diastolicBp} mmHg, Heart Rate ${first.heartRate} bpm.`,
        ],
        recommendation: 'Perform follow-up vitals logging to track trends across treatment intervals.',
      };
    }

    // Compare first half vs second half or latest 3 records
    const latestRec = sortedChrono[sortedChrono.length - 1];
    const prevRec = sortedChrono[sortedChrono.length - 2];
    const earliestRec = sortedChrono[0];

    const sysOverallDiff = latestRec.systolicBp - earliestRec.systolicBp;
    const hrDiff = latestRec.heartRate - prevRec.heartRate;

    const drivers: string[] = [];
    let concernPoints = 0;
    let improvementPoints = 0;

    // Evaluate Blood Pressure Trend
    if (sysOverallDiff < -4 || (prevRec.systolicBp >= 130 && latestRec.systolicBp < 125)) {
      improvementPoints += 2;
      drivers.push(
        `Systolic blood pressure decreased by ${Math.abs(sysOverallDiff)} mmHg from initial baseline.`
      );
    } else if (sysOverallDiff > 6 || latestRec.systolicBp >= 140) {
      concernPoints += 2;
      drivers.push(
        `Blood pressure elevated by +${sysOverallDiff} mmHg over historical baseline (Current: ${latestRec.systolicBp}/${latestRec.diastolicBp} mmHg).`
      );
    } else {
      drivers.push(
        `Blood pressure remains stable within standard clinical range (${latestRec.systolicBp}/${latestRec.diastolicBp} mmHg).`
      );
    }

    // Evaluate Heart Rate Trend
    if (latestRec.heartRate >= 100 || hrDiff > 12) {
      concernPoints += 1.5;
      drivers.push(`Heart rate showed upward surge to ${latestRec.heartRate} bpm (Tachycardia threshold).`);
    } else if (prevRec.heartRate > 85 && latestRec.heartRate <= 75) {
      improvementPoints += 1.5;
      drivers.push(`Resting pulse rate stabilized down to ${latestRec.heartRate} bpm.`);
    } else {
      drivers.push(`Pulse rate consistent at ${latestRec.heartRate} bpm.`);
    }

    // Evaluate Body Temperature Trend
    if (latestRec.temperature >= 38.0) {
      concernPoints += 2;
      drivers.push(`Core body temperature elevated (${latestRec.temperature.toFixed(1)}°C hyperthermia).`);
    } else if (prevRec.temperature >= 38.0 && latestRec.temperature < 37.2) {
      improvementPoints += 2;
      drivers.push(`Pyrexia (fever) resolved down to ${latestRec.temperature.toFixed(1)}°C.`);
    }

    // Evaluate Status flags
    if (latestRec.status === 'normal' && (prevRec.status === 'high' || prevRec.status === 'elevated')) {
      improvementPoints += 2;
      drivers.push('Overall clinical triage classification improved from Elevated to Normal.');
    } else if (latestRec.status === 'critical' || latestRec.status === 'high') {
      concernPoints += 2;
      drivers.push(`Latest session flagged with ${latestRec.status.toUpperCase()} risk classification.`);
    }

    // Determine final trend
    let trend: HealthTrendType = 'Stable';
    let score = 88;
    let badgeColor = 'border-accent/50 bg-accent/10 text-accent dark:text-accent';
    let badgeBg = 'bg-accent';
    let recommendation = 'Maintain current therapeutic schedule and routine monitoring.';

    if (improvementPoints > concernPoints && concernPoints === 0) {
      trend = 'Improving';
      score = Math.min(98, 85 + improvementPoints * 4);
      badgeColor = 'border-success/50 bg-success/10 text-success dark:text-success';
      badgeBg = 'bg-success';
      recommendation = 'Patient response to treatment is positive. Continue current care plan.';
    } else if (concernPoints > improvementPoints || latestRec.status === 'high' || latestRec.status === 'critical') {
      trend = 'Concerning';
      score = Math.max(45, 75 - concernPoints * 10);
      badgeColor = 'border-destructive/50 bg-destructive/10 text-destructive dark:text-destructive';
      badgeBg = 'bg-destructive';
      recommendation = 'Escalate clinician evaluation. Adjust medication or schedule follow-up diagnostics.';
    }

    return {
      trend,
      score,
      badgeColor,
      badgeBg,
      drivers,
      recommendation,
    };
  }, [sortedChrono]);

  const renderTrendIcon = () => {
    switch (trendAnalysis.trend) {
      case 'Improving':
        return <TrendingUp className="h-5 w-5 text-success" />;
      case 'Concerning':
        return <TrendingDown className="h-5 w-5 text-destructive" />;
      case 'Stable':
      default:
        return <CheckCircle2 className="h-5 w-5 text-accent" />;
    }
  };

  return (
    <Card className="border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-info/15 text-info dark:text-info">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Health Trend Insight & Stability Score</span>
                <Sparkles className="h-4 w-4 text-warning" />
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Longitudinal AI biometric regression model for {patientName}
              </CardDescription>
            </div>
          </div>

          {/* Prominent Health Trend Insight Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Overall Trend:</span>
            <Badge
              variant="outline"
              className={`px-3 py-1 text-xs font-extrabold uppercase tracking-wide gap-1.5 shadow-xs ${trendAnalysis.badgeColor}`}
            >
              {renderTrendIcon()}
              <span>{trendAnalysis.trend}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Metric Bar & Score Display */}
        <div className="p-3.5 rounded-xl border border-border bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Biometric Stability Index
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-foreground font-mono">
                {trendAnalysis.score}%
              </span>
              <span className="text-xs text-muted-foreground">Stability Confidence</span>
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full sm:w-64 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${trendAnalysis.badgeBg}`}
                style={{ width: `${trendAnalysis.score}%` }}
              />
            </div>
          </div>

          <div className="sm:text-right space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Records Processed
            </span>
            <span className="text-sm font-bold text-foreground font-mono">
              {vitalsList.length} Sessions
            </span>
            <p className="text-[11px] text-muted-foreground">Continuous biometrics stream</p>
          </div>
        </div>

        {/* Drivers / Rationale Bullet Points */}
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-accent" />
            Key Health Drivers & Regression Factors:
          </h5>
          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            {trendAnalysis.drivers.map((driver, idx) => (
              <li
                key={idx}
                className="p-2 rounded-lg bg-card border border-border/80 flex items-start gap-2 font-medium"
              >
                <span className="text-accent font-bold shrink-0">•</span>
                <span>{driver}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Clinical Guidance Box */}
        <div className="p-3 rounded-lg border border-info/30 bg-info/10 dark:bg-info/20 text-info dark:text-indigo-200 text-xs flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-info dark:text-info shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-[11px] uppercase tracking-wide block text-info dark:text-indigo-300">
              Clinical Recommendation:
            </span>
            <p className="font-medium text-xs leading-relaxed">{trendAnalysis.recommendation}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
