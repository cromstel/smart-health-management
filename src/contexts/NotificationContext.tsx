import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { apiRequest } from '@/services/shmsApiClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type NotificationType =
  | 'upcoming_appointment'
  | 'pending_confirmation'
  | 'vitals_alert'
  | 'inventory_alert'
  | 'prescription_refill'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  createdAt: number;
  read: boolean;
  appointmentId?: string;
  patientName?: string;
  patientId?: string;
  doctorName?: string;
  appointmentTime?: string;
  status?: 'pending' | 'confirmed' | 'resolved' | 'dismissed';
  actionUrl?: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  pendingCount: number;
  /** True while an inbox refresh is in flight. */
  isLoading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  confirmAppointment: (notificationId: string, appointmentId?: string) => Promise<void>;
  dismissNotification: (id: string) => void;
  addNotification: (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void;
  refreshNotifications: () => Promise<void>;
  alertStaffForUpcomingAppointments: () => Promise<number>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * The inbox is server-side now.
 *
 * It used to be seeded with five fabricated records and kept in the
 * browser's local storage, which meant a fresh browser showed appointments
 * and patients that did not exist, and a user could edit or delete the trail
 * with one DevTools call. The server owns the inbox: it derives the
 * notifications from real appointments, prescriptions, pharmacy inventory and
 * vitals, and stores them per user.
 */
interface NotificationsResponse {
  notifications?: NotificationItem[];
  total?: number;
  limit?: number;
  offset?: number;
}

/**
 * Dismissed notifications stay in the database (they are part of the record)
 * but are not part of the inbox the user works from.
 */
const isVisible = (item: NotificationItem): boolean => item.status !== 'dismissed';

const toNotificationItem = (raw: any): NotificationItem => ({
  id: String(raw.id),
  type: (raw.type ?? 'system') as NotificationType,
  priority: (raw.priority ?? 'normal') as NotificationPriority,
  title: raw.title ?? '',
  message: raw.message ?? '',
  timestamp: raw.timestamp ?? new Date().toISOString(),
  createdAt: Number(raw.createdAt) || new Date(raw.timestamp ?? Date.now()).getTime(),
  read: Boolean(raw.read),
  appointmentId: raw.appointmentId ?? undefined,
  patientName: raw.patientName ?? undefined,
  patientId: raw.patientId ?? undefined,
  doctorName: raw.doctorName ?? undefined,
  appointmentTime: raw.appointmentTime ?? undefined,
  status: raw.status ?? undefined,
  actionUrl: raw.actionUrl ?? undefined,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Ids already announced with a toast, so a refresh does not re-announce
  // the same urgent appointment on every poll.
  const announcedIdsRef = useRef<Set<string>>(new Set());

  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest<NotificationsResponse>('/notifications');
      const list = Array.isArray(response?.notifications)
        ? response.notifications
        : Array.isArray(response)
          ? (response as unknown as NotificationItem[])
          : [];

      const items = list.map(toNotificationItem).filter(isVisible);

      // Announce a newly arrived, time-critical appointment alert.
      for (const item of items) {
        if (
          item.priority === 'urgent' &&
          item.type === 'upcoming_appointment' &&
          !announcedIdsRef.current.has(item.id)
        ) {
          announcedIdsRef.current.add(item.id);
          toast.warning(`Appointment starting soon: ${item.patientName || 'Patient'}`, {
            duration: 8000,
            description: item.message,
          });
        }
      }

      setNotifications(items);
    } catch (error) {
      // A failed poll must not clear the inbox the user is looking at.
      console.warn('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Creates a notification through the API and returns the stored record.
   */
  const createRemote = useCallback(
    async (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): Promise<NotificationItem | null> => {
      // The server stores the appointment reference as the numeric primary
      // key. The client sometimes holds the public appointment code
      // ("APP-001") instead, which the API cannot resolve, so it is left out
      // rather than sent as a value the server would reject.
      const numericAppointmentId = Number(item.appointmentId);
      const appointmentId =
        Number.isInteger(numericAppointmentId) && numericAppointmentId > 0
          ? numericAppointmentId
          : undefined;

      try {
        const created = await apiRequest<NotificationItem>('/notifications', {
          method: 'POST',
          body: {
            type: item.type,
            priority: item.priority,
            title: item.title,
            message: item.message,
            status: item.status,
            appointmentId,
            patientName: item.patientName,
            doctorName: item.doctorName,
            appointmentTime: item.appointmentTime,
            actionUrl: item.actionUrl,
            data: { createdFrom: 'client' },
          },
        });

        const normalised = toNotificationItem(created);
        setNotifications((prev) => [normalised, ...prev.filter((n) => n.id !== normalised.id)]);
        return normalised;
      } catch (error) {
        console.warn('Failed to create notification:', error);
        return null;
      }
    },
    []
  );

  const addNotification = useCallback(
    (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => {
      void createRemote(item);
    },
    [createRemote]
  );

  const markAsRead = useCallback((id: string) => {
    // Optimistic: the badge must not lag behind the click.
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));

    void (async () => {
      try {
        const updated = await apiRequest<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, {
          method: 'PATCH',
        });
        const normalised = toNotificationItem(updated);
        setNotifications((prev) => prev.map((item) => (item.id === normalised.id ? normalised : item)));
      } catch (error) {
        console.warn('Failed to mark notification as read:', error);
      }
    })();
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));

    void (async () => {
      try {
        await apiRequest('/notifications/read-all', { method: 'PATCH' });
        toast.success('All notifications marked as read');
      } catch (error) {
        console.warn('Failed to mark all notifications as read:', error);
        toast.error('Failed to mark notifications as read');
      }
    })();
  }, []);

  const confirmAppointment = useCallback(
    async (notificationId: string, appointmentId?: string) => {
      try {
        if (appointmentId) {
          try {
            await api.updateAppointment(appointmentId, { status: 'Confirmed' });
          } catch {
            // The appointment update is best effort: the notification state
            // must still be recorded if the appointment service refuses.
          }
        }

        const updated = await apiRequest<NotificationItem>(
          `/notifications/${encodeURIComponent(notificationId)}`,
          { method: 'PATCH', body: { status: 'confirmed' } }
        );

        const normalised = toNotificationItem(updated);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === normalised.id || (appointmentId && item.appointmentId === appointmentId)
              ? { ...item, status: 'confirmed', read: true }
              : item
          )
        );

        toast.success('Appointment confirmed successfully! Notification status updated.');
      } catch (err: any) {
        toast.error(`Failed to confirm appointment: ${err?.message || 'Error'}`);
      }
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    // Removed from the inbox immediately; the row stays on the server with
    // the status 'dismissed'.
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    void (async () => {
      try {
        await apiRequest(`/notifications/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: { status: 'dismissed' },
        });
        toast.info('Notification dismissed');
      } catch (error) {
        console.warn('Failed to dismiss notification:', error);
        toast.error('Failed to dismiss notification');
      }
    })();
  }, []);

  const alertStaffForUpcomingAppointments = useCallback(async (): Promise<number> => {
    try {
      const appts = (await api.getAppointments()) as any[];
      if (!Array.isArray(appts) || appts.length === 0) {
        toast.info('No upcoming appointments found to alert staff.');
        return 0;
      }

      const upcoming = appts.filter((a) => {
        const status = String(a.status ?? '').toLowerCase();
        return ['confirmed', 'scheduled', 'pending'].includes(status);
      });

      let alertedCount = 0;

      for (const a of upcoming) {
        const pName = `${a.patient_first_name || ''} ${a.patient_last_name || a.patientName || 'Patient'}`.trim();
        const dName = `Dr. ${a.doctor_first_name || ''} ${a.doctor_last_name || a.doctorName || 'Doctor'}`.trim();
        const apptTimeStr = `${a.appointment_date || 'Today'}, ${a.appointment_time || 'Scheduled Time'}`;

        const created = await createRemote({
          type: 'upcoming_appointment',
          priority: 'high',
          title: `Staff Alert: Upcoming ${a.type || 'Appointment'}`,
          message: `${pName} has an upcoming appointment with ${dName} (${apptTimeStr}). Staff notified!`,
          timestamp: 'Staff Alert',
          appointmentId: a.id || a.appointment_id,
          patientName: pName,
          doctorName: dName,
          appointmentTime: apptTimeStr,
          status: 'confirmed',
          actionUrl: `/appointments?search=${encodeURIComponent(pName)}`,
        });

        if (created) alertedCount += 1;
      }

      toast.success(`Dispatched notifications for ${alertedCount} upcoming appointments to medical staff!`);
      return alertedCount;
    } catch {
      toast.error('Failed to trigger staff appointment alerts');
      return 0;
    }
  }, [createRemote]);

  // Wait for a real session before polling. These helpers hit authenticated
  // endpoints (/api/notifications), and this provider wraps the whole app
  // including the public landing and auth pages, so an unauthenticated
  // visitor would accumulate a 401 every 30 seconds.
  const { isAuthenticated, isAuthLoading } = useAuth();

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;

    refreshNotifications();

    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshNotifications, isAuthenticated, isAuthLoading]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pendingCount = notifications.filter(
    (n) => n.type === 'pending_confirmation' && n.status === 'pending'
  ).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        pendingCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        confirmAppointment,
        dismissNotification,
        addNotification,
        refreshNotifications,
        alertStaffForUpcomingAppointments,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
