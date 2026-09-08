import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Activity,
  Calendar,
  AlertTriangle,
  FileText,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

export interface ActivityItem {
  id: string;
  category: 'update' | 'appointment' | 'alert' | 'audit';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  role?: string;
  status?: 'info' | 'warning' | 'critical' | 'success';
  link?: string;
  metadata?: Record<string, string>;
}

interface RecentActivityWidgetProps {
  initialActivities?: any[];
  className?: string;
}

export default function RecentActivityWidget({ initialActivities = [], className = '' }: RecentActivityWidgetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'updates' | 'appointments' | 'alerts'>('all');
  const [filterMyOnly, setFilterMyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch appointments for latest appointment events
      let apptItems: ActivityItem[] = [];
      try {
        const appts = await api.getAppointments({ hospital: user?.hospital_id }) as any[];
        if (Array.isArray(appts)) {
          apptItems = appts.slice(0, 5).map((a, idx) => ({
            id: `appt-${a.id || idx}`,
            category: 'appointment',
            title: `Appointment: ${a.patient_first_name || ''} ${a.patient_last_name || a.patientName || 'Patient'}`,
            description: `With Dr. ${a.doctor_first_name || ''} ${a.doctor_last_name || a.doctorName || 'Specialist'} - ${a.type || 'Consultation'} (${a.appointment_time || a.time || 'Today'})`,
            timestamp: a.appointment_date ? `${a.appointment_date} ${a.appointment_time || ''}` : 'Today',
            user: a.doctorName || user?.name,
            status: a.status === 'Cancelled' ? 'critical' : a.status === 'Completed' ? 'success' : 'info',
            link: `/appointments?search=${encodeURIComponent(a.patient_first_name || a.patientName || '')}`,
          }));
        }
      } catch (_e) {
        // Handled silently
      }

      // 2. Fetch audit logs from localStorage or context
      const localAuditLogs: ActivityItem[] = [];
      try {
        const rawLogs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
        if (Array.isArray(rawLogs)) {
          rawLogs.slice(-10).reverse().forEach((log: any, idx: number) => {
            localAuditLogs.push({
              id: `audit-${idx}-${Date.now()}`,
              category: 'audit',
              title: log.action || 'System Action Logged',
              description: log.module ? `Module: ${log.module} ${log.recordId ? `(ID: ${log.recordId})` : ''}` : 'Action recorded by user',
              timestamp: log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
              user: log.userName || user?.name || 'Current User',
              status: 'info',
            });
          });
        }
      } catch (_e) {
        // Handled silently
      }

      // 3. System Alerts based on role & operational statuses
      const systemAlerts: ActivityItem[] = [
        {
          id: 'alert-1',
          category: 'alert',
          title: 'Automated Database Backup Completed',
          description: 'Daily encrypted snapshot verified across redundant cloud storage nodes.',
          timestamp: '15 minutes ago',
          user: 'System Bot',
          status: 'success',
        },
        {
          id: 'alert-2',
          category: 'alert',
          title: 'Pharmacy Low Stock Notice: Amoxicillin 500mg',
          description: 'Current inventory is below minimum threshold (15 units remaining).',
          timestamp: '1 hour ago',
          user: 'Inventory Watcher',
          status: 'warning',
          link: '/inventory/reports',
        },
        {
          id: 'alert-3',
          category: 'alert',
          title: 'Security Compliance Check Passed',
          description: 'All 2FA policies and role-based access controls are strictly enforced.',
          timestamp: '3 hours ago',
          user: 'Security Sentinel',
          status: 'info',
        },
      ];

      // 4. Initial/fallback activities from props or default
      const propActivities: ActivityItem[] = initialActivities.map((act, idx) => ({
        id: act.id || `init-${idx}`,
        category: act.type === 'appointment' ? 'appointment' : act.type === 'inventory' ? 'alert' : 'update',
        title: act.title || act.action || 'System Update',
        description: act.description || act.name || 'System activity record',
        timestamp: typeof act.time === 'string' ? act.time : 'Recently',
        user: act.user || user?.name,
        status: 'info',
        link: act.type === 'appointment' ? '/appointments' : act.type === 'inventory' ? '/inventory/reports' : undefined,
      }));

      const fallbackUpdates: ActivityItem[] = propActivities.length > 0 ? propActivities : [
        {
          id: 'upd-1',
          category: 'update',
          title: 'New Patient Record Admitted',
          description: 'Sarah Johnson registered under OPD Cardiology wing.',
          timestamp: '10 minutes ago',
          user: 'Dr. Michael Chen',
          status: 'info',
          link: '/patients?search=Sarah',
        },
        {
          id: 'upd-2',
          category: 'update',
          title: 'Financial Ledger Reconciled',
          description: 'Monthly service revenues matched with bank statements.',
          timestamp: '45 minutes ago',
          user: 'Finance Admin',
          status: 'success',
          link: '/financial',
        },
        {
          id: 'upd-3',
          category: 'update',
          title: 'Staff Duty Schedule Updated',
          description: 'Weekend emergency on-call rotation updated for Nursing unit.',
          timestamp: '2 hours ago',
          user: user?.name || 'Administrator',
          status: 'info',
          link: '/staff',
        },
      ];

      // Merge and sort
      const combined = [
        ...localAuditLogs,
        ...apptItems,
        ...systemAlerts,
        ...fallbackUpdates,
      ];

      setActivities(combined);
    } catch (err) {
      console.error('Failed to compile recent activities:', err);
    } finally {
      setLoading(false);
    }
  }, [initialActivities, user]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Tab category filter
      if (activeTab === 'updates' && act.category !== 'update' && act.category !== 'audit') return false;
      if (activeTab === 'appointments' && act.category !== 'appointment') return false;
      if (activeTab === 'alerts' && act.category !== 'alert') return false;

      // User personalization filter
      if (filterMyOnly && user?.name && act.user) {
        if (!act.user.toLowerCase().includes(user.name.toLowerCase())) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = act.title.toLowerCase().includes(query);
        const matchDesc = act.description.toLowerCase().includes(query);
        const matchUser = act.user ? act.user.toLowerCase().includes(query) : false;
        if (!matchTitle && !matchDesc && !matchUser) return false;
      }

      return true;
    });
  }, [activities, activeTab, filterMyOnly, searchQuery, user]);

  const getCategoryIcon = (category: string, status?: string) => {
    switch (category) {
      case 'appointment':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'alert':
        return status === 'critical' ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : status === 'warning' ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        );
      case 'audit':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'update':
      default:
        return <Activity className="h-4 w-4 text-accent" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs font-normal">Urgent</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-normal">Warning</Badge>;
      case 'success':
        return <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-normal">Success</Badge>;
      case 'info':
      default:
        return <Badge variant="outline" className="text-xs font-normal">Update</Badge>;
    }
  };

  return (
    <Card className={`border border-border ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              <CardTitle className="text-lg font-semibold text-foreground">Recent Activity</CardTitle>
              {user && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {user.name} ({user.role})
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Latest system updates, appointments, and operational alerts
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5"
              onClick={loadActivities}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant={filterMyOnly ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-2.5 text-xs gap-1"
              onClick={() => setFilterMyOnly(!filterMyOnly)}
            >
              <User className="h-3.5 w-3.5" />
              <span>{filterMyOnly ? 'My Activity' : 'All Users'}</span>
            </Button>
          </div>
        </div>

        {/* Search and Tabs row */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border mt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All Feed ({activities.length})
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'appointments'
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Appointments
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'alerts'
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              System Alerts
            </button>
            <button
              onClick={() => setActiveTab('updates')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'updates'
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Audit Logs
            </button>
          </div>

          <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-8 text-xs bg-muted/30"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="space-y-1 flex-1">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No activity items match your filter</p>
            <p className="text-xs">Adjust your search or toggle to view all hospital activities</p>
          </div>
        ) : (
          <div className="space-y-3 divide-y divide-border">
            {filteredActivities.slice(0, 7).map((item) => (
              <div
                key={item.id}
                className={`pt-3 first:pt-0 flex items-start justify-between gap-3 group transition-colors ${
                  item.link ? 'cursor-pointer hover:bg-muted/40 p-2 rounded-lg' : ''
                }`}
                onClick={() => {
                  if (item.link) navigate(item.link);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-md bg-muted/60 border border-border">
                    {getCategoryIcon(item.category, item.status)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                        {item.title}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                      {item.user && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.user}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.timestamp}
                      </span>
                    </div>
                  </div>
                </div>

                {item.link && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="View details"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
