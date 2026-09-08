import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { vitalsService, computeVitalStatus } from '@/services/vitalsService';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';
import { VoiceDictationButton } from '@/components/VoiceDictationButton';
import {
  Activity,
  Heart,
  Thermometer,
  Gauge,
  Wind,
  Plus,
} from 'lucide-react';

interface LogVitalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  patientsList?: Array<{ id: string; name: string }>;
  onVitalsAdded?: () => void;
}

export function LogVitalsDialog({
  open,
  onOpenChange,
  patientId: initialPatientId,
  patientName: initialPatientName,
  patientsList = [],
  onVitalsAdded,
}: LogVitalsDialogProps) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || (patientsList[0]?.id || 'P-1001'));
  const [systolic, setSystolic] = useState<string>('120');
  const [diastolic, setDiastolic] = useState<string>('80');
  const [heartRate, setHeartRate] = useState<string>('72');
  const [temperature, setTemperature] = useState<string>('36.8');
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('16');
  const [oxygenSaturation, setOxygenSaturation] = useState<string>('98');
  const [notes, setNotes] = useState<string>('');
  const [recordedDate, setRecordedDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [loading, setLoading] = useState(false);

  // Sync selected patient name
  const currentPatientName =
    patientsList.find((p) => p.id === selectedPatientId)?.name ||
    initialPatientName ||
    'Patient';

  // Preview status in real-time
  const sVal = parseFloat(systolic) || 120;
  const dVal = parseFloat(diastolic) || 80;
  const hrVal = parseFloat(heartRate) || 72;
  const tempCVal = tempUnit === 'F' ? ((parseFloat(temperature) || 98.6) - 32) * (5 / 9) : (parseFloat(temperature) || 36.8);
  const currentStatus = computeVitalStatus(sVal, dVal, hrVal, tempCVal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalTempC = tempUnit === 'F' ? (parseFloat(temperature) - 32) * (5 / 9) : parseFloat(temperature);

      const newRecord = await vitalsService.addVitalRecord({
        patientId: selectedPatientId,
        patientName: currentPatientName,
        recordedAt: recordedDate ? recordedDate.replace('T', ' ') : new Date().toISOString().slice(0, 16).replace('T', ' '),
        recordedBy: user?.name ? `Dr. ${user.name}` : 'Attending Clinician',
        systolicBp: parseFloat(systolic),
        diastolicBp: parseFloat(diastolic),
        heartRate: parseFloat(heartRate),
        temperature: parseFloat(finalTempC.toFixed(1)),
        respiratoryRate: respiratoryRate ? parseFloat(respiratoryRate) : undefined,
        oxygenSaturation: oxygenSaturation ? parseFloat(oxygenSaturation) : undefined,
        notes: notes.trim(),
      });

      // If high or critical, trigger a clinic alert notification
      if (newRecord.status === 'high' || newRecord.status === 'critical') {
        addNotification({
          type: 'vitals_alert',
          priority: 'urgent',
          title: `Abnormal Vitals Logged: ${currentPatientName}`,
          message: `BP: ${newRecord.systolicBp}/${newRecord.diastolicBp} mmHg, HR: ${newRecord.heartRate} bpm, Temp: ${newRecord.temperature}°C (${newRecord.status.toUpperCase()}).`,
          timestamp: 'Just now',
          patientName: currentPatientName,
          patientId: selectedPatientId,
          status: 'pending',
          actionUrl: `/patients?search=${encodeURIComponent(currentPatientName)}`,
        });
      }

      toast.success(`Vitals successfully recorded for ${currentPatientName}`);
      onOpenChange(false);
      if (onVitalsAdded) onVitalsAdded();
    } catch (err: any) {
      toast.error(`Failed to record vitals: ${err.message || 'Error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Log Patient Vitals</DialogTitle>
              <DialogDescription>
                Record blood pressure, heart rate, temperature, and respiration parameters
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Patient Selection & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patientsList.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="patientSelect">Select Patient</Label>
                <Select
                  value={selectedPatientId}
                  onValueChange={setSelectedPatientId}
                >
                  <SelectTrigger id="patientSelect">
                    <SelectValue placeholder="Select Patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientsList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="recordedDate">Measurement Date & Time</Label>
              <Input
                id="recordedDate"
                type="datetime-local"
                value={recordedDate}
                onChange={(e) => setRecordedDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Blood Pressure */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-500" />
                <Label className="font-semibold text-sm">Blood Pressure (mmHg)</Label>
              </div>
              <span className="text-xs text-muted-foreground">Standard target &lt; 120/80</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="systolic" className="text-xs text-muted-foreground">
                  Systolic (Upper)
                </Label>
                <div className="relative">
                  <Input
                    id="systolic"
                    type="number"
                    min="50"
                    max="260"
                    placeholder="120"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                    mmHg
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="diastolic" className="text-xs text-muted-foreground">
                  Diastolic (Lower)
                </Label>
                <div className="relative">
                  <Input
                    id="diastolic"
                    type="number"
                    min="30"
                    max="160"
                    placeholder="80"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                    mmHg
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Heart Rate & Temperature */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Heart Rate */}
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" />
                <Label htmlFor="heartRate" className="font-semibold text-sm">
                  Heart Rate
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="heartRate"
                  type="number"
                  min="30"
                  max="220"
                  placeholder="72"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  required
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  bpm
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Resting target: 60 - 100 bpm</p>
            </div>

            {/* Temperature */}
            <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-amber-500" />
                  <Label htmlFor="temperature" className="font-semibold text-sm">
                    Body Temp
                  </Label>
                </div>
                <div className="flex rounded-md border border-border overflow-hidden text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (tempUnit === 'F') {
                        setTempUnit('C');
                        const c = ((parseFloat(temperature) || 98.6) - 32) * (5 / 9);
                        setTemperature(c.toFixed(1));
                      }
                    }}
                    className={`px-2 py-0.5 font-semibold ${
                      tempUnit === 'C'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    °C
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tempUnit === 'C') {
                        setTempUnit('F');
                        const f = (parseFloat(temperature) || 36.8) * (9 / 5) + 32;
                        setTemperature(f.toFixed(1));
                      }
                    }}
                    className={`px-2 py-0.5 font-semibold ${
                      tempUnit === 'F'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    °F
                  </button>
                </div>
              </div>
              <div className="relative">
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min={tempUnit === 'C' ? '30' : '86'}
                  max={tempUnit === 'C' ? '45' : '113'}
                  placeholder={tempUnit === 'C' ? '36.8' : '98.2'}
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  required
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  °{tempUnit}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Normal range: 36.1°C - 37.2°C</p>
            </div>
          </div>

          {/* Additional parameters: Respiratory rate & Oxygen Saturation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="respiratoryRate" className="text-xs flex items-center gap-1.5">
                <Wind className="h-3.5 w-3.5 text-teal-500" />
                Respiratory Rate (optional)
              </Label>
              <div className="relative">
                <Input
                  id="respiratoryRate"
                  type="number"
                  placeholder="16"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(e.target.value)}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  breaths/min
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="oxygenSaturation" className="text-xs flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-500" />
                Oxygen Saturation SpO2 (optional)
              </Label>
              <div className="relative">
                <Input
                  id="oxygenSaturation"
                  type="number"
                  placeholder="98"
                  min="50"
                  max="100"
                  value={oxygenSaturation}
                  onChange={(e) => setOxygenSaturation(e.target.value)}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Clinician Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes">Clinical Notes & Observations</Label>
              <VoiceDictationButton onTranscript={(txt) => setNotes(txt)} />
            </div>
            <Textarea
              id="notes"
              placeholder="e.g. Patient resting seated for 5 mins prior to reading. Complained of mild fatigue."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Real-time Status Indicator */}
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/40 text-xs">
            <span className="text-muted-foreground">Evaluation Assessment:</span>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  currentStatus === 'normal'
                    ? 'default'
                    : currentStatus === 'elevated'
                    ? 'outline'
                    : 'destructive'
                }
                className="capitalize font-semibold text-xs"
              >
                {currentStatus} Assessment
              </Badge>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {loading ? 'Recording Vitals...' : 'Save Vitals Entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
