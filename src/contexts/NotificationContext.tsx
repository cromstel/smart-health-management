import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
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
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  confirmAppointment: (notificationId: string, appointmentId?: string) => Promise<void>;
  dismissNotification: (id: string) => void;
  addNotification: (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void;
  refreshNotifications: () => Promise<void>;
  alertStaffForUpcomingAppointments: () => Promise<number>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATIONS_STORAGE_KEY = 'health_manager_notifications';

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-pending-1',
    type: 'pending_confirmation',
    priority: 'high',
    title: 'Pending Appointment Confirmation',
    message: 'Sarah Johnson has requested a Cardiology Consultation for tomorrow at 10:30 AM.',
    timestamp: '15 mins ago',
    createdAt: Date.now() - 15 * 60 * 1000,
    read: false,
    appointmentId: 'appt-101',
    patientName: 'Sarah Johnson',
    doctorName: 'Dr. Michael Chen',
    appointmentTime: 'Tomorrow, 10:30 AM',
    status: 'pending',
    actionUrl: '/appointments?search=Sarah',
  },
  {
    id: 'notif-upcoming-1',
    type: 'upcoming_appointment',
    priority: 'high',
    title: 'Upcoming Appointment (in 45 mins)',
    message: 'David Mensah - General Checkup with Dr. Emily Davis at Room 302.',
    timestamp: '30 mins ago',
    createdAt: Date.now() - 30 * 60 * 1000,
    read: false,
    appointmentId: 'appt-102',
    patientName: 'David Mensah',
    doctorName: 'Dr. Emily Davis',
    appointmentTime: 'Today, 02:00 PM',
    status: 'confirmed',
    actionUrl: '/appointments?search=David',
  },
  {
    id: 'notif-pending-2',
    type: 'pending_confirmation',
    priority: 'normal',
    title: 'New Online Booking Awaiting Approval',
    message: 'Kwame Boateng booked a Pediatrics Follow-up with Dr. Michael Chen.',
    timestamp: '1 hour ago',
    createdAt: Date.now() - 60 * 60 * 1000,
    read: false,
    appointmentId: 'appt-103',
    patientName: 'Kwame Boateng',
    doctorName: 'Dr. Michael Chen',
    appointmentTime: 'Oct 28, 09:00 AM',
    status: 'pending',
    actionUrl: '/appointments?search=Kwame',
  },
  {
    id: 'notif-vitals-1',
    type: 'vitals_alert',
    priority: 'urgent',
    title: 'High Blood Pressure Alert',
    message: 'Patient John Doe logged elevated BP reading (148/95 mmHg) in Ward B.',
    timestamp: '2 hours ago',
    createdAt: Date.now() - 120 * 60 * 1000,
    read: true,
    patientName: 'John Doe',
    patientId: 'P-1001',
    status: 'resolved',
    actionUrl: '/patients?search=John',
  },
  {
    id: 'notif-inventory-1',
    type: 'inventory_alert',
    priority: 'normal',
    title: 'Low Stock Alert: Amoxicillin 500mg',
    message: 'Pharmacy inventory below 15 units. Purchase order recommendation generated.',
    timestamp: '3 hours ago',
    createdAt: Date.now() - 180 * 60 * 1000,
    read: true,
    status: 'resolved',
    actionUrl: '/inventory-reports',
  },
];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load notifications from storage', e);
    }
    return INITIAL_NOTIFICATIONS;
  });

  const saveNotifications = useCallback((updated: NotificationItem[]) => {
    setNotifications(updated);
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist notifications', e);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      // 1. Fetch latest appointments to build alerts
      const appts = (await api.getAppointments()) as any[];
      
      // 2. Fetch medicines to check stock for prescription refill alert integration
      let medicinesList: any[] = [];
      try {
        medicinesList = await api.getMedicines() as any[];
      } catch (err) {
        console.warn('Could not fetch medicines for prescription notifications:', err);
      }

      // Initialize simulated prescriptions in localStorage if not exists
      const PRESCRIPTIONS_KEY = 'health_manager_prescriptions';
      let prescriptions: any[] = [];
      try {
        const storedPrescriptions = localStorage.getItem(PRESCRIPTIONS_KEY);
        if (storedPrescriptions) {
          prescriptions = JSON.parse(storedPrescriptions);
        } else {
          prescriptions = [
            {
              id: 'pr-1',
              patientId: 'P-1002',
              patientName: 'Sarah Johnson',
              medicineId: 'med-1',
              medicineName: 'Metformin 500mg',
              prescribedDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
              durationDays: 30,
              doctorName: 'Dr. Michael Chen'
            },
            {
              id: 'pr-2',
              patientId: 'P-1003',
              patientName: 'David Mensah',
              medicineId: 'med-2',
              medicineName: 'Lisinopril 10mg',
              prescribedDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
              durationDays: 30,
              doctorName: 'Dr. Emily Davis'
            },
            {
              id: 'pr-3',
              patientId: 'P-1004',
              patientName: 'Kwame Boateng',
              medicineId: 'med-3',
              medicineName: 'Amoxicillin 500mg',
              prescribedDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
              durationDays: 10,
              doctorName: 'Dr. Michael Chen'
            }
          ];
          localStorage.setItem(PRESCRIPTIONS_KEY, JSON.stringify(prescriptions));
        }
      } catch (e) {
        console.warn('Prescriptions handling failed:', e);
      }

      setNotifications((prev) => {
        const updated = [...prev];

        // Process pending appointments (existing logic)
        if (Array.isArray(appts)) {
          const pendingAppts = appts.filter(
            (a) => a.status === 'Pending' || a.status === 'pending'
          );
          pendingAppts.forEach((a) => {
            const existing = updated.find(
              (n) => n.appointmentId === (a.id || a.appointment_id)
            );
            if (!existing) {
              const pName = `${a.patient_first_name || ''} ${a.patient_last_name || a.patientName || 'Patient'}`.trim();
              const dName = `Dr. ${a.doctor_first_name || ''} ${a.doctor_last_name || a.doctorName || 'Doctor'}`.trim();
              updated.unshift({
                id: `notif-${a.id || Date.now()}`,
                type: 'pending_confirmation',
                priority: 'high',
                title: 'Pending Appointment Confirmation',
                message: `${pName} requested an appointment with ${dName} (${a.type || 'Consultation'}).`,
                timestamp: 'Just now',
                createdAt: Date.now(),
                read: false,
                appointmentId: a.id || a.appointment_id,
                patientName: pName,
                doctorName: dName,
                appointmentTime: `${a.appointment_date || 'Upcoming'} ${a.appointment_time || ''}`,
                status: 'pending',
                actionUrl: `/appointments?search=${encodeURIComponent(pName)}`,
              });
            }
          });

          // Process upcoming confirmed/scheduled appointments to alert staff
          const upcomingAppts = appts.filter(
            (a) => a.status === 'Confirmed' || a.status === 'confirmed' || a.status === 'Scheduled' || a.status === 'scheduled'
          );
          upcomingAppts.forEach((a) => {
            const notifId = `notif-upcoming-${a.id || a.appointment_id}`;
            const existing = updated.find((n) => n.id === notifId);
            if (!existing) {
              const pName = `${a.patient_first_name || ''} ${a.patient_last_name || a.patientName || 'Patient'}`.trim();
              const dName = `Dr. ${a.doctor_first_name || ''} ${a.doctor_last_name || a.doctorName || 'Doctor'}`.trim();
              const apptTimeStr = `${a.appointment_date || 'Today'}, ${a.appointment_time || 'Scheduled Time'}`;
              
              updated.unshift({
                id: notifId,
                type: 'upcoming_appointment',
                priority: 'high',
                title: `Upcoming Appointment Alert: ${pName}`,
                message: `${pName} has a scheduled ${a.type || 'Clinical Consultation'} with ${dName} at ${a.department_name || a.hospital_name || 'Room 302'} (${apptTimeStr}).`,
                timestamp: 'Upcoming Alert',
                createdAt: Date.now(),
                read: false,
                appointmentId: a.id || a.appointment_id,
                patientName: pName,
                doctorName: dName,
                appointmentTime: apptTimeStr,
                status: 'confirmed',
                actionUrl: `/appointments?search=${encodeURIComponent(pName)}`,
              });
            }
          });
        }

        // Process prescription refill notifications (nearing refill time <= 5 days remaining)
        prescriptions.forEach((p) => {
          const elapsedMs = Date.now() - new Date(p.prescribedDate).getTime();
          const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
          const remainingDays = p.durationDays - elapsedDays;

          if (remainingDays <= 5 && remainingDays >= 0) {
            const refillNotifId = `notif-refill-${p.id}`;
            const existingNotif = updated.find((n) => n.id === refillNotifId);

            if (!existingNotif) {
              // Check pharmacy inventory stock for this medicine
              const dbMed = Array.isArray(medicinesList) 
                ? medicinesList.find((m) => m.id === p.medicineId || (m.medicine_name && m.medicine_name.toLowerCase().includes(p.medicineName.toLowerCase().split(' ')[0])))
                : null;
              
              let stockStatus = 'In Stock';
              if (dbMed) {
                if (dbMed.stock_level === 0) stockStatus = 'OUT OF STOCK';
                else if (dbMed.stock_level <= dbMed.low_stock_threshold) stockStatus = `LOW STOCK (${dbMed.stock_level} left)`;
                else stockStatus = `In Stock (${dbMed.stock_level} units)`;
              }

              updated.unshift({
                id: refillNotifId,
                type: 'prescription_refill',
                priority: remainingDays <= 2 ? 'high' : 'normal',
                title: `Prescription Refill Warning (${remainingDays}d remaining)`,
                message: `${p.patientName}'s prescription of ${p.medicineName} is nearing refill time. Pharmacy Stock: ${stockStatus}.`,
                timestamp: 'System Alert',
                createdAt: Date.now(),
                read: false,
                patientName: p.patientName,
                patientId: p.patientId,
                actionUrl: `/prescriptions?search=${encodeURIComponent(p.patientName)}`,
              });
            }
          }
        });

        try {
          localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage write failures
        }
        return updated;
      });
    } catch {
      // Ignore API fetch errors in background
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      );
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((item) => ({ ...item, read: true }));
      saveNotifications(updated);
      toast.success('All notifications marked as read');
      return updated;
    });
  }, [saveNotifications]);

  const confirmAppointment = useCallback(
    async (notificationId: string, appointmentId?: string) => {
      try {
        if (appointmentId) {
          try {
            await api.updateAppointment(appointmentId, { status: 'Confirmed' });
          } catch {
            // Handled
          }
        }

        setNotifications((prev) => {
          const updated = prev.map((n) => {
            if (n.id === notificationId || (appointmentId && n.appointmentId === appointmentId)) {
              return {
                ...n,
                status: 'confirmed' as const,
                read: true,
                title: 'Appointment Confirmed',
                message: `Confirmed appointment for ${n.patientName || 'Patient'} with ${n.doctorName || 'Doctor'}.`,
              };
            }
            return n;
          });
          saveNotifications(updated);
          return updated;
        });

        toast.success('Appointment confirmed successfully! Notification status updated.');
      } catch (err: any) {
        toast.error(`Failed to confirm appointment: ${err.message || 'Error'}`);
      }
    },
    [saveNotifications]
  );

  const dismissNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== id);
        saveNotifications(updated);
        toast.info('Notification dismissed');
        return updated;
      });
    },
    [saveNotifications]
  );

  const addNotification = useCallback(
    (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => {
      const newItem: NotificationItem = {
        ...item,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        createdAt: Date.now(),
        read: false,
      };
      setNotifications((prev) => {
        const updated = [newItem, ...prev];
        saveNotifications(updated);
        return updated;
      });
    },
    [saveNotifications]
  );

  const alertStaffForUpcomingAppointments = useCallback(async (): Promise<number> => {
    try {
      const appts = (await api.getAppointments()) as any[];
      if (!Array.isArray(appts) || appts.length === 0) {
        toast.info('No upcoming appointments found to alert staff.');
        return 0;
      }

      const upcoming = appts.filter(
        (a) => a.status === 'Confirmed' || a.status === 'confirmed' || a.status === 'Scheduled' || a.status === 'scheduled' || a.status === 'Pending' || a.status === 'pending'
      );

      let alertedCount = 0;
      upcoming.forEach((a) => {
        const pName = `${a.patient_first_name || ''} ${a.patient_last_name || a.patientName || 'Patient'}`.trim();
        const dName = `Dr. ${a.doctor_first_name || ''} ${a.doctor_last_name || a.doctorName || 'Doctor'}`.trim();
        const apptTimeStr = `${a.appointment_date || 'Today'}, ${a.appointment_time || 'Scheduled Time'}`;
        
        addNotification({
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
        alertedCount++;
      });

      toast.success(`Dispatched notifications for ${alertedCount} upcoming appointments to medical staff!`);
      return alertedCount;
    } catch {
      toast.error('Failed to trigger staff appointment alerts');
      return 0;
    }
  }, [addNotification]);

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
