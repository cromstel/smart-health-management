import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '@/services/shmsApiClient';

/**
 * One entry of the audit trail.
 *
 * The field names match what the audit pages read: `userId`, `userName`,
 * `action`, `module`, `recordId`, `oldValue`, `newValue` and `timestamp`.
 */
export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

/**
 * The report schedule configuration, stored server-side in the settings
 * table under `audit_report_schedule`.
 */
export interface AuditReportSchedule {
  enabled: boolean;
  emails: string;
  frequency: string;
  format: string;
  modules: string[];
  lastUpdated: string;
}

interface AuditContextType {
  logAction: (action: string, module: string, details?: Partial<AuditLog>) => void;
  /** The server trail, newest first. */
  logs: AuditLog[];
  isLoading: boolean;
  /**
   * Re-reads the trail from the server. Resolves with the entries it read
   * (an empty list when the request failed) so a page that keeps its own
   * list can use the result directly.
   */
  refreshLogs: () => Promise<AuditLog[]>;
  reportSchedule: AuditReportSchedule | null;
  saveReportSchedule: (schedule: AuditReportSchedule) => Promise<void>;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

const DEFAULT_SCHEDULE: AuditReportSchedule = {
  enabled: true,
  emails: 'admin-records@smarthospital.org',
  frequency: 'monthly',
  format: 'csv',
  modules: ['patients', 'vitals'],
  lastUpdated: '',
};

interface AuditLogsResponse {
  logs?: AuditLog[];
  total?: number;
  limit?: number;
  offset?: number;
  scope?: 'all' | 'self';
}

const toAuditLog = (raw: any): AuditLog => ({
  id: String(raw.id),
  userId: raw.userId ?? undefined,
  userName: raw.userName ?? undefined,
  action: raw.action ?? '',
  module: raw.module ?? '',
  recordId: raw.recordId ?? undefined,
  oldValue: raw.oldValue ?? undefined,
  newValue: raw.newValue ?? undefined,
  timestamp: raw.timestamp ?? new Date().toISOString(),
});

export function AuditProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportSchedule, setReportSchedule] = useState<AuditReportSchedule | null>(null);

  const refreshLogs = useCallback(async (): Promise<AuditLog[]> => {
    setIsLoading(true);
    try {
      const response = await apiRequest<AuditLogsResponse>('/audit-logs', {
        query: { limit: 100 },
      });
      const list = Array.isArray(response?.logs) ? response.logs : [];
      const entries = list.map(toAuditLog);
      setLogs(entries);
      return entries;
    } catch (error) {
      console.warn('Failed to load the audit trail:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Records an action in the audit trail.
   *
   * The write is fire and forget: the 30-odd call sites must not wait for a
   * network round trip, and a failed audit write must never break the user
   * action it is logging. The entry is added to the local trail optimistically
   * and replaced with the server's copy once it has been stored.
   */
  const logAction = useCallback(
    (action: string, module: string, details?: Partial<AuditLog>) => {
      // Nothing to audit without a session: the server derives the actor
      // from the token, so an anonymous write could only ever be rejected.
      if (!user || !isAuthenticated) return;

      const optimisticId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: AuditLog = {
        id: optimisticId,
        userId: user.id,
        userName: user.name,
        action,
        module,
        recordId: details?.recordId,
        oldValue: details?.oldValue,
        newValue: details?.newValue,
        timestamp: new Date().toISOString(),
      };

      setLogs((prev) => [optimistic, ...prev]);

      void (async () => {
        try {
          const created = await apiRequest<AuditLog>('/audit-logs', {
            method: 'POST',
            body: {
              action,
              module,
              recordId: details?.recordId,
              oldValue: details?.oldValue,
              newValue: details?.newValue,
              details: details ? { ...details } : undefined,
            },
          });

          const stored = toAuditLog(created);
          setLogs((prev) => prev.map((entry) => (entry.id === optimisticId ? stored : entry)));
        } catch (error) {
          console.warn('Failed to write the audit entry:', error);
          // The optimistic entry is dropped rather than left in the list as a
          // record that was never stored.
          setLogs((prev) => prev.filter((entry) => entry.id !== optimisticId));
        }
      })();
    },
    [user, isAuthenticated]
  );

  const saveReportSchedule = useCallback(async (schedule: AuditReportSchedule) => {
    const saved = await apiRequest<AuditReportSchedule>('/audit-logs/report-schedule', {
      method: 'PUT',
      body: schedule,
    });
    setReportSchedule(saved);
  }, []);

  // The trail is only read for a signed-in session.
  useEffect(() => {
    if (!isAuthenticated) return;

    void refreshLogs();
    void (async () => {
      try {
        const schedule = await apiRequest<AuditReportSchedule>('/audit-logs/report-schedule');
        setReportSchedule(schedule);
      } catch (error) {
        console.warn('Failed to load the audit report schedule:', error);
        setReportSchedule({ ...DEFAULT_SCHEDULE });
      }
    })();
  }, [isAuthenticated, refreshLogs]);

  return (
    <AuditContext.Provider
      value={{
        logAction,
        logs,
        isLoading,
        refreshLogs,
        reportSchedule,
        saveReportSchedule,
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
}
