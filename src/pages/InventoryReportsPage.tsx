import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Printer, Download, Clock, FileText } from 'lucide-react';
import { exportToCSV } from '@/utils/csv';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReportType = 'stock_levels' | 'expiry_dates' | 'low_stock';

export default function InventoryReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('stock_levels');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleTime, setScheduleTime] = useState(localStorage.getItem('inventoryReportSchedule') || '');
  const [batchView, setBatchView] = useState<{ medicine: any; batches: any[] } | null>(null);
  
  // Custom states for Print and Export preferences
  const [isPrintConfirmOpen, setIsPrintConfirmOpen] = useState(false);
  const [preferredFormat, setPreferredFormat] = useState<string>('PDF');
  const [systemName, setSystemName] = useState('Smart Health Hospital');

  // Load configuration and settings
  useEffect(() => {
    const saved = localStorage.getItem('preferred_inventory_export');
    if (saved) {
      setPreferredFormat(saved);
    }
    
    api.getSettings()
      .then((data: any) => {
        if (data && data.systemName) {
          setSystemName(data.systemName);
        }
      })
      .catch(() => {});
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPharmacyReport(reportType);
      setRows(data as any[]);
    } catch (_e) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [reportType, setRows, setLoading]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    const bv = localStorage.getItem('batchView');
    if (bv) setBatchView(JSON.parse(bv));
  }, []);

  const exportCSV = useCallback(() => {
    if (!rows.length) {
      toast.error('No inventory data to export');
      return;
    }
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(`inventory_${reportType}_${dateStr}`, rows);
    toast.success('Inventory report exported to CSV');
  }, [rows, reportType]);

  const handlePrint = () => {
    if (!rows.length) {
      toast.error('No data available to print');
      return;
    }
    setIsPrintConfirmOpen(true);
  };

  const triggerBrowserPrint = () => {
    setIsPrintConfirmOpen(false);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  const handleExportPDF = () => {
    if (!rows.length) {
      toast.error('No inventory data available to export as PDF.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to export the PDF report.');
      return;
    }

    const reportTitleMap: Record<ReportType, string> = {
      stock_levels: 'Current Medicine Stock Levels Report',
      expiry_dates: 'Medicine Expiry Dates & Expiration Audit',
      low_stock: 'Low Stock & Pharmacy Reorder Alert Report'
    };

    const reportTitle = reportTitleMap[reportType] || 'Pharmacy Inventory Report';
    const headers = Object.keys(rows[0]);
    const formattedHeaders = headers.map(h => h.replace(/_/g, ' ').toUpperCase());

    const tableHeadersHtml = formattedHeaders.map(h => `<th style="border: 1px solid #cbd5e1; padding: 10px 12px; background-color: #f1f5f9; text-align: left; font-size: 11px; font-weight: 700; color: #334155;">${h}</th>`).join('');

    const tableRowsHtml = rows.map((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = headers.map(h => `<td style="border: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; color: #1e293b;">${row[h] !== null && row[h] !== undefined ? String(row[h]) : 'N/A'}</td>`).join('');
      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    }).join('');

    const totalStock = rows.reduce((acc, r) => acc + (Number(r.stock_level || r.stock || 0) || 0), 0);

    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Smart Health Manager — ${reportTitle}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
            .logo { font-size: 20px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
            .sub-logo { font-size: 12px; color: #64748b; margin-top: 2px; }
            .meta { text-align: right; font-size: 11px; color: #475569; }
            .title { font-size: 18px; font-weight: 700; margin-bottom: 12px; color: #0f172a; }
            .stats { display: flex; gap: 16px; margin-bottom: 20px; background-color: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .stat-box { flex: 1; }
            .stat-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; }
            .stat-val { font-size: 15px; font-weight: 700; color: #0284c7; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">Smart Health Manager</div>
              <div class="sub-logo">Pharmacy & Medical Inventory System</div>
            </div>
            <div class="meta">
              <div><strong>Generated Date:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>Document Reference:</strong> PDF-RPT-${Date.now().toString().slice(-6)}</div>
            </div>
          </div>

          <div class="title">${reportTitle}</div>

          <div class="stats">
            <div class="stat-box">
              <div class="stat-label">Category Filter</div>
              <div class="stat-val" style="font-size: 13px; color: #334155;">${reportType.replace(/_/g, ' ').toUpperCase()}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Total Item Entries</div>
              <div class="stat-val">${rows.length} Items</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Cumulative Stock Count</div>
              <div class="stat-val">${totalStock > 0 ? totalStock.toLocaleString() : 'N/A'}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>${tableHeadersHtml}</tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            CONFIDENTIAL — Smart Health Management System • Internal Clinical & Pharmacy Report
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(docHtml);
    printWindow.document.close();
    toast.success('Generated PDF printable report successfully');
  };

  const scheduleReport = () => {
    localStorage.setItem('inventoryReportSchedule', scheduleTime);
    toast.success('Scheduled daily report');
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const t = localStorage.getItem('inventoryReportSchedule');
      if (!t) return;
      const [hh, mm] = t.split(':').map(Number);
      const now = new Date();
      if (now.getHours() === hh && now.getMinutes() === mm) {
        exportCSV();
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [exportCSV]);

  const saveBatch = (medicineId: string, batches: any[]) => {
    localStorage.setItem(`inventoryBatches:${medicineId}`, JSON.stringify(batches));
    setBatchView((prev) => (prev ? { medicine: prev.medicine, batches } : prev));
    toast.success('Batches saved');
  };

  const batchExpiredCount = useMemo(() => {
    if (!batchView) return 0;
    const now = new Date();
    return batchView.batches.filter((b) => new Date(b.expiryDate) < now && !b.recalled).length;
  }, [batchView]);

  const reportTitle =
    reportType === 'stock_levels'
      ? 'Current Stock Levels Report'
      : reportType === 'expiry_dates'
      ? 'Medication Expiry Dates Report'
      : 'Low Stock & Critical Inventory Report';

  return (
    <div className="space-y-6">
      {/* Print-only Standard Header with Hospital Name & Date */}
      <div className="print-only-header">
        <h1 className="print-only-header-title">{systemName}</h1>
        <div className="print-only-header-meta">
          <span><strong>Report:</strong> {reportTitle}</span>
          <span><strong>Date:</strong> {new Date().toLocaleString()}</span>
          <span><strong>Records:</strong> {rows.length} Items</span>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Reports</h1>
          <p className="text-muted-foreground">Generate, export, print and schedule inventory reports</p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Daily Schedule (HH:MM)</Label>
            <Input
              placeholder="08:00"
              className="h-9 w-28 text-sm"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-9" onClick={scheduleReport}>
            <Clock className="h-4 w-4 mr-1" />
            Schedule
          </Button>
          <Button 
            variant={preferredFormat === 'PDF' ? 'default' : 'outline'} 
            className="h-9 gap-1" 
            onClick={handleExportPDF} 
            title="Export report to PDF"
          >
            <FileText className="h-4 w-4 text-red-500" />
            <span>Export PDF</span>
            {preferredFormat === 'PDF' && (
              <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                Pref
              </span>
            )}
          </Button>
          <Button variant="outline" className="h-9 gap-1" onClick={handlePrint} title="Print printer-friendly report">
            <Printer className="h-4 w-4 text-sky-500" />
            <span>Print</span>
          </Button>
          <Button 
            variant={preferredFormat === 'CSV' ? 'default' : 'outline'} 
            className="h-9 gap-1" 
            onClick={exportCSV} 
            title="Export report to CSV"
          >
            <Download className="h-4 w-4 text-emerald-500" />
            <span>Export CSV</span>
            {preferredFormat === 'CSV' && (
              <span className="ml-1 text-[10px] bg-emerald-500 text-white rounded-full px-1.5 py-0.5 font-bold">
                Pref
              </span>
            )}
          </Button>
        </div>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader className="print:pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>{reportTitle}</CardTitle>
            <div className="print:hidden">
              <select
                className="border border-border bg-background text-foreground rounded-md px-3 py-1.5 text-sm"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
              >
                <option value="stock_levels">Stock Levels</option>
                <option value="expiry_dates">Expiry Dates</option>
                <option value="low_stock">Low Stock</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12"><p className="text-muted-foreground">Loading report...</p></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12"><p className="text-muted-foreground">No data available for this report.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(rows[0]).map((h) => (
                      <TableHead key={h} className="capitalize font-semibold">
                        {h.replace(/_/g, ' ')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      {Object.keys(rows[0]).map((h) => (
                        <TableCell key={h}>{String(r[h] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {batchView && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Batches for {batchView.medicine.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Expired batches: {batchExpiredCount}</p>
              <Button variant="outline" onClick={() => setBatchView({ medicine: batchView.medicine, batches: [...batchView.batches, { batchNumber: '', expiryDate: '', quantity: 0, recalled: false }] })}>Add Batch</Button>
              <div className="space-y-2">
                {batchView.batches.map((b, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2">
                    <Input placeholder="Batch #" value={b.batchNumber} onChange={(e) => {
                      const copy = [...batchView.batches];
                      copy[idx].batchNumber = e.target.value;
                      setBatchView({ medicine: batchView.medicine, batches: copy });
                    }} />
                    <Input type="date" value={b.expiryDate} onChange={(e) => {
                      const copy = [...batchView.batches];
                      copy[idx].expiryDate = e.target.value;
                      setBatchView({ medicine: batchView.medicine, batches: copy });
                    }} />
                    <Input type="number" value={b.quantity} onChange={(e) => {
                      const copy = [...batchView.batches];
                      copy[idx].quantity = Number(e.target.value);
                      setBatchView({ medicine: batchView.medicine, batches: copy });
                    }} />
                    <Button variant="outline" onClick={() => {
                      const copy = [...batchView.batches];
                      copy[idx].recalled = !copy[idx].recalled;
                      setBatchView({ medicine: batchView.medicine, batches: copy });
                      toast.info(copy[idx].recalled ? 'Batch recalled' : 'Recall removed');
                    }}>{b.recalled ? 'Un-recall' : 'Recall'}</Button>
                    <Button variant="outline" onClick={() => setBatchView({ medicine: batchView.medicine, batches: batchView.batches.filter((_, i) => i !== idx) })}>Remove</Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => saveBatch(batchView.medicine.id, batchView.batches)}>Save Batches</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Confirmation Dialog */}
      <Dialog open={isPrintConfirmOpen} onOpenChange={setIsPrintConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Print Report</DialogTitle>
            <DialogDescription>
              Is the {reportTitle} fully generated and ready to be printed? This will open the system browser print dialog.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsPrintConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={triggerBrowserPrint} className="bg-sky-600 hover:bg-sky-700 text-white">
              Yes, Print Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
