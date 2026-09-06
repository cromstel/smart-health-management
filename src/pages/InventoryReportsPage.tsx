import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type ReportType = 'stock_levels' | 'expiry_dates' | 'low_stock';

function toCSV(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '').replace(/,/g, ';')).join(','))];
  return lines.join('\n');
}

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
    } catch (_e) { /* Error ignored as per design */
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
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${reportType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported CSV');
  }, [rows, reportType]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Reports</h1>
          <p className="text-muted-foreground">Generate, export and schedule reports</p>
        </div>
        <div className="flex gap-2 items-end">
          <div className="space-y-2">
            <Label>Daily Schedule (HH:MM)</Label>
            <Input placeholder="08:00" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
          </div>
          <Button variant="outline" onClick={scheduleReport}>Schedule</Button>
          <Button onClick={exportCSV}>Export CSV</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Report</CardTitle>
            <select className="border rounded p-2" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
              <option value="stock_levels">Stock Levels</option>
              <option value="expiry_dates">Expiry Dates</option>
              <option value="low_stock">Low Stock</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12"><p className="text-muted-foreground">Loading report...</p></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12"><p className="text-muted-foreground">No data.</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(rows[0]).map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    {Object.keys(rows[0]).map((h) => (
                      <TableCell key={h}>{String(r[h])}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {batchView && (
        <Card>
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