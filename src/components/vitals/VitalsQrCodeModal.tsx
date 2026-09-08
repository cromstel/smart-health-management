import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, Download, Printer, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import type { VitalsRecord } from '@/types/vitals';

interface VitalsQrCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  latestVital?: VitalsRecord;
  triageClassification?: string;
  triageScore?: number;
}

export function VitalsQrCodeModal({
  open,
  onOpenChange,
  patientId,
  patientName,
  latestVital,
  triageClassification = 'Routine Intake',
  triageScore = 2,
}: VitalsQrCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Structured rapid intake payload
  const payload = {
    app: 'SMART_HEALTH_MANAGER',
    schema: 'RAPID_PATIENT_INTAKE_V1',
    patientId,
    patientName,
    generatedAt: new Date().toISOString(),
    triage: {
      score: triageScore,
      classification: triageClassification,
    },
    latestVitals: latestVital
      ? {
          recordedAt: latestVital.recordedAt,
          bloodPressure: `${latestVital.systolicBp}/${latestVital.diastolicBp} mmHg`,
          heartRate: `${latestVital.heartRate} bpm`,
          temperature: `${latestVital.temperature.toFixed(1)} °C`,
          oxygenSaturation: latestVital.oxygenSaturation ? `${latestVital.oxygenSaturation}%` : 'N/A',
          respiratoryRate: latestVital.respiratoryRate ? `${latestVital.respiratoryRate} bpm` : 'N/A',
          status: latestVital.status,
        }
      : 'No vitals logged yet',
  };

  const payloadString = JSON.stringify(payload, null, 2);

  useEffect(() => {
    if (open) {
      QRCode.toDataURL(payloadString, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a', // slate-900
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => {
          console.error('Failed to generate QR code:', err);
          toast.error('Failed to generate Intake QR code');
        });
    }
  }, [open, payloadString]);

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payloadString);
    setCopied(true);
    toast.success('Intake JSON payload copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `rapid_intake_qr_${patientId}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Intake QR code PNG downloaded');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print preview');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapid Patient Intake QR - ${patientName}</title>
          <style>
            body { font-family: sans-serif; padding: 24px; text-align: center; }
            .card { border: 2px solid #0f172a; border-radius: 12px; padding: 24px; max-width: 400px; margin: 0 auto; }
            h2 { margin-bottom: 4px; color: #0f172a; }
            p { margin: 4px 0; color: #475569; font-size: 14px; }
            img { margin: 16px 0; width: 220px; height: 220px; }
            .badge { display: inline-block; padding: 4px 12px; background: #f1f5f9; border-radius: 9999px; font-weight: bold; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>SMART HEALTH MANAGER</h2>
            <p><strong>Rapid Intake Passport</strong></p>
            <div class="badge">Patient ID: ${patientId}</div>
            <h3>${patientName}</h3>
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Intake QR Code" />` : ''}
            <p><strong>BP:</strong> ${latestVital ? `${latestVital.systolicBp}/${latestVital.diastolicBp} mmHg` : 'N/A'}</p>
            <p><strong>HR:</strong> ${latestVital ? `${latestVital.heartRate} bpm` : 'N/A'} | <strong>Temp:</strong> ${latestVital ? `${latestVital.temperature.toFixed(1)}°C` : 'N/A'}</p>
            <p><small>Scan code with Smart Health Scanner for immediate ER/Ward admission</small></p>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-accent">
            <QrCode className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold">Rapid Intake QR Code</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Scannable encrypted pass for immediate clinical admission and triage sync.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Patient Header Banner */}
          <div className="p-3 rounded-lg bg-slate-900 text-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-full bg-slate-800 text-sky-400">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold">{patientName}</h4>
                <p className="text-[11px] text-slate-400 font-mono">ID: {patientId}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-sky-400/50 text-sky-300 text-[10px]">
              {triageClassification}
            </Badge>
          </div>

          {/* QR Display Card */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/60 text-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Patient Intake QR"
                className="w-56 h-56 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm bg-white p-2"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-muted-foreground">
                Generating QR code...
              </div>
            )}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Scannable by clinical triage scanners & handheld monitors</span>
            </div>
          </div>

          {/* Biometric Summary Quick Grid */}
          {latestVital && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-muted/50 border border-border">
                <span className="text-[10px] uppercase text-muted-foreground block font-bold">Blood Pressure</span>
                <span className="font-bold text-foreground">
                  {latestVital.systolicBp}/{latestVital.diastolicBp}
                </span>
                <span className="text-[9px] text-muted-foreground block">mmHg</span>
              </div>
              <div className="p-2 rounded bg-muted/50 border border-border">
                <span className="text-[10px] uppercase text-muted-foreground block font-bold">Heart Rate</span>
                <span className="font-bold text-foreground">{latestVital.heartRate}</span>
                <span className="text-[9px] text-muted-foreground block">bpm</span>
              </div>
              <div className="p-2 rounded bg-muted/50 border border-border">
                <span className="text-[10px] uppercase text-muted-foreground block font-bold">Temperature</span>
                <span className="font-bold text-foreground">{latestVital.temperature.toFixed(1)}°C</span>
                <span className="text-[9px] text-muted-foreground block">Body Temp</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={handleCopyPayload}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Data'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5"
              onClick={handleDownloadQr}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs gap-1.5 bg-accent text-accent-foreground font-semibold"
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Pass</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
