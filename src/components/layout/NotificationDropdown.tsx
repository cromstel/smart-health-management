import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/contexts/NotificationContext';
import type { NotificationItem } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Activity,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Pill,
} from 'lucide-react';

export function NotificationDropdown() {
  const {
    notifications,
    unreadCount,
    pendingCount,
    markAsRead,
    markAllAsRead,
    confirmAppointment,
    dismissNotification,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'upcoming'>('all');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'pending') {
      return n.type === 'pending_confirmation';
    }
    if (activeTab === 'upcoming') {
      return n.type === 'upcoming_appointment';
    }
    return true;
  });

  const getNotificationIcon = (type: NotificationItem['type'], status?: string) => {
    if (status === 'confirmed') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    switch (type) {
      case 'pending_confirmation':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'upcoming_appointment':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'vitals_alert':
        return <Activity className="h-4 w-4 text-rose-500" />;
      case 'inventory_alert':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'prescription_refill':
        return <Pill className="h-4 w-4 text-indigo-500" />;
      default:
        return <Bell className="h-4 w-4 text-accent" />;
    }
  };

  const handleActionClick = (n: NotificationItem) => {
    markAsRead(n.id);
    setOpen(false);
    if (n.actionUrl) {
      navigate(n.actionUrl);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative text-foreground hover:text-accent hover:bg-secondary"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          {pendingCount > 0 && unreadCount === 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-amber-500" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-96 p-0 shadow-2xl border border-border bg-card text-card-foreground rounded-lg"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-3.5 bg-muted/40">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent" />
            <h4 className="font-semibold text-sm text-foreground">Notifications & Alerts</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 bg-card text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'pending'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Pending Confirmations</span>
            {pendingCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Upcoming
          </button>
        </div>

        {/* Notification List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Sparkles className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No active {activeTab !== 'all' ? activeTab : ''} notifications at this time.
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isPending = n.type === 'pending_confirmation' && n.status === 'pending';
              return (
                <div
                  key={n.id}
                  className={`p-3 transition-colors ${
                    !n.read ? 'bg-secondary/40' : 'bg-card hover:bg-secondary/20'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-md bg-muted border border-border shrink-0 mt-0.5">
                      {getNotificationIcon(n.type, n.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${!n.read ? 'text-foreground' : 'text-foreground/80'}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{n.timestamp}</span>
                          <button
                            onClick={() => dismissNotification(n.id)}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                            title="Dismiss"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>

                      {/* Status indicator badges */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {isPending ? (
                          <Badge variant="outline" className="text-[10px] border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                            Pending Staff Confirmation
                          </Badge>
                        ) : n.status === 'confirmed' ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                            Confirmed
                          </Badge>
                        ) : n.type === 'upcoming_appointment' ? (
                          <Badge variant="outline" className="text-[10px] border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                            Upcoming Today
                          </Badge>
                        ) : null}

                        {n.appointmentTime && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {n.appointmentTime}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-2 pt-1 border-t border-border/40">
                        {isPending && (
                          <Button
                            size="sm"
                            className="h-6 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            onClick={() => confirmAppointment(n.id, n.appointmentId)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Confirm Now
                          </Button>
                        )}
                        {n.actionUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() => handleActionClick(n)}
                          >
                            <span>View Record</span>
                            <ArrowRight className="h-2.5 w-2.5 ml-1" />
                          </Button>
                        )}
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground ml-auto underline"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-border bg-muted/20 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setOpen(false);
              navigate('/appointments');
            }}
          >
            Manage all appointments & schedules →
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
