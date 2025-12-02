import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth, type User } from './AuthContext';

// Mock the api service
const mockApi = {
  login: vi.fn(),
  getMe: vi.fn(),
};

vi.mock('@/services/api', () => ({
  api: mockApi,
  API_ORIGIN: 'http://localhost:5000',
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

function Probe() {
  const { user, hasPermission, canActOnHospital } = useAuth();
  const can = canActOnHospital('h1');
  const canAll = hasPermission('all:view');
  return (
    <div data-testid="probe" data-user={user ? 'yes' : 'no'} data-can={can ? 'yes' : 'no'} data-all={canAll ? 'yes' : 'no'} />
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockApi.login.mockReset();
    mockApi.getMe.mockReset();
  });

  it('canActOnHospital returns false without user', () => {
    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    const el = getByTestId('probe');
    expect(el.getAttribute('data-user')).toBe('no');
    expect(el.getAttribute('data-can')).toBe('no');
  });

  it('canActOnHospital returns true for user with hospital_id matching the argument', () => {
    const mockUser: User = {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      permissions: [],
      hospital_id: 'h1',
    };
    mockApi.getMe.mockResolvedValue({ user: mockUser });
    localStorageMock.setItem('token', 'test_token');

    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    const el = getByTestId('probe');
    expect(el.getAttribute('data-user')).toBe('yes');
    expect(el.getAttribute('data-can')).toBe('yes');
  });

  it('hasPermission returns true if user has the permission', () => {
    const mockUser: User = {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      permissions: ['patients:view', 'all:view'],
      hospital_id: 'h1',
    };
    mockApi.getMe.mockResolvedValue({ user: mockUser });
    localStorageMock.setItem('token', 'test_token');

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    const el = screen.getByTestId('probe');
    expect(el.getAttribute('data-all')).toBe('yes');
  });

  it('login sets user and token in localStorage', async () => {
    const mockUser: User = {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      permissions: [],
      hospital_id: 'h1',
    };
    mockApi.login.mockResolvedValue({ user: mockUser, token: 'test_token' });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    const auth = useAuth();

    await act(async () => {
      await auth.login('test@example.com', 'password');
    });

    expect(localStorageMock.getItem('token')).toBe('test_token');
    expect(mockApi.getMe).not.toHaveBeenCalled();
  });

  it('logout removes user and token from localStorage', () => {
    localStorageMock.setItem('token', 'test_token');
    const mockUser: User = {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      permissions: [],
      hospital_id: 'h1',
    };
    mockApi.getMe.mockResolvedValue({ user: mockUser });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    const auth = useAuth();

    act(() => {
      auth.logout();
    });

    expect(localStorageMock.getItem('token')).toBeNull();
  });

  it('loads user from token on mount', async () => {
    const mockUser: User = {
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      permissions: [],
      hospital_id: 'h1',
    };
    mockApi.getMe.mockResolvedValue({ user: mockUser });
    localStorageMock.setItem('token', 'test_token');

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(mockApi.getMe).toHaveBeenCalled();
  });
});
