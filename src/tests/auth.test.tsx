import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { MemoryRouter, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';

vi.mock('@/services/api', async (importOriginal) => {
  const actualApi = await importOriginal() as typeof import('@/services/api');
  return {
    ...actualApi,
    api: {
      ...actualApi.api,
      login: vi.fn(),
      getMe: vi.fn(),
    },
  };
});

import { api } from '@/services/api';

const mockApi = vi.mocked(api, true);

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

const TestApp = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/dashboard' && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={
        isAuthenticated ? (
          <div data-testid="dashboard-page">
            Dashboard
            <button onClick={logout}>Logout</button>
          </div>
        ) : (
          <div>Not Authenticated</div>
        )
      } />
      <Route path="/" element={<div data-testid="home-page">Home</div>} />
    </Routes>
  );
};

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockApi.login.mockClear();
    mockApi.getMe.mockClear();
  });

  it('should successfully log in and redirect to dashboard', async () => {
    mockApi.login.mockResolvedValue({ user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', permissions: [], hospital_id: 'h1' }, token: 'test_token' });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <TestApp />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: 'Sign In' });

    await act(async () => {
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password');
      await userEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(localStorageMock.getItem('token')).toBe('test_token');
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('should fail to log in with invalid credentials', async () => {
    mockApi.login.mockRejectedValue(new Error('Invalid credentials'));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <TestApp />
        </AuthProvider>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const loginButton = screen.getByRole('button', { name: 'Sign In' });

    await act(async () => {
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'wrongpassword');
      await userEvent.click(loginButton);
    });

    await waitFor(() => {
      expect(localStorageMock.getItem('token')).toBeNull();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    });
  });

  it.skip('should log out and redirect to login page', async () => {
    mockApi.login.mockResolvedValue({ user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', permissions: [], hospital_id: 'h1' }, token: 'test_token' });
    mockApi.getMe.mockResolvedValue({ user: { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'admin', permissions: [], hospital_id: 'h1' } });

    localStorageMock.setItem('token', 'test_token');

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(mockApi.getMe).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole('button', { name: 'Logout' });

    await act(async () => {
      await userEvent.click(logoutButton);
    });

    await waitFor(() => {
      expect(localStorageMock.getItem('token')).toBeNull();
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
  });
});
