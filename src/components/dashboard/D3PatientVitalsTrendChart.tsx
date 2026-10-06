import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Heart, 
  Thermometer, 
  Wind, 
  Calendar, 
  Info, 
  Sliders, 
} from 'lucide-react';

interface VitalDataPoint {
  date: Date;
  dateStr: string;
  systolic: number;
  diastolic: number;
  heartRate: number;
  spO2: number;
  temperature: number;
}

type TimeRange = '30d' | '60d' | '90d' | '180d' | '365d';

interface SeriesToggle {
  key: 'bp' | 'heartRate' | 'spO2' | 'temperature';
  label: string;
  color: string;
  unit: string;
  enabled: boolean;
}

/**
 * Historical vitals for the selected window.
 *
 * This used to synthesise a plausible random walk (blood pressure, heart rate,
 * SpO2, temperature) and render it as a real longitudinal record. There is no
 * vitals endpoint behind this chart, so every reading it showed was invented
 * and labelled with averages and a "Live D3 Engine" badge, i.e. fabricated
 * clinical data presented as a patient's actual history.
 *
 * Returns nothing until a real source exists. The component renders an explicit
 * no-data state; it must not invent readings. See docs/CHANGELOG.md.
 */
function historicalVitals(_daysCount: number): VitalDataPoint[] {
  return [];
}

export function D3PatientVitalsTrendChart() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [timeRange, setTimeRange] = useState<TimeRange>('60d');
  const [hoveredPoint, setHoveredPoint] = useState<VitalDataPoint | null>(null);

  const [seriesToggles, setSeriesToggles] = useState<SeriesToggle[]>([
    { key: 'bp', label: 'Blood Pressure (Systolic/Diastolic)', color: 'var(--chart-1)', unit: 'mmHg', enabled: true },
    { key: 'heartRate', label: 'Heart Rate', color: '#ef4444', unit: 'BPM', enabled: true },
    { key: 'spO2', label: 'Oxygen Saturation (SpO2)', color: '#10b981', unit: '%', enabled: true },
    { key: 'temperature', label: 'Body Temperature', color: '#f59e0b', unit: '°C', enabled: false },
  ]);

  const fullData = useMemo(() => {
    const daysCountMap: Record<TimeRange, number> = {
      '30d': 30,
      '60d': 60,
      '90d': 90,
      '180d': 180,
      '365d': 365,
    };
    return historicalVitals(daysCountMap[timeRange]);
  }, [timeRange]);

  // Statistical calculations using D3
  const stats = useMemo(() => {
    if (!fullData.length) return null;

    const avgSystolic = Math.round(d3.mean(fullData, (d) => d.systolic) || 0);
    const avgDiastolic = Math.round(d3.mean(fullData, (d) => d.diastolic) || 0);
    const avgHR = Math.round(d3.mean(fullData, (d) => d.heartRate) || 0);
    const avgSpO2 = Number((d3.mean(fullData, (d) => d.spO2) || 0).toFixed(1));
    const avgTemp = Number((d3.mean(fullData, (d) => d.temperature) || 0).toFixed(1));

    const bpExtent = d3.extent(fullData, (d) => d.systolic) as [number, number];
    const hrExtent = d3.extent(fullData, (d) => d.heartRate) as [number, number];

    return {
      avgSystolic,
      avgDiastolic,
      avgHR,
      avgSpO2,
      avgTemp,
      bpExtent,
      hrExtent,
    };
  }, [fullData]);

  const toggleSeries = (key: SeriesToggle['key']) => {
    setSeriesToggles((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Render D3 SVG Chart
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !fullData.length) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = 360;
    const margin = { top: 24, right: 36, bottom: 40, left: 48 };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%').attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // D3 Scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(fullData, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    // Primary Y Scale (BP & Heart Rate)
    const yScalePrimary = d3
      .scaleLinear()
      .domain([
        Math.min(50, d3.min(fullData, (d) => Math.min(d.diastolic, d.heartRate))! - 10),
        Math.max(160, d3.max(fullData, (d) => d.systolic)! + 10),
      ])
      .nice()
      .range([innerHeight, 0]);

    // Secondary Y Scale (SpO2 & Temperature)
    const yScaleSecondary = d3
      .scaleLinear()
      .domain([35, 102])
      .range([innerHeight, 0]);

    // Grid lines
    const yAxisGrid = d3
      .axisLeft(yScalePrimary)
      .tickSize(-innerWidth)
      .tickFormat(() => '')
      .ticks(6);

    g.append('g')
      .attr('class', 'grid-lines')
      .style('stroke', '#334155')
      .style('stroke-opacity', '0.15')
      .style('stroke-dasharray', '3,3')
      .call(yAxisGrid)
      .selectAll('line')
      .attr('stroke', 'currentColor');

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(width < 500 ? 5 : 8)
      .tickFormat((d) => d3.timeFormat('%b %d')(d as Date));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .attr('class', 'x-axis')
      .call(xAxis)
      .style('font-size', '11px')
      .style('color', '#64748b')
      .selectAll('path, line')
      .attr('stroke', '#cbd5e1');

    // Left Y Axis
    const yAxisLeft = d3.axisLeft(yScalePrimary).ticks(6);
    g.append('g')
      .attr('class', 'y-axis-left')
      .call(yAxisLeft)
      .style('font-size', '11px')
      .style('color', '#64748b')
      .selectAll('path, line')
      .attr('stroke', 'transparent');

    // Gradient Definitions
    const defs = svg.append('defs');

    // BP Gradient
    const sysGrad = defs
      .append('linearGradient')
      .attr('id', 'sys-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    sysGrad.append('stop').attr('offset', '0%').attr('stop-color', '#3b82f6').attr('stop-opacity', '0.25');
    sysGrad.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', '0.0');

    // HR Gradient
    const hrGrad = defs
      .append('linearGradient')
      .attr('id', 'hr-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    hrGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444').attr('stop-opacity', '0.20');
    hrGrad.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444').attr('stop-opacity', '0.0');

    // Is BP Enabled?
    const isBpEnabled = seriesToggles.find((s) => s.key === 'bp')?.enabled;
    const isHrEnabled = seriesToggles.find((s) => s.key === 'heartRate')?.enabled;
    const isSpO2Enabled = seriesToggles.find((s) => s.key === 'spO2')?.enabled;
    const isTempEnabled = seriesToggles.find((s) => s.key === 'temperature')?.enabled;

    // Draw BP Systolic & Area
    if (isBpEnabled) {
      const areaSys = d3
        .area<VitalDataPoint>()
        .x((d) => xScale(d.date))
        .y0(innerHeight)
        .y1((d) => yScalePrimary(d.systolic))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(fullData)
        .attr('fill', 'url(#sys-gradient)')
        .attr('d', areaSys);

      const lineSys = d3
        .line<VitalDataPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScalePrimary(d.systolic))
        .curve(d3.curveMonotoneX);

      const sysPath = g
        .append('path')
        .datum(fullData)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2.5)
        .attr('d', lineSys);

      // Path length animation
      const sysLen = (sysPath.node() as SVGPathElement)?.getTotalLength() || 1000;
      sysPath
        .attr('stroke-dasharray', `${sysLen} ${sysLen}`)
        .attr('stroke-dashoffset', sysLen)
        .transition()
        .duration(1200)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);

      // Diastolic Line
      const lineDia = d3
        .line<VitalDataPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScalePrimary(d.diastolic))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(fullData)
        .attr('fill', 'none')
        .attr('stroke', '#60a5fa')
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '4,3')
        .attr('d', lineDia);
    }

    // Draw Heart Rate Line & Area
    if (isHrEnabled) {
      const areaHr = d3
        .area<VitalDataPoint>()
        .x((d) => xScale(d.date))
        .y0(innerHeight)
        .y1((d) => yScalePrimary(d.heartRate))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(fullData)
        .attr('fill', 'url(#hr-gradient)')
        .attr('d', areaHr);

      const lineHr = d3
        .line<VitalDataPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScalePrimary(d.heartRate))
        .curve(d3.curveMonotoneX);

      const hrPath = g
        .append('path')
        .datum(fullData)
        .attr('fill', 'none')
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2.2)
        .attr('d', lineHr);

      const hrLen = (hrPath.node() as SVGPathElement)?.getTotalLength() || 1000;
      hrPath
        .attr('stroke-dasharray', `${hrLen} ${hrLen}`)
        .attr('stroke-dashoffset', hrLen)
        .transition()
        .duration(1200)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    }

    // Draw SpO2 Line
    if (isSpO2Enabled) {
      const lineSpO2 = d3
        .line<VitalDataPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScaleSecondary(d.spO2))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(fullData)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2)
        .attr('d', lineSpO2);
    }

    // Draw Temperature Line
    if (isTempEnabled) {
      const lineTemp = d3
        .line<VitalDataPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScaleSecondary(d.temperature * 2.5))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(fullData)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,3')
        .attr('d', lineTemp);
    }

    // Crosshair Cursor & Hover Tracking
    const focusG = g.append('g').style('display', 'none');

    // Vertical dashed line
    focusG
      .append('line')
      .attr('class', 'focus-line-x')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,3');

    // Hover dots
    if (isBpEnabled) {
      focusG
        .append('circle')
        .attr('class', 'dot-sys')
        .attr('r', 5)
        .attr('fill', '#3b82f6')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);
    }
    if (isHrEnabled) {
      focusG
        .append('circle')
        .attr('class', 'dot-hr')
        .attr('r', 5)
        .attr('fill', '#ef4444')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);
    }
    if (isSpO2Enabled) {
      focusG
        .append('circle')
        .attr('class', 'dot-spo2')
        .attr('r', 5)
        .attr('fill', '#10b981')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2);
    }

    // Overlay rect for mouse interaction
    const bisectDate = d3.bisector<VitalDataPoint, Date>((d) => d.date).left;

    svg
      .append('rect')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .on('mouseenter', () => focusG.style('display', null))
      .on('mouseleave', () => {
        focusG.style('display', 'none');
        setHoveredPoint(null);
      })
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx);
        const i = bisectDate(fullData, x0, 1);
        const d0 = fullData[i - 1];
        const d1 = fullData[i];
        let d = d0;
        if (d1 && d0) {
          d = x0.getTime() - d0.date.getTime() > d1.date.getTime() - x0.getTime() ? d1 : d0;
        }

        if (d) {
          const cx = xScale(d.date);
          focusG.select('.focus-line-x').attr('transform', `translate(${cx},0)`);

          if (isBpEnabled) {
            focusG
              .select('.dot-sys')
              .attr('cx', cx)
              .attr('cy', yScalePrimary(d.systolic));
          }
          if (isHrEnabled) {
            focusG
              .select('.dot-hr')
              .attr('cx', cx)
              .attr('cy', yScalePrimary(d.heartRate));
          }
          if (isSpO2Enabled) {
            focusG
              .select('.dot-spo2')
              .attr('cx', cx)
              .attr('cy', yScaleSecondary(d.spO2));
          }

          setHoveredPoint(d);
        }
      });
  }, [fullData, seriesToggles]);

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Activity className="h-5 w-5 text-accent animate-pulse" />
              <span>Patient Health Vitals Trend Analytics</span>
              <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 text-accent">
                Pending data
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Longitudinal tracking of average patient blood pressure, heart rate, oxygen saturation, and temperature.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Timeframe Selector */}
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/60">
              {(['30d', '60d', '90d', '180d', '365d'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    timeRange === range
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistical Overview Bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0">
                <Heart className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Avg Blood Pressure</span>
                <span className="text-sm font-bold text-foreground">
                  {stats.avgSystolic}/{stats.avgDiastolic} <span className="text-[10px] font-normal text-muted-foreground">mmHg</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Avg Heart Rate</span>
                <span className="text-sm font-bold text-foreground">
                  {stats.avgHR} <span className="text-[10px] font-normal text-muted-foreground">BPM</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-success/10 text-success shrink-0">
                <Wind className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Avg SpO2 Level</span>
                <span className="text-sm font-bold text-foreground">
                  {stats.avgSpO2}% <span className="text-[10px] font-normal text-success font-semibold">Optimal</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-warning/10 text-warning shrink-0">
                <Thermometer className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Avg Temperature</span>
                <span className="text-sm font-bold text-foreground">
                  {stats.avgTemp}°C
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Series Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Sliders className="h-3.5 w-3.5" /> Series:
            </span>
            {seriesToggles.map((series) => (
              <Button
                key={series.key}
                variant="outline"
                size="sm"
                onClick={() => toggleSeries(series.key)}
                className={`h-7 text-xs font-semibold gap-1.5 px-2.5 transition-all ${
                  series.enabled
                    ? 'border-border bg-card text-foreground shadow-xs'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {/* The series colour rides on a swatch, never as the button's
                    own background. Filling the button forced a hardcoded
                    text-white over a data-driven surface, which measured 2.1:1
                    -- white on white whenever the series colour resolved light. */}
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border"
                  style={{
                    backgroundColor: series.color,
                    opacity: series.enabled ? 1 : 0.35,
                  }}
                />
                <span>{series.label}</span>
              </Button>
            ))}
          </div>

          {/* Hover tooltip output */}
          {hoveredPoint ? (
            <div className="flex items-center gap-3 px-3 py-1 bg-background border border-border rounded-lg text-xs font-medium animate-fadeIn">
              <span className="font-bold text-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" /> {hoveredPoint.dateStr}
              </span>
              <span className="text-accent dark:text-accent font-bold">
                BP: {hoveredPoint.systolic}/{hoveredPoint.diastolic} mmHg
              </span>
              <span className="text-destructive dark:text-destructive font-bold">
                HR: {hoveredPoint.heartRate} BPM
              </span>
              <span className="text-success dark:text-success font-bold">
                SpO2: {hoveredPoint.spO2}%
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
              <Info className="h-3 w-3" /> Hover over curve to inspect exact date reading
            </span>
          )}
        </div>

        {/* D3 Render Container */}
        {fullData.length === 0 ? (
          <div
            ref={containerRef}
            className="flex flex-col items-center justify-center gap-2 w-full min-h-[340px] rounded-lg border border-dashed border-border bg-muted/20 text-center px-6"
          >
            <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No recorded vitals</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              This panel charts a patient&apos;s recorded history. Nothing has been
              charted yet, so there is nothing to display here. Readings appear once
              they are captured from a patient record.
            </p>
          </div>
        ) : (
          <div ref={containerRef} className="w-full relative min-h-[340px]">
            <svg ref={svgRef} className="w-full h-[360px] overflow-visible" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
