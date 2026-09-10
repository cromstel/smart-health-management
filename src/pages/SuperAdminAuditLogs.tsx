import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronLeft, ChevronRight, AlertCircle, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { exportAuditLogs } from '@/utils/auditExport';

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: string;
  module: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export default function SuperAdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * limit;
      const data = await api.getAuditLogs(limit, offset) as {
        logs: AuditLog[];
        total: number;
      };
      setLogs(data.logs);
      setTotal(data.total);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filterLogs = useCallback(() => {
    if (!searchTerm) {
      setFilteredLogs(logs);
      return;
    }

    const filtered = logs.filter(
      (log) =>
        log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.module.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredLogs(filtered);
  }, [logs, searchTerm]);

  useEffect(() => {
    filterLogs();
  }, [filterLogs]);

  

  const getActionBadge = (action: string) => {
    const variants: Record<string, any> = {
      create: 'default',
      update: 'secondary',
      delete: 'destructive',
      login: 'default',
      logout: 'secondary',
    };
    return (
      <Badge variant={variants[action.toLowerCase()] || 'outline'}>
        {action}
      </Badge>
    );
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && logs.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">View all system activity and user actions</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 border-border text-foreground hover:bg-muted">
              <Download className="h-4 w-4" />
              Export Logs
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border-border text-popover-foreground">
            <DropdownMenuLabel className="text-popover-foreground/80">Export Audit Records</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              className="hover:bg-muted focus:bg-muted"
              onClick={() =>
                exportAuditLogs(
                  logs.map((l) => ({
                    userId: l.user_id,
                    userName: l.user_name,
                    userEmail: l.user_email,
                    action: l.action,
                    module: l.module,
                    details: l.details,
                    ipAddress: l.ip_address,
                    timestamp: l.created_at,
                  })),
                  'json',
                  'SuperAdmin Logs'
                )
              }
            >
              <FileJson className="mr-2 h-4 w-4 text-accent" />
              <span>Export JSON (Compliance Seal)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="hover:bg-muted focus:bg-muted"
              onClick={() =>
                exportAuditLogs(
                  filteredLogs.map((l) => ({
                    userId: l.user_id,
                    userName: l.user_name,
                    userEmail: l.user_email,
                    action: l.action,
                    module: l.module,
                    details: l.details,
                    ipAddress: l.ip_address,
                    timestamp: l.created_at,
                  })),
                  'csv',
                  'Filtered Logs'
                )
              }
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Export CSV (Filtered - {filteredLogs.length})</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Activity Log ({total} total)</CardTitle>
          <CardDescription className="text-muted-foreground">
            Track all system activities and changes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, action, or module..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>

          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted">
                  <TableHead className="text-muted-foreground">Timestamp</TableHead>
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">Action</TableHead>
                  <TableHead className="text-muted-foreground">Module</TableHead>
                  <TableHead className="text-muted-foreground">Details</TableHead>
                  <TableHead className="text-muted-foreground">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="border-border hover:bg-muted">
                      <TableCell className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-foreground font-medium">{log.user_name || 'System'}</p>
                          <p className="text-xs text-muted-foreground">{log.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-accent/20 text-accent">
                          {log.module}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-md truncate">
                        {log.details}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.ip_address}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * limit + 1} to{' '}
              {Math.min(currentPage * limit, total)} of {total} logs
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-border text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="border-border text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}