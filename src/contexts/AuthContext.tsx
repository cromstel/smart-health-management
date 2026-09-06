import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, API_ORIGIN } from '@/services/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  hospital_id?: string;
  password_must_change?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (perm: string) => boolean;
  canActOnHospital: (hospitalId?: string) => boolean;
  canActOnDepartment: (departmentId?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const hasPermission = (perm: string) => {
    if (!user) return false;
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

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password) as any;
      console.log('API Login Response:', response);
      
      // Store token
      localStorage.setItem('token', response.token);
      setUser(response.user);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Login failed';
      throw new Error(errMsg);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
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
    if (typeof window !== 'undefined' && 'EventSource' in window) {
      es = new EventSource(`${API_ORIGIN}/api/roles/stream`);
      es.onmessage = async (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (['permission_updated', 'role_updated', 'role_deleted', 'role_created'].includes(msg?.type)) {
            await fetchUser(); // Re-fetch user data on permission/role updates
          }
        } catch (error) {
          console.error('EventSource message error:', error);
          // silently ignore
        }
      };
      es.onerror = (error) => {
        console.error('EventSource error:', error);
        es?.close();
      };
    }

    return () => {
      es?.close();
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
