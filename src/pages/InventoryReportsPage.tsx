import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Printer, Download, Clock } from 'lucide-react';
import { exportToCSV } from '@/utils/csv';

type ReportType = 'stock_levels' | 'expiry_dates' | 'low_stock';

export default function InventoryReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('stock_levels');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleTime, setScheduleTime] = useState(localStorage.getItem('inventoryReportSchedule') || '');
  const [batchView, setBatchView] = useState<{ medicine: any; batches: any[] } | null>(null);

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
    window.print();
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
      {/* Print-only Official Header */}
      <div className="hidden print:block mb-6 border-b border-gray-400 pb-4">
        <h1 className="text-2xl font-bold text-black">Smart Health Manager — Inventory Report</h1>
        <p className="text-sm text-gray-700 font-medium mt-1">{reportTitle}</p>
        <div className="flex justify-between text-xs text-gray-600 mt-2">
          <span>Generated: {new Date().toLocaleString()}</span>
          <span>Total Records: {rows.length}</span>
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
          <Button variant="outline" className="h-9 gap-1" onClick={handlePrint} title="Print printer-friendly report">
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          <Button className="h-9 gap-1" onClick={exportCSV} title="Export report to CSV">
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
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
    </div>
  );
}
