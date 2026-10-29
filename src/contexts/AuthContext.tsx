import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, API_ORIGIN } from '@/services/api';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';

export const getCookieToken = () => { for (const part of document.cookie.split(';')) { const p=part.trim(); if(!p) continue; const [k,v]=p.split('='); if(k==='token') return decodeURIComponent(v||''); } return ''; };

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  scope?: 'global' | 'hospital' | 'self';
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
  isAuthLoading: boolean;
  hasPermission: (perm: string) => boolean;
  canActOnHospital: (hospitalId?: string) => boolean;
  canActOnDepartment: (departmentId?: string) => boolean;
  mfaPending: boolean;
  mfaPendingUser: User | null;
  verifyMfaTotp: (code: string) => Promise<User | null>;
  verifyMfaRecovery: (code: string) => Promise<User | null>;
  verifyMfaPasskey: (assertion: AuthenticationResponseJSON, challengeToken: string) => Promise<User | null>;
  cancelMfa: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState<boolean>(false);
  const [mfaPendingUser, setMfaPendingUser] = useState<User | null>(null);
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);

  const hasPermission = (perm: string) => {
    if (!user) return false;
    // Global super admin: can do anything (only this role holds 'all:*')
    if (user.role === 'super_admin' || user.role === 'Super Admin') return true;
    // The plain grant the server actually issues.
    //
    // The API builds the caller's permission list from the permissions row of
    // their role as "<module>:<action>" (server/src/controllers/auth.controller.ts
    // reads can_view/can_add/can_edit/can_delete and writes them out that
    // way), and requirePermission(module, action) checks exactly that row.
    // Matching the plain form is therefore what makes the client's answer
    // agree with the server's. Without it every permission-gated control in
    // the app reads as "not allowed" for every role except the super admin,
    // because the only forms checked below are the prefixed ones this
    // deployment no longer issues.
    if (user.permissions.includes(perm)) return true;
    // Hospital-scoped admin/doctor/nurse/pharmacist: must have hospital assignment
    if (user.scope === 'hospital' || (user.hospital_id && user.permissions.some((p) => !p.startsWith('all:')))) {
      const hospPrefix = user.hospital_id || '';
      if (!hospPrefix) return false;
      // Canonical module-scoped grant: HOSP-001:patients:view
      if (user.permissions.includes(`${hospPrefix}:${perm}`)) return true;
      // Module-agnostic hospital grant (admin-style): HOSP-001:view
      const action = perm.includes(':') ? perm.slice(perm.lastIndexOf(':') + 1) : perm;
      if (user.permissions.includes(`${hospPrefix}:${action}`)) return true;
      // Legacy global action grant (all:view) — tolerated during migration
      return user.permissions.includes(`all:${action}`);
    }
    return false;
  };

  const canActOnHospital = (hospitalId?: string) => {
    if (!user) return false;
    // Super admin (global) — can access any hospital
    if (user.role === 'super_admin' || user.role === 'Super Admin') return true;
    // Hospital-scoped — must match assigned hospital
    return !!user.hospital_id && (!hospitalId || user.hospital_id === hospitalId);
  };

  const canActOnDepartment = (_departmentId?: string) => {
    if (!user) return false;
    // Only super admin can act globally; hospital-scoped must match
    if (user.role === 'super_admin' || user.role === 'Super Admin') return true;
    return !!user.hospital_id;
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
        // token stored in httpOnly server cookie
        setUser(response.user ?? null);
        if (!response.token) {
          throw new Error('Login succeeded but no session token was returned');
        }
        setMfaPending(false);
        setMfaPendingUser(null);
        setMfaPendingToken(null);
        setIsAuthLoading(false);
        return { requiresMfa: false, user: response.user ?? null };
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Login failed';
      const error = new Error(errMsg);
      (error as any).cause = e;
      throw error;
    }
  };

  const verifyMfaTotp = async (totpCode: string): Promise<User | null> => {
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
    // token stored in httpOnly server cookie
    const resolved: User = mfaResponse.user ?? mfaPendingUser;
    setUser(resolved);
    setMfaPending(false);
    setMfaPendingUser(null);
    setMfaPendingToken(null);
    setIsAuthLoading(false);
    // Returned so the caller can pick the correct landing route. Reading the
    // context value immediately after this await would return the pre-update
    // value, because setUser has not rendered yet.
    return resolved;
  };

  const verifyMfaRecovery = async (recoveryCodeInput: string): Promise<User | null> => {
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

    // token stored in httpOnly server cookie
    const resolved: User = mfaResponse.user ?? mfaPendingUser;
    setUser(resolved);
    setMfaPending(false);
    setMfaPendingUser(null);
    setMfaPendingToken(null);
    setIsAuthLoading(false);
    return resolved;
  };

  const verifyMfaPasskey = async (
    assertion: AuthenticationResponseJSON,
    challengeToken: string
  ): Promise<User | null> => {
    if (!mfaPending || !mfaPendingUser || !mfaPendingToken) {
      throw new Error('No pending MFA session found. Please log in again.');
    }

    // Passkey assertion consumes the mfa_pending temp token and issues the
    // full-scope JWT, mirroring the TOTP/recovery success path.
    const mfaResponse = await api.webauthnLoginVerify(assertion, challengeToken, mfaPendingToken) as { token?: string; user?: User };

    // token stored in httpOnly server cookie
    const resolved: User = mfaResponse.user ?? mfaPendingUser;
    setUser(resolved);
    setMfaPending(false);
    setMfaPendingUser(null);
    setMfaPendingToken(null);
    setIsAuthLoading(false);
    return resolved;
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

  const logout = async () => {
    // Tell the server first, so the token it issued is actually revoked.
    // Clearing local storage on its own left the token usable until it
    // expired, which meant a logout did not end the session.
    try {
      await api.logout();
    } catch (error) {
      // A failed revocation must not stop the user from leaving the app.
      console.warn('Failed to revoke the session on the server:', error);
    }
    // token revoked server-side (logout);
    setUser(null);
    setMfaPending(false);
    setMfaPendingUser(null);
    setMfaPendingToken(null);
  };

  useEffect(() => {
    const fetchUser = async () => {
      const token = getCookieToken();
      if (token) {
        try {
          const data: { user: User } = await api.getMe();
          setUser(data.user);
        } catch (error) {
          console.error('Failed to fetch user on mount:', error);
          // token revoked server-side (logout);
          setUser(null);
        }
      }
      setIsAuthLoading(false);
    };

    fetchUser();

    let es: EventSource | null = null;
    try {
      // Only open the role stream for a real session. Without a token the
      // server answers 401, EventSource retries on an interval, and an
      // unauthenticated visitor accumulated a stream of failed requests.
      const streamToken = getCookieToken();
      if (typeof window !== 'undefined' && 'EventSource' in window && streamToken) {
        const streamUrl = `${API_ORIGIN}/api/roles/stream?token=${encodeURIComponent(streamToken)}`;
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
        isAuthLoading,
        hasPermission,
        canActOnHospital,
        canActOnDepartment,
        mfaPending,
        mfaPendingUser,
        verifyMfaTotp,
        verifyMfaRecovery,
        verifyMfaPasskey,
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
