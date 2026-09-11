import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, API_ORIGIN } from '@/services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  hospital_id?: string;
  totp_enabled?: boolean;
  recovery_codes_count?: number;
  password_must_change?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ requiresMfa: boolean; user: User | null }>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (perm: string) => boolean;
  canActOnHospital: (hospitalId?: string) => boolean;
  canActOnDepartment: (departmentId?: string) => boolean;
  mfaPending: boolean;
  mfaPendingUser: User | null;
  verifyMfaTotp: (code: string) => Promise<boolean>;
  verifyMfaRecovery: (code: string) => Promise<boolean>;
  cancelMfa: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mfaPending, setMfaPending] = useState<boolean>(false);
  const [mfaPendingUser, setMfaPendingUser] = useState<User | null>(null);
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);

  const hasPermission = (perm: string) => {
    if (!user) return false;
    if (user.permissions.includes('all:all') || user.permissions.includes(perm)) return true;
    if (!perm.includes(':')) return user.permissions.includes(perm);
    const [module, action] = perm.split(':');
    return user.permissions.includes(`all:${action}`) || user.permissions.includes(`${module}:${action}`);
  };

  const canActOnHospital = (hospitalId?: string) => {
    if (!user) return false;
    if (!hospitalId) return !!user.hospital_id;
    return user.permissions.includes('all:view') || user.hospital_id === hospitalId;
  };

  const canActOnDepartment = (_departmentId?: string) => {
    if (!user) return false;
    return user.permissions.includes('all:view');
  };

  const login = async (email: string, password: string): Promise<{ requiresMfa: boolean; user: User | null }> => {
    try {
      const response = await api.login(email, password) as { requiresMfa?: boolean; tempToken?: string; token?: string; user?: User };

      // The backend is the source of truth for MFA — a user with a stored TOTP
      // secret never receives a full JWT from /auth/login, only a short-lived
      // temp token that gates the verify-2fa endpoint.
      if (response.requiresMfa && response.tempToken) {
        setMfaPending(true);
        setMfaPendingUser(response.user ?? null);
        setMfaPendingToken(response.tempToken);
        return { requiresMfa: true, user: response.user ?? null };
      } else {
        localStorage.setItem('token', response.token ?? '');
        setUser(response.user ?? null);
        if (!response.token) {
          throw new Error('Login succeeded but no session token was returned');
        }
        setMfaPending(false);
        setMfaPendingUser(null);
        setMfaPendingToken(null);
        return { requiresMfa: false, user: response.user ?? null };
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Login failed';
      const error = new Error(errMsg);
      (error as any).cause = e;
      throw error;
    }
  };

  const verifyMfaTotp = async (totpCode: string): Promise<boolean> => {
    if (!mfaPending || !mfaPendingUser || !mfaPendingToken) {
      throw new Error('No pending MFA session found. Please log in again.');
    }

    const cleanCode = totpCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      throw new Error('Invalid TOTP authenticator code. Code must be 6 numeric digits.');
    }

    // Call API 2FA verify endpoint with the temp token; verification issues a
    // fresh full JWT. Any failure propagates to the caller.
    const mfaResponse = await api.verifyTwoFactor(cleanCode, mfaPendingToken) as { token?: string; user?: User };

    // Complete authentication with the verified full-token response
    localStorage.setItem('token', mfaResponse.token ?? '');
    setUser(mfaResponse.user ?? mfaPendingUser);
    setMfaPending(false);
    setMfaPendingUser(null);
    setMfaPendingToken(null);
    return true;
  };

  const verifyMfaRecovery = async (recoveryCodeInput: string): Promise<boolean> => {
    if (!mfaPending || !mfaPendingUser || !mfaPendingToken) {
      throw new Error('No pending MFA session found. Please log in again.');
    }

    const cleanCode = recoveryCodeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(cleanCode)) {
      throw new Error('Invalid recovery code. Use the XXXXX-XXXXX format from your setup screen.');
    }

    // Call the recovery-code endpoint with the temp token; a match issues a
    // fresh full JWT and burns the code (single-use).
    const mfaResponse = await api.verifyRecovery(cleanCode, mfaPendingToken) as { token?: string; user?: User };

    localStorage.setItem('token', mfaResponse.token ?? '');
    setUser(mfaResponse.user ?? mfaPendingUser);
    setMfaPending(false);
    setMfaPendingUser(null);
    setMfaPendingToken(null);
    return true;
  };

  const cancelMfa = () => {
    setMfaPending(false);
    setMfaPendingUser(null);
    setMfaPendingToken(null);
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const data: { user: User } = await api.getMe();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setMfaPending(false);
    setMfaPendingUser(null);
    setMfaPendingToken(null);
  };

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const data: { user: User } = await api.getMe();
          setUser(data.user);
        } catch (error) {
          console.error('Failed to fetch user on mount:', error);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
    };

    fetchUser();

    let es: EventSource | null = null;
    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        const token = localStorage.getItem('token');
        const streamUrl = `${API_ORIGIN}/api/roles/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
        es = new EventSource(streamUrl);
        es.onmessage = async (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (['permission_updated', 'role_updated', 'role_deleted', 'role_created'].includes(msg?.type)) {
              await fetchUser(); // Re-fetch user data on permission/role updates
            }
          } catch {
            // Heartbeats or unparsed messages are safely ignored
          }
        };
        es.onerror = () => {
          // SSE will automatically attempt reconnect according to browser specs.
          // Cleanly close if readyState is closed.
          if (es && es.readyState === EventSource.CLOSED) {
            es.close();
          }
        };
      }
    } catch {
      // Gracefully ignore if EventSource cannot be instantiated in current environment
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        hasPermission,
        canActOnHospital,
        canActOnDepartment,
        mfaPending,
        mfaPendingUser,
        verifyMfaTotp,
        verifyMfaRecovery,
        cancelMfa,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
