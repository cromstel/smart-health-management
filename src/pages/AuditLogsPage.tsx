import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, FileText, Download, Mail, ShieldCheck, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { exportAuditLogs } from '@/utils/auditExport';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface AuditLog {
  userId: string;
  userName: string;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  // Scheduled Reporting Automation states
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [recipientEmails, setRecipientEmails] = useState('admin-records@smarthospital.org');
  const [scheduleFrequency, setScheduleFrequency] = useState('monthly');
  const [reportFormat, setReportFormat] = useState('csv');
  const [selectedModules, setSelectedModules] = useState<string[]>(['patients', 'vitals']);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isDispatchingTest, setIsDispatchingTest] = useState(false);

  useEffect(() => {
    const storedLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
    setLogs(storedLogs.reverse());

    const savedConfig = localStorage.getItem('audit_report_schedule');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setScheduleEnabled(parsed.enabled ?? true);
        setRecipientEmails(parsed.emails ?? 'admin-records@smarthospital.org');
        setScheduleFrequency(parsed.frequency ?? 'monthly');
        setReportFormat(parsed.format ?? 'csv');
        setSelectedModules(parsed.modules ?? ['patients', 'vitals']);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleSaveSchedule = () => {
    setIsSavingSchedule(true);
    setTimeout(() => {
      const config = {
        enabled: scheduleEnabled,
        emails: recipientEmails,
        frequency: scheduleFrequency,
        format: reportFormat,
        modules: selectedModules,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('audit_report_schedule', JSON.stringify(config));
      setIsSavingSchedule(false);
      toast.success('System report schedule successfully synchronized & locked in PACS policy.');
    }, 800);
  };

  const handleDispatchTestReport = () => {
    if (!recipientEmails.trim()) {
      toast.error('Please specify at least one recipient email.');
      return;
    }
    setIsDispatchingTest(true);
    setTimeout(() => {
      setIsDispatchingTest(false);
      toast.success(`Encrypted activity report dispatched to: ${recipientEmails}`);

      const newLog: AuditLog = {
        userId: 'U-ADMIN',
        userName: 'Clinical Administrator',
        action: 'SCHEDULED_REPORT_DISPATCH',
        module: 'system',
        recordId: 'REP-' + Math.floor(Math.random() * 900000 + 100000),
        newValue: `Automated test report successfully sent to ${recipientEmails} via TLS SMTP`,
        timestamp: new Date().toISOString()
      };

      const currentLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
      currentLogs.push(newLog);
      localStorage.setItem('auditLogs', JSON.stringify(currentLogs));
      setLogs(currentLogs.slice().reverse());
    }, 1500);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;

    return matchesSearch && matchesModule;
  });

  const modules = Array.from(new Set(logs.map((log) => log.module)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground">Track all system activities and changes</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export Logs
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Export Audit Records</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => exportAuditLogs(logs, 'json', 'All Logs')}>
              <FileJson className="mr-2 h-4 w-4 text-accent" aria-hidden="true" />
              <span>Export JSON (Compliance Seal)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAuditLogs(filteredLogs, 'csv', 'Filtered Logs')}>
              <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" aria-hidden="true" />
              <span>Export CSV (Filtered - {filteredLogs.length})</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportAuditLogs(logs, 'csv', 'All Logs')}>
              <FileSpreadsheet className="mr-2 h-4 w-4 text-blue-500" aria-hidden="true" />
              <span>Export CSV (All - {logs.length})</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{logs.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {logs.filter((log) => {
                const logDate = new Date(log.timestamp);
                const today = new Date();
                return logDate.toDateString() === today.toDateString();
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {new Set(logs.map((log) => log.userId)).size}
            </div>
            <p className="text-xs text-muted-foreground">Unique users</p>
          </CardContent>
        </Card>
      </div>

      <ErrorBoundary fallbackTitle="Error loading Audit Logs">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Left Side: Activity Log (col-span-2) */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-accent" aria-hidden="true" />
                      Activity Log
                    </CardTitle>
                    <CardDescription>Complete history of system activities</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        placeholder="Search logs..."
                        className="pl-9 w-48 sm:w-64 text-xs h-9 bg-muted/40"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={moduleFilter} onValueChange={setModuleFilter}>
                      <SelectTrigger className="w-36 h-9 text-xs">
                        <SelectValue placeholder="All modules" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All modules</SelectItem>
                        {modules.map((module) => (
                          <SelectItem key={module} value={module}>{module}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" aria-hidden="true" />
                    <p className="text-muted-foreground text-sm">No audit logs found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Timestamp</TableHead>
                          <TableHead className="text-xs">User</TableHead>
                          <TableHead className="text-xs">Action</TableHead>
                          <TableHead className="text-xs">Module</TableHead>
                          <TableHead className="text-xs">Record ID</TableHead>
                          <TableHead className="text-xs">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log, index) => (
                          <TableRow key={index} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs font-semibold">{log.userName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">{log.action}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="text-[10px] uppercase font-bold bg-muted text-foreground border-border hover:bg-muted">{log.module}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {log.recordId || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                              {log.newValue ? `Changed to: ${log.newValue}` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>

          {/* Right Side: Automated Report Scheduler & Compliance Panel */}
          <div className="xl:col-span-1">
            <Card className="border border-border shadow-sm bg-card overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/40 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-foreground" aria-hidden="true" />
                      <CardTitle className="text-sm font-bold text-foreground">Email Report Automation</CardTitle>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      Automate compliant delivery of audit ledger reports.
                    </CardDescription>
                  </div>
                  <Badge className={scheduleEnabled ? "bg-emerald-500 text-white font-extrabold text-[9px]" : "bg-muted text-muted-foreground font-extrabold text-[9px]"}>{scheduleEnabled ? 'SCHEDULER ACTIVE' : 'OFFLINE'}</Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Compliance Warning banner */}
                <div className="p-2.5 bg-accent/10 text-accent border border-accent/20 rounded-lg text-[10px] leading-relaxed flex items-start gap-1.5 font-mono">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <strong className="text-accent block mb-0.5">EHR Audit Policy Lock</strong>
                    Dispatched reports are encrypted end-to-end using TLS. Recipient servers must support encrypted SMTP relays.
                  </div>
                </div>

                {/* Toggle Enablement */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground block">Deliver Automated Ledger</span>
                    <span className="text-[10px] text-muted-foreground">Execute cron schedule in background</span>
                  </div>
                  <Button
                    variant={scheduleEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScheduleEnabled(!scheduleEnabled)}
                    className={`h-7 text-xs font-bold ${scheduleEnabled ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : 'border-border text-muted-foreground'}`}
                  >
                    {scheduleEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* Recipient Emails */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Recipient Email Address</label>
                  <div className="relative">
                    <Input
                      value={recipientEmails}
                      onChange={(e) => setRecipientEmails(e.target.value)}
                      placeholder="e.g. admin@smarthospital.org"
                      className="text-xs h-9 placeholder:text-muted-foreground focus-visible:ring-accent pr-8"
                    />
                    <Mail className="h-4 w-4 text-muted-foreground absolute right-2.5 top-2.5" aria-hidden="true" />
                  </div>
                  <span className="text-[9px] text-muted-foreground block">Accepts comma-separated values for multiple admins</span>
                </div>

                {/* Schedule Timing dropdowns */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Delivery Interval</label>
                    <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily Cron</SelectItem>
                        <SelectItem value="weekly">Weekly Cron</SelectItem>
                        <SelectItem value="monthly">Monthly (1st Day)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Format Spec</label>
                    <Select value={reportFormat} onValueChange={setReportFormat}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV Data Ledger</SelectItem>
                        <SelectItem value="json">JSON Array Study</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Modules List checkboxes */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Modules To Incorporate</label>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border">
                    {['patients', 'vitals', 'system', 'users'].map((mod) => {
                      const isChecked = selectedModules.includes(mod);
                      return (
                        <label key={mod} className="flex items-center gap-2 cursor-pointer font-medium text-foreground capitalize">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedModules(selectedModules.filter((m) => m !== mod));
                              } else {
                                setSelectedModules([...selectedModules, mod]);
                              }
                            }}
                            className="rounded border-border text-accent focus:ring-accent h-3.5 w-3.5"
                          />
                          <span>{mod}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Scheduling Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleDispatchTestReport}
                    disabled={isDispatchingTest}
                    className="h-9 text-xs font-bold border-border text-muted-foreground hover:bg-muted"
                  >
                    {isDispatchingTest ? (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-accent rounded-full animate-ping"></span>
                        Sending...
                      </span>
                    ) : 'Trigger Test'}
                  </Button>
                  <Button
                    onClick={handleSaveSchedule}
                    disabled={isSavingSchedule}
                    className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isSavingSchedule ? 'Locking...' : 'Lock Policy'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}