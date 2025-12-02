import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface AuditLog {
  action: string;
  module: string;
  recordId?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: Date;
}

interface AuditContextType {
  logAction: (action: string, module: string, details?: Partial<AuditLog>) => void;
}

export const AuditContext = createContext<AuditContextType | undefined>(undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const logAction = (action: string, module: string, details?: Partial<AuditLog>) => {
    if (!user) return;

    const log: AuditLog = {
      action,
      module,
      timestamp: new Date(),
      ...details,
    };

    // In production, send to backend API
    console.log('Audit Log:', {
      userId: user.id,
      userName: user.name,
      ...log,
    });

    // Store in localStorage for demo (in production, send to backend)
    const logs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
    logs.push({
      userId: user.id,
      userName: user.name,
      ...log,
    });
    
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.shift();
    }
    
    localStorage.setItem('auditLogs', JSON.stringify(logs));
  };

  return (
    <AuditContext.Provider value={{ logAction }}>
      {children}
    </AuditContext.Provider>
  );
}

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
};
