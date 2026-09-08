import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Check,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface UpcomingAppointmentsAlertWidgetProps {
  className?: string;
}

export default function UpcomingAppointmentsAlertWidget({
  className = '',
}: UpcomingAppointmentsAlertWidgetProps) {
  const { notifications, confirmAppointment, pendingCount } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const navigate = useNavigate();

  // Filter relevant appointment notifications
  const appointmentAlerts = notifications.filter(
    (n) => n.type === 'pending_confirmation' || n.type === 'upcoming_appointment'
  );

  const displayedAlerts = appointmentAlerts.filter((n) => {
    if (filter === 'pending') return n.status === 'pending';
    if (filter === 'confirmed') return n.status === 'confirmed';
    return true;
  });

  return (
    <Card className={`border border-border ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />
              <CardTitle className="text-lg font-semibold text-foreground">
                Staff Alerts & Upcoming Appointments
              </CardTitle>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="text-xs px-2 py-0.5 animate-pulse">
                  {pendingCount} Pending Confirmation
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Monitor scheduled patient visits and authorize pending booking requests
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-secondary text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({appointmentAlerts.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                filter === 'pending'
                  ? 'bg-secondary text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold inline-flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setFilter('confirmed')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === 'confirmed'
                  ? 'bg-secondary text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Confirmed
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Pending Banner Alert if pending items exist */}
        {pendingCount > 0 && filter !== 'confirmed' && (
          <div className="mb-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                <span className="font-bold">{pendingCount} patient appointment(s)</span> are awaiting clinic confirmation before reminder dispatch.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 shrink-0"
              onClick={() => setFilter('pending')}
            >
              Review Pending
            </Button>
          </div>
        )}

        {displayedAlerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-7 w-7 mx-auto mb-1.5 opacity-60" />
            <p className="text-sm font-medium">No appointments match the selected filter</p>
            <p className="text-xs">All scheduled consultations are current and confirmed.</p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {displayedAlerts.map((alert) => {
              const isPending = alert.status === 'pending';
              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border transition-all flex flex-col justify-between ${
                    isPending
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-border bg-card hover:border-accent/40'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {alert.patientName || 'Patient'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {alert.doctorName || 'Doctor'}
                        </p>
                      </div>

                      {isPending ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold shrink-0"
                        >
                          Pending Confirmation
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold shrink-0 flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Confirmed
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="h-3 w-3 text-accent" />
                        {alert.appointmentTime || alert.timestamp}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {alert.message}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-border/50">
                    {isPending ? (
                      <Button
                        size="sm"
                        className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1"
                        onClick={() => confirmAppointment(alert.id, alert.appointmentId)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Confirm Booking
                      </Button>
                    ) : (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Status verified
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground ml-auto"
                      onClick={() => navigate(alert.actionUrl || '/appointments')}
                    >
                      <span>View</span>
                      <ArrowUpRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
