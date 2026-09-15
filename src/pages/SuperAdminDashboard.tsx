import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  Users,
  Building2,
  UserPlus,
  Calendar,
  Database,
  Download,
  Upload,
  FileText,
  Settings,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SystemStatus {
  status: string;
  statistics: {
    totalUsers: number;
    totalHospitals: number;
    totalPatients: number;
    totalAppointments: number;
    databaseSize: number;
  };
  timestamp: string;
}

export default function SuperAdminDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadSystemStatus();
  }, []);

  const loadSystemStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getSystemStatus() as SystemStatus;
      setSystemStatus(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      await api.triggerBackup();
      setBackupMessage('Backup initiated successfully. You can monitor it from System Settings.');
    } catch (err: unknown) {
      setBackupMessage(err instanceof Error ? `Failed to trigger backup: ${err.message}` : 'Failed to trigger backup.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-500">Error loading dashboard</p>
            <p className="text-sm text-red-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = systemStatus?.statistics;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">System Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage your health management system</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            systemStatus?.status === 'OK' 
              ? 'bg-green-500/10 text-green-500' 
              : 'bg-red-500/10 text-red-500'
          }`}>
            <Activity className="w-4 h-4 inline mr-1" />
            {systemStatus?.status}
          </div>
        </div>
      </div>

      {backupMessage && (
        <div role="status" className="rounded-lg border border-accent/30 bg-accent/10 p-4 text-sm text-foreground">
          {backupMessage}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hospitals</CardTitle>
            <Building2 className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.totalHospitals || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
            <UserPlus className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.totalPatients || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Appointments</CardTitle>
            <Calendar className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.totalAppointments || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Quick Actions</CardTitle>
          <CardDescription className="text-muted-foreground">
            Perform common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button
            onClick={handleBackup}
            className="justify-start gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20"
            variant="outline"
          >
            <Download className="w-4 h-4" />
            Trigger Backup
          </Button>
          
          <Button
            onClick={() => navigate('/super-admin/operations')}
            className="justify-start gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20"
            variant="outline"
          >
            <Upload className="w-4 h-4" />
            System Upgrade
          </Button>
          
          <Button
            onClick={() => navigate('/super-admin/users')}
            className="justify-start gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20"
            variant="outline"
          >
            <Users className="w-4 h-4" />
            Manage Users
          </Button>
          
          <Button
            onClick={() => navigate('/super-admin/audit-logs')}
            className="justify-start gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20"
            variant="outline"
          >
            <FileText className="w-4 h-4" />
            View Audit Logs
          </Button>
          
          <Button
            onClick={() => navigate('/super-admin/settings')}
            className="justify-start gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20"
            variant="outline"
          >
            <Settings className="w-4 h-4" />
            System Settings
          </Button>
          
          <Button
            onClick={() => navigate('/super-admin/hospitals')}
            className="justify-start gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20"
            variant="outline"
          >
            <Building2 className="w-4 h-4" />
            View Hospitals
          </Button>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="w-4 h-4" />
              <span>Database Size</span>
            </div>
            <span className="text-foreground font-medium">{stats?.databaseSize || 0} MB</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              <span>System Status</span>
            </div>
            <span className="text-green-500 font-medium">{systemStatus?.status}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Last Updated</span>
            </div>
            <span className="text-foreground font-medium">
              {systemStatus?.timestamp ? new Date(systemStatus.timestamp).toLocaleString() : 'N/A'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
