import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flame, Clock, Calendar, Users, AlertCircle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM'
];

// Generate a rich mock dataset of appointment densities
const BASE_DENSITY_DATA: Record<string, Record<string, { count: number; details: string[] }>> = {};

const MOCK_DEPARTMENTS = ['All Departments', 'Cardiology', 'Pediatrics', 'General Medicine', 'Orthopedics'];
const MOCK_DOCTORS = ['All Doctors', 'Dr. Michael Chen', 'Dr. Emily Davis', 'Dr. Robert Lee'];

// Fill BASE_DENSITY_DATA with realistic patterns
DAYS.forEach((day) => {
  BASE_DENSITY_DATA[day] = {};
  HOURS.forEach((hour) => {
    // Generate patterns: mornings are busier, weekends are slow, lunch hour (12 PM) is moderate
    let count: number;
    const isWeekend = day === 'Saturday' || day === 'Sunday';
    
    if (isWeekend) {
      count = day === 'Saturday' && (hour === '09:00 AM' || hour === '10:00 AM') ? 3 : 0;
    } else {
      if (hour === '10:00 AM' || hour === '11:00 AM') {
        count = day === 'Monday' || day === 'Wednesday' ? 9 : 7; // Peak
      } else if (hour === '09:00 AM' || hour === '02:00 PM' || hour === '03:00 PM') {
        count = 5; // Moderate-heavy
      } else if (hour === '12:00 PM') {
        count = 2; // Lunch block (light)
      } else {
        count = 4; // Moderate
      }
    }

    // Generate details matching the counts
    const details: string[] = [];
    if (count > 0) {
      details.push('Routine Consultation');
    }
    if (count >= 3) {
      details.push('Follow-up Checkup', 'Diagnostic Review');
    }
    if (count >= 6) {
      details.push('Treatment/Therapy Session', 'Consultation with Specialist');
    }
    if (count >= 8) {
      details.push('Urgent Walk-in Care');
    }

    BASE_DENSITY_DATA[day][hour] = { count, details };
  });
});

export default function AppointmentDensityHeatMap() {
  const [department, setDepartment] = useState('All Departments');
  const [doctor, setDoctor] = useState('All Doctors');
  const [selectedCell, setSelectedCell] = useState<{ day: string; hour: string } | null>({
    day: 'Monday',
    hour: '10:00 AM'
  });

  // Dynamically compute grid density based on filters
  const getCellData = (day: string, hour: string) => {
    const base = BASE_DENSITY_DATA[day]?.[hour] || { count: 0, details: [] };
    
    // Scale multiplier based on selection to simulate active filters
    let multiplier = 1.0;
    if (department !== 'All Departments') {
      multiplier *= 0.35; // single department represents a fraction of load
    }
    if (doctor !== 'All Doctors') {
      multiplier *= 0.25; // single doctor represents a fraction of load
    }

    const count = Math.round(base.count * multiplier);
    
    // Adjust details matching filter
    const details = base.details.slice(0, count);
    if (details.length === 0 && count > 0) {
      details.push('Consultation');
    }

    return { count, details };
  };

  // Maps a density count to modern solid Tailwind classes
  const getDensityColor = (count: number) => {
    if (count === 0) return 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100 hover:dark:bg-slate-800';
    if (count <= 2) return 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-950/40 hover:bg-indigo-100/80';
    if (count <= 5) return 'bg-indigo-200 dark:bg-indigo-800/50 text-indigo-900 dark:text-indigo-200 border-indigo-200/50 dark:border-indigo-800/80 hover:bg-indigo-300 dark:hover:bg-indigo-800';
    if (count <= 8) return 'bg-indigo-400 dark:bg-indigo-600 text-white border-indigo-400 hover:bg-indigo-500';
    return 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 hover:bg-indigo-700';
  };

  const selectedCellData = selectedCell ? getCellData(selectedCell.day, selectedCell.hour) : null;

  return (
    <Card className="border border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Flame className="h-5 w-5 text-indigo-500" />
              Appointment Density Heat Map
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Analyze peak operational hours and patient flow distribution across the work week.
            </p>
          </div>

          {/* Interactive Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Dept:</span>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept} className="text-xs">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Clinician:</span>
              <Select value={doctor} onValueChange={setDoctor}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Doctor" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_DOCTORS.map((doc) => (
                    <SelectItem key={doc} value={doc} className="text-xs">
                      {doc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Heat Map Matrix */}
        <div className="overflow-x-auto select-none rounded-lg border border-border/80 p-4 bg-muted/20">
          <div className="min-w-[760px] space-y-2">
            {/* Day Headers */}
            <div className="grid grid-cols-10 gap-1 text-center font-semibold text-xs text-muted-foreground pb-2">
              <div className="col-span-1 text-left flex items-center">Hour Block</div>
              {DAYS.map((day) => (
                <div key={day} className="col-span-1 py-1 truncate" title={day}>
                  {day.substring(0, 3)}
                </div>
              ))}
              <div className="col-span-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground/60 flex items-center justify-end">
                Daily Load
              </div>
            </div>

            {/* Matrix Rows */}
            {HOURS.map((hour) => {
              // Calculate horizontal sum for this hour
              let hourTotal = 0;
              DAYS.forEach((day) => {
                hourTotal += getCellData(day, hour).count;
              });

              return (
                <div key={hour} className="grid grid-cols-10 gap-1 text-center items-center">
                  {/* Hour Label */}
                  <div className="col-span-1 text-left text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0 opacity-60" />
                    {hour.replace(':00', '')}
                  </div>

                  {/* Heatmap cells */}
                  {DAYS.map((day) => {
                    const data = getCellData(day, hour);
                    const isSelected = selectedCell?.day === day && selectedCell?.hour === hour;

                    return (
                      <div
                        key={day}
                        onClick={() => setSelectedCell({ day, hour })}
                        className={`col-span-1 aspect-square md:h-10 md:w-10 mx-auto rounded-md flex flex-col items-center justify-center cursor-pointer border font-semibold text-xs transition-all duration-150 ${getDensityColor(
                          data.count
                        )} ${
                          isSelected 
                            ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-card border-indigo-500 shadow-md transform scale-105 z-10' 
                            : 'hover:scale-105 hover:shadow-sm'
                        }`}
                        title={`${day} @ ${hour}: ${data.count} Appointments`}
                      >
                        {data.count > 0 ? data.count : ''}
                      </div>
                    );
                  })}

                  {/* Hour Total Load Gauge */}
                  <div className="col-span-2 pl-3 flex items-center gap-2 justify-end">
                    <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500/80 rounded-full"
                        style={{ width: `${Math.min(100, (hourTotal / 30) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground min-w-[14px]">
                      {hourTotal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend & Details Panel Grid */}
        <div className="grid gap-4 md:grid-cols-12 items-start">
          {/* Legend */}
          <div className="md:col-span-4 p-4 rounded-lg border border-border/80 bg-card/60 space-y-3.5">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Appointment Scale
            </h5>
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex flex-col items-center gap-1">
                <div className="h-6 w-6 rounded border bg-slate-50 dark:bg-slate-900/40" />
                <span className="text-[10px] text-muted-foreground">Idle (0)</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-6 w-6 rounded border bg-indigo-50 dark:bg-indigo-950/20" />
                <span className="text-[10px] text-muted-foreground">Light (1-2)</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-6 w-6 rounded border bg-indigo-200 dark:bg-indigo-800/50" />
                <span className="text-[10px] text-muted-foreground">Mod (3-5)</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-6 w-6 rounded border bg-indigo-400 dark:bg-indigo-600" />
                <span className="text-[10px] text-muted-foreground">Heavy (6-8)</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-6 w-6 rounded border bg-indigo-600 dark:bg-indigo-500" />
                <span className="text-[10px] text-muted-foreground">Peak (9+)</span>
              </div>
            </div>
            
            <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-2 border-t border-border/60">
              <AlertCircle className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Clinicians can click on any cell in the work week grid to inspect appointment distribution.
              </span>
            </div>
          </div>

          {/* Details Pane */}
          <div className="md:col-span-8 p-4 rounded-lg border border-border bg-card">
            {selectedCell && selectedCellData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-500" />
                    <span className="font-semibold text-sm text-foreground">
                      {selectedCell.day}
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-mono font-medium">
                      {selectedCell.hour}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs bg-indigo-500/5 text-indigo-600 border-indigo-500/20 font-medium">
                    <Users className="h-3 w-3 mr-1" />
                    {selectedCellData.count} Appointments
                  </Badge>
                </div>

                {selectedCellData.count === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    No clinical appointments scheduled for this time block.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Expected Case Distribution:
                    </span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedCellData.details.map((detail, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded border border-border/60 bg-muted/20 text-xs text-foreground/90 font-medium"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                          {detail}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Click a heat map block to inspect distribution details.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
