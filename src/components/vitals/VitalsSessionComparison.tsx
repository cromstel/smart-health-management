import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Heart,
  Thermometer,
  Wind,
  Gauge,
  History,
  Clock,
} from 'lucide-react';
import type { VitalsRecord } from '@/types/vitals';

interface VitalsSessionComparisonProps {
  vitalsList: VitalsRecord[];
  tempUnit?: 'C' | 'F';
}

export function VitalsSessionComparison({
  vitalsList,
  tempUnit = 'C',
}: VitalsSessionComparisonProps) {
  // Sort chronological descending (most recent first)
  const sortedRecords = useMemo(() => {
    return [...vitalsList].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
  }, [vitalsList]);

  const currentRecord = sortedRecords[0];
  const previousRecord = sortedRecords[1];

  if (!currentRecord) {
    return (
      <Card className="border border-border">
        <CardContent className="p-6 text-center text-xs text-muted-foreground">
          No vitals sessions recorded to perform side-by-side baseline comparison.
        </CardContent>
      </Card>
    );
  }

  // Formatting helpers
  const formatTemp = (valC: number) => {
    if (tempUnit === 'F') {
      return `${((valC * 9) / 5 + 32).toFixed(1)} °F`;
    }
    return `${valC.toFixed(1)} °C`;
  };

  // Delta calculation helpers
  const sysDelta = previousRecord ? currentRecord.systolicBp - previousRecord.systolicBp : 0;
  const hrDelta = previousRecord ? currentRecord.heartRate - previousRecord.heartRate : 0;
  const tempDeltaC = previousRecord ? currentRecord.temperature - previousRecord.temperature : 0;
  const spo2Delta =
    previousRecord && currentRecord.oxygenSaturation && previousRecord.oxygenSaturation
      ? currentRecord.oxygenSaturation - previousRecord.oxygenSaturation
      : 0;

  // Helper for trend badge
  const renderDeltaBadge = (
    delta: number,
    unit: string,
    favorableIsDecrease: boolean = true
  ) => {
    if (!previousRecord || delta === 0) {
      return (
        <Badge variant="outline" className="text-[10px] gap-1 border-slate-300 text-slate-600 dark:text-slate-400">
          <Minus className="h-3 w-3" />
          <span>No Change</span>
        </Badge>
      );
    }

    const isDecrease = delta < 0;
    const isFavorable = favorableIsDecrease ? isDecrease : !isDecrease;

    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-bold gap-1 ${
          isFavorable
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400'
        }`}
      >
        {isDecrease ? (
          <ArrowDownRight className="h-3 w-3" />
        ) : (
          <ArrowUpRight className="h-3 w-3" />
        )}
        <span>
          {delta > 0 ? `+${delta}` : delta} {unit}
        </span>
      </Badge>
    );
  };

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Side-by-Side Session Baseline Comparison
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Comparing Current Session against Previous Recorded Baseline
              </CardDescription>
            </div>
          </div>

          <Badge variant="secondary" className="text-[11px] font-semibold w-fit">
            {previousRecord ? '2 Sessions Analyzed' : 'Baseline Reference Established'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Session Metadata Headers */}
        <div className="grid grid-cols-2 gap-4 text-xs font-semibold p-2.5 rounded-lg bg-muted/60 border border-border text-center">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Current Session
            </span>
            <div className="text-foreground font-bold flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5 text-accent" />
              <span>{currentRecord.recordedAt}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-normal">By {currentRecord.recordedBy}</p>
          </div>

          <div className="space-y-0.5 border-l border-border pl-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Previous Session Baseline
            </span>
            {previousRecord ? (
              <>
                <div className="text-foreground font-bold flex items-center justify-center gap-1">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{previousRecord.recordedAt}</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-normal">By {previousRecord.recordedBy}</p>
              </>
            ) : (
              <p className="text-xs italic text-muted-foreground pt-1">
                No previous baseline record available
              </p>
            )}
          </div>
        </div>

        {/* Biometrics Comparison Table / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Blood Pressure */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 hover:border-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4 text-indigo-500" />
                Blood Pressure
              </span>
              {renderDeltaBadge(sysDelta, 'mmHg', true)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-border/50">
              <div className="p-2 rounded bg-sky-500/10 dark:bg-sky-950/30">
                <span className="text-[10px] text-muted-foreground block font-medium">Current</span>
                <span className="text-base font-extrabold text-foreground font-mono">
                  {currentRecord.systolicBp}/{currentRecord.diastolicBp}
                </span>
                <span className="text-[9px] text-muted-foreground block">mmHg</span>
              </div>
              <div className="p-2 rounded bg-muted/60">
                <span className="text-[10px] text-muted-foreground block font-medium">Baseline</span>
                <span className="text-base font-extrabold text-muted-foreground font-mono">
                  {previousRecord ? `${previousRecord.systolicBp}/${previousRecord.diastolicBp}` : '--'}
                </span>
                <span className="text-[9px] text-muted-foreground block">mmHg</span>
              </div>
            </div>
          </div>

          {/* 2. Heart Rate */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 hover:border-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-rose-500 animate-pulse" />
                Heart Rate (Pulse)
              </span>
              {renderDeltaBadge(hrDelta, 'bpm', true)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-border/50">
              <div className="p-2 rounded bg-rose-500/10 dark:bg-rose-950/30">
                <span className="text-[10px] text-muted-foreground block font-medium">Current</span>
                <span className="text-base font-extrabold text-foreground font-mono">
                  {currentRecord.heartRate}
                </span>
                <span className="text-[9px] text-muted-foreground block">bpm</span>
              </div>
              <div className="p-2 rounded bg-muted/60">
                <span className="text-[10px] text-muted-foreground block font-medium">Baseline</span>
                <span className="text-base font-extrabold text-muted-foreground font-mono">
                  {previousRecord ? previousRecord.heartRate : '--'}
                </span>
                <span className="text-[9px] text-muted-foreground block">bpm</span>
              </div>
            </div>
          </div>

          {/* 3. Body Temperature */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 hover:border-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Thermometer className="h-4 w-4 text-amber-500" />
                Body Temp
              </span>
              {renderDeltaBadge(
                parseFloat(
                  (tempUnit === 'F' ? (tempDeltaC * 9) / 5 : tempDeltaC).toFixed(1)
                ),
                `°${tempUnit}`,
                true
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-border/50">
              <div className="p-2 rounded bg-amber-500/10 dark:bg-amber-950/30">
                <span className="text-[10px] text-muted-foreground block font-medium">Current</span>
                <span className="text-base font-extrabold text-foreground font-mono">
                  {formatTemp(currentRecord.temperature)}
                </span>
              </div>
              <div className="p-2 rounded bg-muted/60">
                <span className="text-[10px] text-muted-foreground block font-medium">Baseline</span>
                <span className="text-base font-extrabold text-muted-foreground font-mono">
                  {previousRecord ? formatTemp(previousRecord.temperature) : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Oxygen Saturation */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 hover:border-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Wind className="h-4 w-4 text-emerald-500" />
                Oxygen Saturation
              </span>
              {renderDeltaBadge(spo2Delta, '%', false)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-border/50">
              <div className="p-2 rounded bg-emerald-500/10 dark:bg-emerald-950/30">
                <span className="text-[10px] text-muted-foreground block font-medium">Current</span>
                <span className="text-base font-extrabold text-foreground font-mono">
                  {currentRecord.oxygenSaturation ? `${currentRecord.oxygenSaturation}%` : '--'}
                </span>
              </div>
              <div className="p-2 rounded bg-muted/60">
                <span className="text-[10px] text-muted-foreground block font-medium">Baseline</span>
                <span className="text-base font-extrabold text-muted-foreground font-mono">
                  {previousRecord && previousRecord.oxygenSaturation
                    ? `${previousRecord.oxygenSaturation}%`
                    : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
