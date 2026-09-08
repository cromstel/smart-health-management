import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { api } from '@/services/api';
import { vitalsService, computeVitalsSummary } from '@/services/vitalsService';
import { evaluateTriagePriority } from '@/utils/triage';
import type { VitalsRecord, VitalStatus, CriticalHealthAlert } from '@/types/vitals';
import { LogVitalsDialog } from './LogVitalsDialog';
import { CriticalHealthAlertsSection } from './CriticalHealthAlertsSection';
import { AlertsSummary } from './AlertsSummary';
import { DeviceSyncModule } from './DeviceSyncModule';
import { AiClinicalInsightsSidebar } from './AiClinicalInsightsSidebar';
import { VideoConsultationModal } from './VideoConsultationModal';
import { DicomGallery } from './DicomGallery';
import { VitalsQrCodeModal } from './VitalsQrCodeModal';
import { DiagnosticHelperBanner } from './DiagnosticHelperBanner';
import { VitalsSessionComparison } from './VitalsSessionComparison';
import { HealthTrendCard } from './HealthTrendCard';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import {
  Activity,
  Heart,
  Thermometer,
  Gauge,
  Plus,
  Calendar,
  Download,
  Trash2,
  Search,
  TrendingUp,
  User,
  Bluetooth,
  Brain,
  Share2,
  Link2,
  Copy,
  Check,
  AlertCircle,
  Printer,
  Video,
  QrCode,
} from 'lucide-react';

interface PatientVitalsModuleProps {
  initialPatientId?: string;
  initialPatientName?: string;
  patients?: Array<{ id: string; name: string }>;
  allPatients?: Array<{ id: string; name: string }>;
  className?: string;
}

export function PatientVitalsModule({
  initialPatientId = 'P-1001',
  initialPatientName,
  patients,
  allPatients: providedAllPatients,
  className = '',
}: PatientVitalsModuleProps) {
  const patientList = patients || providedAllPatients || [
    { id: 'P-1001', name: 'Sarah Johnson' },
    { id: 'P-1002', name: 'John Doe' },
    { id: 'P-1003', name: 'David Mensah' },
  ];

  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId);
  const [vitalsList, setVitalsList] = useState<VitalsRecord[]>([]);
  const [patientAlerts, setPatientAlerts] = useState<CriticalHealthAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'bp' | 'hr' | 'temp'>('all');
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [exportingPdf, setExportingPdf] = useState(false);

  // New interactive states for wearable devices and diagnostic insights
  const [deviceSyncOpen, setDeviceSyncOpen] = useState(false);
  const [aiInsightsOpen, setAiInsightsOpen] = useState(false);
  const [videoConsultOpen, setVideoConsultOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  
  // Public patient summary share states
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState<string | null>(null);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [appointmentCount, setAppointmentCount] = useState(0);

  useEffect(() => {
    if (initialPatientId && initialPatientId !== selectedPatientId) {
      setSelectedPatientId(initialPatientId);
    }
  }, [initialPatientId, selectedPatientId]);

  const currentPatient =
    patientList.find((p) => p.id === selectedPatientId) || {
      id: selectedPatientId,
      name: initialPatientName || `Patient ${selectedPatientId}`,
    };

  const loadVitals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vitalsService.getPatientVitals(selectedPatientId);
      setVitalsList(data);
      const alerts = await vitalsService.getPatientLatestAlerts(selectedPatientId);
      setPatientAlerts(alerts);
      
      // Load appointments count
      try {
        const appts = await api.getAppointments() as any[];
        if (Array.isArray(appts)) {
          const patientAppts = appts.filter(
            (a) => (a.patient_id || a.patientId || '').toLowerCase() === selectedPatientId.toLowerCase()
          );
          setAppointmentCount(patientAppts.length);
        } else {
          setAppointmentCount(0);
        }
      } catch (apptErr) {
        console.warn('Failed to fetch appointments count in vitals module', apptErr);
        setAppointmentCount(0);
      }
    } catch (err) {
      console.error('Failed to load vitals:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    loadVitals();
  }, [loadVitals]);

  const handleGenerateShareLink = async () => {
    setGeneratingShareLink(true);
    setCopiedLink(false);
    const toastId = toast.loading('Generating secure digital health token...');

    try {
      const response = await fetch('/api/shared/patient-summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          patientName: currentPatient.name,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate secure link');
      const data = await response.json();

      setShareToken(data.token);
      setShareExpiry(data.expiresAt);
      
      const fullUrl = `${window.location.origin}${data.url}`;
      setShareUrl(fullUrl);
      setShareModalOpen(true);
      toast.success('Secure Patient Summary link successfully activated!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to register shared patient token', { id: toastId });
    } finally {
      setGeneratingShareLink(false);
    }
  };

  // Compute summary stats
  const summary = useMemo(() => {
    return computeVitalsSummary(vitalsList);
  }, [vitalsList]);

  // Compute triage result
  const triageResult = useMemo(() => {
    return evaluateTriagePriority(vitalsList, '', appointmentCount);
  }, [vitalsList, appointmentCount]);

  // Filter vitals by time range for chart
  const chartData = useMemo(() => {
    const now = Date.now();
    let filtered = [...vitalsList];

    if (timeRange === '7d') {
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((v) => new Date(v.recordedAt).getTime() >= cutoff);
    } else if (timeRange === '30d') {
      const cutoff = now - 30 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((v) => new Date(v.recordedAt).getTime() >= cutoff);
    } else if (timeRange === '90d') {
      const cutoff = now - 90 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((v) => new Date(v.recordedAt).getTime() >= cutoff);
    }

    // Sort ascending by date for chart timeline
    return filtered
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .map((v) => {
        const displayTemp =
          tempUnit === 'F'
            ? parseFloat(((v.temperature * 9) / 5 + 32).toFixed(1))
            : v.temperature;

        const dateObj = new Date(v.recordedAt);
        const shortDate = isNaN(dateObj.getTime())
          ? v.recordedAt
          : dateObj.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });

        return {
          id: v.id,
          date: shortDate,
          fullDate: v.recordedAt,
          systolic: v.systolicBp,
          diastolic: v.diastolicBp,
          heartRate: v.heartRate,
          temperature: displayTemp,
          spO2: v.oxygenSaturation,
          respiration: v.respiratoryRate,
          status: v.status,
        };
      });
  }, [vitalsList, timeRange, tempUnit]);

  // Filter records for table view
  const tableRecords = useMemo(() => {
    return vitalsList.filter((v) => {
      if (!searchTableQuery.trim()) return true;
      const q = searchTableQuery.toLowerCase();
      return (
        v.recordedAt.toLowerCase().includes(q) ||
        v.recordedBy.toLowerCase().includes(q) ||
        (v.notes && v.notes.toLowerCase().includes(q)) ||
        v.status.toLowerCase().includes(q)
      );
    });
  }, [vitalsList, searchTableQuery]);

  const handleDeleteRecord = async (id: string) => {
    try {
      await vitalsService.deleteVitalRecord(id);
      toast.success('Vitals entry deleted');
      loadVitals();
    } catch {
      toast.error('Failed to delete vitals entry');
    }
  };

  const handleExportCSV = () => {
    if (vitalsList.length === 0) {
      toast.info('No vitals records to export');
      return;
    }

    const headers = [
      'Record ID',
      'Patient ID',
      'Patient Name',
      'Date & Time',
      'Systolic (mmHg)',
      'Diastolic (mmHg)',
      'Heart Rate (bpm)',
      'Temperature (°C)',
      'SpO2 (%)',
      'Respiration (bpm)',
      'Status',
      'Recorded By',
      'Clinical Notes',
    ];

    const rows = vitalsList.map((v) => [
      v.id,
      v.patientId,
      `"${v.patientName}"`,
      v.recordedAt,
      v.systolicBp,
      v.diastolicBp,
      v.heartRate,
      v.temperature,
      v.oxygenSaturation || '',
      v.respiratoryRate || '',
      v.status,
      `"${v.recordedBy}"`,
      `"${(v.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `patient_vitals_${selectedPatientId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Vitals log exported to CSV');
  };

  const handleExportPDF = async () => {
    if (vitalsList.length === 0) {
      toast.info('No vitals records to export to PDF');
      return;
    }

    setExportingPdf(true);
    const toastId = toast.loading('Generating high-fidelity clinical PDF report...');

    try {
      // Sort chronological ascending
      const chronoVitals = [...vitalsList].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );

      // 1. Create jsPDF document (A4, portrait, millimeters)
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth(); // 210
      const pageHeight = doc.internal.pageSize.getHeight(); // 297
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin; // 180

      // Helper for clean typography styling
      let y = 15;
      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // --- BRANDING & HEADER ---
      doc.setFillColor(15, 23, 42); // slate-900 (matches dashboard branding)
      doc.rect(margin, y, contentWidth, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('SMART HEALTH MANAGER', margin + 6, y + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text('Clinical Quality Assurance & Patient Biometric Ledger', margin + 6, y + 17);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('CONFIDENTIAL MEDICAL REPORT', margin + contentWidth - 62, y + 14);
      y += 32;

      // --- PATIENT METADATA BLOCK ---
      doc.setDrawColor(226, 232, 240); // border-slate-200
      doc.setFillColor(248, 250, 252); // bg-slate-50
      doc.rect(margin, y, contentWidth, 32, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('PATIENT IDENTIFICATION & METADATA', margin + 5, y + 6);

      doc.setLineWidth(0.3);
      doc.line(margin + 5, y + 8, margin + contentWidth - 5, y + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // text-slate-600

      // Left Column
      doc.text(`Patient Name: ${currentPatient.name}`, margin + 5, y + 14);
      doc.text(`Patient Identifier: ${selectedPatientId}`, margin + 5, y + 20);
      doc.text(`Report Generation: ${new Date().toLocaleString()}`, margin + 5, y + 26);

      // Right Column
      doc.text(`Attending Facility: Ghana Health Affiliated Clinic`, margin + 100, y + 14);
      doc.text(`Latest Status Code: ${summary?.bpStatus || 'Normal'}`, margin + 100, y + 20);
      doc.text(`Logged Vitals Entries: ${vitalsList.length} records`, margin + 100, y + 26);
      y += 40;

      // --- SECTION 1: CRITICAL WARNINGS & PHYSIOLOGICAL TRENDS ---
      checkPageBreak(35);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('1. ACTIVE CLINICAL WARNINGS & SYSTEMIC ALERTS', margin, y);
      y += 4;
      doc.line(margin, y, margin + contentWidth, y);
      y += 6;

      // Build text representation of alerts/badges
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      const latest = chronoVitals[chronoVitals.length - 1];

      // Check current warning thresholds
      const warningTexts: string[] = [];
      if (latest) {
        if (latest.systolicBp >= 140 || latest.diastolicBp >= 90) {
          warningTexts.push(`- BLOOD PRESSURE ALERT: Elevated at ${latest.systolicBp}/${latest.diastolicBp} mmHg (Stage 2 Hypertension).`);
        }
        if (latest.heartRate > 100) {
          warningTexts.push(`- HEART RATE ALERT: Tachycardia warning detected at ${latest.heartRate} bpm (exceeds resting target).`);
        } else if (latest.heartRate < 50) {
          warningTexts.push(`- HEART RATE ALERT: Bradycardia warning detected at ${latest.heartRate} bpm.`);
        }
        if (latest.temperature >= 38.0) {
          warningTexts.push(`- CORE HYPERTHERMIA ALERT: Elevated pyrexia index recorded at ${latest.temperature.toFixed(1)}°C (Fever).`);
        }
        if (latest.oxygenSaturation !== undefined && latest.oxygenSaturation < 95) {
          warningTexts.push(`- PULSE OXIMETRY ALERT: Sub-optimal hypoxemic saturation level at ${latest.oxygenSaturation}%.`);
        }
      }

      if (warningTexts.length === 0) {
        doc.setFillColor(240, 253, 250); // bg-teal-50
        doc.setDrawColor(153, 246, 228); // border-teal-200
        doc.rect(margin, y, contentWidth, 12, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 148, 136); // text-teal-600
        doc.text('✓ ALL CLINICAL METRICS NOMINAL. NO ACTIVE ANOMALIES OR TREND RISK DETECTED.', margin + 5, y + 8);
        y += 18;
      } else {
        doc.setFillColor(254, 242, 242); // bg-red-50
        doc.setDrawColor(254, 202, 202); // border-red-200
        doc.rect(margin, y, contentWidth, 6 + warningTexts.length * 6, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38); // text-red-600
        doc.text('⚠ EXTREME BIOMETRIC DEVIATIONS OR CRITICAL THRESHOLDS DETECTED:', margin + 5, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(127, 29, 29); // text-red-950
        warningTexts.forEach((text, i) => {
          doc.text(text, margin + 5, y + 12 + i * 6);
        });
        y += 12 + warningTexts.length * 6 + 6;
      }

      // --- SECTION 2: BIOMETRIC CHART TRENDS (HTML2CANVAS) ---
      checkPageBreak(90);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('2. LONGITUDINAL BIOMETRIC CHART TRENDS', margin, y);
      y += 4;
      doc.line(margin, y, margin + contentWidth, y);
      y += 6;

      const chartEl = document.getElementById('vitals-charts-container');
      if (chartEl) {
        try {
          const canvas = await html2canvas(chartEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
            logging: false,
          });
          const imgData = canvas.toDataURL('image/png');
          const chartHeight = (canvas.height * contentWidth) / canvas.width;
          
          doc.addImage(imgData, 'PNG', margin, y, contentWidth, Math.min(chartHeight, 80));
          y += Math.min(chartHeight, 80) + 10;
        } catch (chartErr) {
          console.error('Failed to capture charts with html2canvas:', chartErr);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(148, 163, 184);
          doc.text('[Charts capture not available - printed in digital-only ledger]', margin + 5, y + 8);
          y += 15;
        }
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text('[Charts layout element not mounted]', margin + 5, y + 8);
        y += 15;
      }

      // --- SECTION 3: RECENT EXAMINATION DATA LEDGER ---
      checkPageBreak(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('3. DETAILED HISTORICAL EXAMINATION LEDGER', margin, y);
      y += 4;
      doc.line(margin, y, margin + contentWidth, y);
      y += 6;

      // Table Headers
      doc.setFillColor(241, 245, 249); // bg-slate-100
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);

      const colWidths = { date: 32, bp: 24, hr: 18, temp: 18, spo2: 18, clinician: 30, status: 40 };
      let curX = margin + 2;
      doc.text('DATE & TIME', curX, y + 5); curX += colWidths.date;
      doc.text('BP (mmHg)', curX, y + 5); curX += colWidths.bp;
      doc.text('HR (bpm)', curX, y + 5); curX += colWidths.hr;
      doc.text('TEMP (°C)', curX, y + 5); curX += colWidths.temp;
      doc.text('SpO2 (%)', curX, y + 5); curX += colWidths.spo2;
      doc.text('STATUS', curX, y + 5); curX += colWidths.status;
      doc.text('CLINICIAN', curX, y + 5);
      y += 7;

      // Draw record rows
      doc.setFont('helvetica', 'normal');
      const rowsToPrint = chronoVitals.slice().reverse().slice(0, 10); // Print up to latest 10 records
      
      rowsToPrint.forEach((rec, rowIdx) => {
        checkPageBreak(8);
        
        // Alternate row background coloring
        if (rowIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, 6, 'F');
        }

        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        
        let rowX = margin + 2;
        doc.text(rec.recordedAt, rowX, y + 4.5); rowX += colWidths.date;
        doc.text(`${rec.systolicBp}/${rec.diastolicBp}`, rowX, y + 4.5); rowX += colWidths.bp;
        doc.text(`${rec.heartRate}`, rowX, y + 4.5); rowX += colWidths.hr;
        doc.text(`${rec.temperature.toFixed(1)}°C`, rowX, y + 4.5); rowX += colWidths.temp;
        doc.text(rec.oxygenSaturation ? `${rec.oxygenSaturation}%` : '--', rowX, y + 4.5); rowX += colWidths.spo2;
        
        // Highlight Status
        if (rec.status === 'critical') {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(220, 38, 38);
          doc.text('CRITICAL', rowX, y + 4.5);
        } else if (rec.status === 'high') {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(225, 29, 72);
          doc.text('HIGH / STAGE 2', rowX, y + 4.5);
        } else if (rec.status === 'elevated') {
          doc.setFont('helvetica', 'medium');
          doc.setTextColor(217, 119, 6);
          doc.text('ELEVATED', rowX, y + 4.5);
        } else {
          doc.setTextColor(22, 163, 74);
          doc.text('NORMAL', rowX, y + 4.5);
        }
        rowX += colWidths.status;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(rec.recordedBy.replace('Dr. ', '').slice(0, 15), rowX, y + 4.5);

        y += 6;
      });

      // --- SIGNATURE BLOCK ---
      checkPageBreak(30);
      y += 10;
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, margin + 60, y);
      doc.line(margin + contentWidth - 60, y, margin + contentWidth, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Attending Clinician Signature', margin + 2, y + 4);
      doc.text('Quality Assurance Sign-off', margin + contentWidth - 58, y + 4);

      // --- FOOTER PAGINATION ---
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Smart Health Manager (QA/QC Dept) | Patient: ${currentPatient.name} | Page ${i} of ${totalPages}`,
          margin,
          pageHeight - 8
        );
      }

      // Save PDF
      doc.save(`clinical_vitals_summary_${selectedPatientId}_${Date.now()}.pdf`);
      toast.success('Clinical PDF Summary successfully generated & saved', { id: toastId });
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to export patient clinical PDF report', { id: toastId });
    } finally {
      setExportingPdf(false);
    }
  };

  const getStatusBadge = (status: VitalStatus) => {
    switch (status) {
      case 'critical':
        return <Badge variant="destructive" className="font-semibold text-xs">Critical</Badge>;
      case 'high':
        return <Badge variant="destructive" className="bg-rose-600 hover:bg-rose-700 text-xs font-medium">Stage 2 / High</Badge>;
      case 'elevated':
        return <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">Elevated</Badge>;
      case 'normal':
      default:
        return <Badge variant="outline" className="border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">Normal</Badge>;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Card */}
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-accent/15 text-accent">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    Patient Vitals & Biometric Tracking
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Log and monitor blood pressure, heart rate, and body temperature trends over time
                  </CardDescription>
                </div>
              </div>
            </div>

            {/* Patient Selector & Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 min-w-[200px]">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select
                  value={selectedPatientId}
                  onValueChange={(val) => setSelectedPatientId(val)}
                >
                  <SelectTrigger className="h-9 text-xs font-medium bg-card">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientList.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} ({p.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                className={`h-9 text-xs gap-1.5 ${deviceSyncOpen ? 'bg-slate-100 border-slate-400' : ''}`}
                onClick={() => setDeviceSyncOpen(!deviceSyncOpen)}
              >
                <Bluetooth className={`h-3.5 w-3.5 ${deviceSyncOpen ? 'text-blue-600' : 'text-slate-500'}`} />
                <span>Sync Wearable</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className={`h-9 text-xs gap-1.5 ${aiInsightsOpen ? 'bg-slate-100 border-slate-400' : ''}`}
                onClick={() => setAiInsightsOpen(!aiInsightsOpen)}
              >
                <Brain className={`h-3.5 w-3.5 ${aiInsightsOpen ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>AI Insights</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 text-slate-700 hover:bg-slate-50 border-slate-200"
                onClick={handleGenerateShareLink}
                disabled={generatingShareLink}
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>{generatingShareLink ? 'Generating...' : 'Share Progress'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5"
                onClick={handleExportCSV}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Log</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 border-accent text-accent-foreground hover:bg-accent/10"
                onClick={handleExportPDF}
                disabled={exportingPdf}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{exportingPdf ? 'Exporting PDF...' : 'Export PDF'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 text-slate-700 hover:bg-slate-50 border-slate-200"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5 text-accent animate-pulse" />
                <span>Print Chart</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border-indigo-200"
                onClick={() => setQrModalOpen(true)}
              >
                <QrCode className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Intake QR Code</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 border-sky-200"
                onClick={() => setVideoConsultOpen(true)}
              >
                <Video className="h-3.5 w-3.5 text-sky-600" />
                <span>Video Consult</span>
              </Button>

              <Button
                size="sm"
                className="h-9 text-xs gap-1.5 bg-accent text-accent-foreground font-semibold shadow-sm"
                onClick={() => setLogDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span>Log New Vitals</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Quick Vitals Summary Stats */}
        <CardContent className="pt-0">
          {/* Automated Clinical Triage Priority Banner */}
          <div className={`mb-4 p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${triageResult.levelColor}`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wide text-white ${triageResult.badgeColor}`}>
                  {triageResult.classification}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground opacity-90">
                  Automated Clinical Triage
                </span>
              </div>
              <h4 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                Priority Score: <span className="font-mono text-xl">{triageResult.score}</span> / 10 — {triageResult.label}
              </h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold">Recommended Ward:</span>
                <span className="px-2 py-0.5 bg-slate-900/10 rounded font-medium">{triageResult.recommendedWard}</span>
                {appointmentCount > 0 && (
                  <span className="text-[11px] opacity-75">
                    • {appointmentCount} recent appointments reviewed
                  </span>
                )}
              </div>
            </div>
            
            <div className="w-full md:w-auto md:max-w-md bg-white/60 dark:bg-black/25 p-3 rounded-lg border border-white/40 dark:border-white/5 space-y-1 text-xs text-slate-800 dark:text-slate-200">
              <div className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Clinical Trigger Signals</div>
              <ul className="space-y-1">
                {triageResult.factors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 font-medium leading-relaxed">
                    <span className="text-rose-500 font-extrabold shrink-0">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Diagnostic Helper Outlier Flags & Immediate Alert Trigger */}
          <div className="mb-4">
            <DiagnosticHelperBanner
              latestVital={vitalsList[0]}
              patientName={currentPatient.name}
              patientId={selectedPatientId}
            />
          </div>

          {/* Health Trend Insight Badge & Side-by-Side Session Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <HealthTrendCard vitalsList={vitalsList} patientName={currentPatient.name} />
            <VitalsSessionComparison vitalsList={vitalsList} tempUnit={tempUnit} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
            {/* Blood Pressure Card */}
            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Gauge className="h-4 w-4 text-blue-500" />
                  Blood Pressure
                </span>
                <span className="text-[10px] uppercase font-mono">mmHg</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {summary ? `${summary.latestSystolic}/${summary.latestDiastolic}` : '--/--'}
                </span>
                {summary && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${
                      summary.bpStatus === 'Normal'
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                        : summary.bpStatus === 'Elevated'
                        ? 'text-amber-600 dark:text-amber-400 border-amber-500/40'
                        : 'text-rose-600 dark:text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {summary.bpStatus}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Target: &lt;120 / &lt;80 mmHg
              </p>
            </div>

            {/* Heart Rate Card */}
            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Heart className="h-4 w-4 text-rose-500" />
                  Heart Rate
                </span>
                <span className="text-[10px] uppercase font-mono">bpm</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {summary ? summary.latestHeartRate : '--'}
                </span>
                {summary && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${
                      summary.hrStatus === 'Normal'
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                        : 'text-amber-600 dark:text-amber-400 border-amber-500/40'
                    }`}
                  >
                    {summary.hrStatus}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Resting: 60 - 100 bpm
              </p>
            </div>

            {/* Body Temperature Card */}
            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Thermometer className="h-4 w-4 text-amber-500" />
                  Temperature
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTempUnit((u) => (u === 'C' ? 'F' : 'C'))}
                    className="text-[10px] font-mono hover:text-foreground font-semibold px-1 rounded bg-muted"
                    title="Click to toggle °C / °F"
                  >
                    °{tempUnit} ⇄
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {summary
                    ? tempUnit === 'F'
                      ? ((summary.latestTemperature * 9) / 5 + 32).toFixed(1)
                      : summary.latestTemperature
                    : '--'}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">
                    °{tempUnit}
                  </span>
                </span>
                {summary && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${
                      summary.tempStatus === 'Normal'
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                        : 'text-rose-600 dark:text-rose-400 border-rose-500/40'
                    }`}
                  >
                    {summary.tempStatus}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Normal: 36.1 - 37.2 °C
              </p>
            </div>

            {/* Oxygen SpO2 Card */}
            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <TrendingUp className="h-4 w-4 text-teal-500" />
                  Oxygen SpO2
                </span>
                <span className="text-[10px] uppercase font-mono">%</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {summary?.latestOxygenSat ? `${summary.latestOxygenSat}%` : '98%'}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                >
                  Optimal
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Last reading: {summary?.lastRecordedAt || 'Recent'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {deviceSyncOpen && (
        <DeviceSyncModule
          patientId={selectedPatientId}
          patientName={currentPatient.name}
          onSyncComplete={loadVitals}
        />
      )}

      <div className={aiInsightsOpen ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "space-y-6"}>
        <div className={aiInsightsOpen ? "lg:col-span-2 space-y-6" : "space-y-6"}>
          {/* Alerts & Trends Summary Component */}
          <AlertsSummary
            patientId={selectedPatientId}
            patientName={currentPatient.name}
            vitals={vitalsList}
            className="mb-0"
          />

      {/* Critical Health Alerts Section */}
      <CriticalHealthAlertsSection
        alerts={patientAlerts}
        patientName={currentPatient.name}
        patientId={currentPatient.id}
        onOpenLogDialog={() => setLogDialogOpen(true)}
      />

      {/* Chart Section */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <CardTitle className="text-base font-semibold text-foreground">
                  Vitals Timeline & Trend Visualizer
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Tracking biometric fluctuations across consultations for {currentPatient.name}
              </CardDescription>
            </div>

            {/* Controls: Chart Type Tabs & Range */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category tabs */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-muted/40 text-xs">
                <button
                  onClick={() => setActiveChartTab('all')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    activeChartTab === 'all'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All Vitals
                </button>
                <button
                  onClick={() => setActiveChartTab('bp')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    activeChartTab === 'bp'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Blood Pressure
                </button>
                <button
                  onClick={() => setActiveChartTab('hr')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    activeChartTab === 'hr'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Heart Rate
                </button>
                <button
                  onClick={() => setActiveChartTab('temp')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    activeChartTab === 'temp'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Temperature
                </button>
              </div>

              {/* Range Selector */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-muted/40 text-xs">
                {(['7d', '30d', '90d', 'all'] as const).map((rng) => (
                  <button
                    key={rng}
                    onClick={() => setTimeRange(rng)}
                    className={`px-2 py-1 rounded-md font-medium uppercase text-[11px] transition-colors ${
                      timeRange === rng
                        ? 'bg-card text-foreground shadow-sm font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {rng === 'all' ? 'All' : rng}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 text-muted-foreground border border-dashed border-border rounded-lg">
              <Activity className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm font-semibold text-foreground">No Vitals Recorded Yet</p>
              <p className="text-xs max-w-sm mt-1">
                Log the patient's first clinical vitals reading to begin generating trendline analytics.
              </p>
              <Button
                size="sm"
                className="mt-3 text-xs gap-1.5"
                onClick={() => setLogDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Log Initial Vitals
              </Button>
            </div>
          ) : (
            <div id="vitals-charts-container" className="space-y-6 bg-background/50 p-2.5 rounded-xl border border-border/30">
              {/* Blood Pressure Chart (if 'all' or 'bp') */}
              {(activeChartTab === 'all' || activeChartTab === 'bp') && (
                <div className="p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-blue-500" />
                      <h4 className="text-sm font-semibold text-foreground">
                        Blood Pressure Trend (Systolic & Diastolic)
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        Systolic (mmHg)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                        Diastolic (mmHg)
                      </span>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[40, 200]}
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          unit=" mmHg"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            color: '#F8FAFC',
                            fontSize: '12px',
                          }}
                          formatter={(value: any, name: any) => [
                            `${value} mmHg`,
                            name === 'systolic' ? 'Systolic' : 'Diastolic',
                          ]}
                          labelFormatter={(_label, payload) => {
                            if (payload && payload[0]) {
                              return `Recorded: ${payload[0].payload.fullDate}`;
                            }
                            return '';
                          }}
                        />
                        <ReferenceLine
                          y={120}
                          label={{ value: 'Normal Systolic (120)', position: 'insideTopRight', fill: '#10b981', fontSize: 10 }}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                        />
                        <ReferenceLine
                          y={80}
                          label={{ value: 'Normal Diastolic (80)', position: 'insideBottomRight', fill: '#10b981', fontSize: 10 }}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                        />
                        <ReferenceLine
                          y={140}
                          label={{ value: 'Stage 2 Threshold (140)', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }}
                          stroke="#ef4444"
                          strokeDasharray="3 3"
                        />
                        <Line
                          type="monotone"
                          dataKey="systolic"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 1 }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={true}
                          animationDuration={1000}
                          animationEasing="ease-in-out"
                        />
                        <Line
                          type="monotone"
                          dataKey="diastolic"
                          stroke="#14b8a6"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#14b8a6', strokeWidth: 1 }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={true}
                          animationDuration={1000}
                          animationEasing="ease-in-out"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Heart Rate Chart (if 'all' or 'hr') */}
              {(activeChartTab === 'all' || activeChartTab === 'hr') && (
                <div className="p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-rose-500" />
                      <h4 className="text-sm font-semibold text-foreground">
                        Heart Rate Trend (BPM)
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Target Band: 60 - 100 bpm</span>
                    </div>
                  </div>

                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[40, 140]}
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          unit=" bpm"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            color: '#F8FAFC',
                            fontSize: '12px',
                          }}
                          formatter={(value: any) => [`${value} bpm`, 'Heart Rate']}
                          labelFormatter={(_label, payload) => {
                            if (payload && payload[0]) {
                              return `Recorded: ${payload[0].payload.fullDate}`;
                            }
                            return '';
                          }}
                        />
                        <ReferenceLine
                          y={100}
                          label={{ value: 'Upper Normal (100 bpm)', position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                        />
                        <ReferenceLine
                          y={60}
                          label={{ value: 'Lower Normal (60 bpm)', position: 'insideBottomRight', fill: '#f59e0b', fontSize: 10 }}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                        />
                        <Line
                          type="monotone"
                          dataKey="heartRate"
                          stroke="#f43f5e"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#f43f5e', strokeWidth: 1 }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={true}
                          animationDuration={1000}
                          animationEasing="ease-in-out"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Temperature Chart (if 'all' or 'temp') */}
              {(activeChartTab === 'all' || activeChartTab === 'temp') && (
                <div className="p-4 rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-amber-500" />
                      <h4 className="text-sm font-semibold text-foreground">
                        Body Temperature Trend (°{tempUnit})
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Fever Threshold: {tempUnit === 'C' ? '37.5 °C' : '99.5 °F'}</span>
                    </div>
                  </div>

                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                        />
                        <YAxis
                          domain={tempUnit === 'C' ? [35.0, 40.0] : [95.0, 104.0]}
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          unit={`°${tempUnit}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            color: '#F8FAFC',
                            fontSize: '12px',
                          }}
                          formatter={(value: any) => [`${value} °${tempUnit}`, 'Temperature']}
                          labelFormatter={(_label, payload) => {
                            if (payload && payload[0]) {
                              return `Recorded: ${payload[0].payload.fullDate}`;
                            }
                            return '';
                          }}
                        />
                        <ReferenceLine
                          y={tempUnit === 'C' ? 37.5 : 99.5}
                          label={{ value: 'Elevated / Low Fever', position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                        />
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#f59e0b', strokeWidth: 1 }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={true}
                          animationDuration={1000}
                          animationEasing="ease-in-out"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnostic Medical Image DICOM Gallery */}
      <DicomGallery patientId={selectedPatientId} patientName={currentPatient.name} />

      {/* Historical Vitals Log Table */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" />
                <CardTitle className="text-base font-semibold text-foreground">
                  Clinical Vitals Log History
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {tableRecords.length} records
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Detailed audit ledger of measurements recorded during examinations
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter log history..."
                  value={searchTableQuery}
                  onChange={(e) => setSearchTableQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-muted/40"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Date & Time</TableHead>
                  <TableHead className="text-xs font-semibold">Blood Pressure</TableHead>
                  <TableHead className="text-xs font-semibold">Heart Rate</TableHead>
                  <TableHead className="text-xs font-semibold">Temperature</TableHead>
                  <TableHead className="text-xs font-semibold">SpO2 / Resp</TableHead>
                  <TableHead className="text-xs font-semibold">Clinical Status</TableHead>
                  <TableHead className="text-xs font-semibold">Clinician</TableHead>
                  <TableHead className="text-xs font-semibold">Notes</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {tableRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                      No vitals records found for this query.
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRecords.map((record) => (
                    <TableRow key={record.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-foreground whitespace-nowrap">
                        {record.recordedAt}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {record.systolicBp}/{record.diastolicBp}{' '}
                        <span className="text-[10px] font-normal text-muted-foreground">mmHg</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {record.heartRate}{' '}
                        <span className="text-[10px] font-normal text-muted-foreground">bpm</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {tempUnit === 'F'
                          ? ((record.temperature * 9) / 5 + 32).toFixed(1)
                          : record.temperature}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          °{tempUnit}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {record.oxygenSaturation ? `${record.oxygenSaturation}%` : '--'} /{' '}
                        {record.respiratoryRate ? `${record.respiratoryRate} bpm` : '--'}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {record.recordedBy}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={record.notes}>
                        {record.notes || '--'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                          onClick={() => handleDeleteRecord(record.id)}
                          title="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </div>

        {aiInsightsOpen && (
          <div className="lg:col-span-1 h-full">
            <div className="sticky top-6">
              <AiClinicalInsightsSidebar
                patientId={selectedPatientId}
                patientName={currentPatient.name}
                vitalsList={vitalsList}
                onClose={() => setAiInsightsOpen(false)}
                onCopyToNotes={(notesText) => {
                  navigator.clipboard.writeText(notesText);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Share Progress Temporary Link Dialog */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-200" id="share-progress-dialog">
          <DialogHeader id="share-progress-header">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2" id="share-progress-title">
              <Share2 className="w-4 h-4 text-slate-900" /> Secure Progress Sharing
            </DialogTitle>
            <DialogDescription className="text-xs" id="share-progress-desc">
              Generate a secure, short-lived (15 minutes) digital ledger link that the patient or authorized caretakers can use to view recent progress.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2" id="share-progress-body">
            {shareUrl && (
              <div className="space-y-3" id="share-url-container">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2" id="share-link-input-wrapper">
                  <div className="flex items-center gap-2 overflow-hidden" id="share-link-text">
                    <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-mono text-slate-600 truncate">{shareUrl}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs shrink-0 border-slate-200"
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      setCopiedLink(true);
                      toast.success('Secure summary link copied!');
                    }}
                    id="copy-share-link-btn"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  </Button>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-2" id="expiry-warning-alert">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div id="expiry-warning-meta">
                    <p className="text-xs font-bold text-amber-900">Temporary Access Token Active</p>
                    <p className="text-[10px] text-amber-800">
                      This secure URL will expire in exactly 15 minutes (at {shareExpiry ? new Date(shareExpiry).toLocaleTimeString() : 'N/A'}). Token ID: {shareToken?.substring(0, 8)}... No permanent records are exposed without professional credentials.
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full bg-slate-950 hover:bg-slate-850 text-white text-xs font-semibold h-9"
                  onClick={() => window.open(shareUrl, '_blank')}
                  id="open-share-link-btn"
                >
                  Launch Public Patient Portal
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <VitalsQrCodeModal
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        patientId={selectedPatientId}
        patientName={currentPatient.name}
        latestVital={vitalsList[0]}
        triageClassification={triageResult.classification}
        triageScore={triageResult.score}
      />

      {/* Log Vitals Dialog */}
      <LogVitalsDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        patientId={selectedPatientId}
        patientName={currentPatient.name}
        patientsList={patientList}
        onVitalsAdded={loadVitals}
      />

      <VideoConsultationModal
        isOpen={videoConsultOpen}
        onClose={() => setVideoConsultOpen(false)}
        patientId={selectedPatientId}
        patientName={currentPatient.name}
      />
    </div>
  );
}

export default PatientVitalsModule;
