/**
 * NotificationContext tests.
 *
 * The inbox used to be seeded with five fabricated records in localStorage.
 * These tests pin the behaviour that replaced it: the list comes from the
 * API, an empty API response produces an empty list, and the mutations go
 * through the API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';

const apiRequest = vi.fn();

vi.mock('@/services/shmsApiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  API_BASE_URL: '/api',
  ApiRequestError: class ApiRequestError extends Error {},
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, isAuthLoading: false, user: { id: '1', name: 'Tester' } }),
}));

vi.mock('@/services/api', () => ({
  api: {
    getAppointments: vi.fn(async () => []),
    updateAppointment: vi.fn(async () => ({})),
  },
}));

function Probe() {
  const { notifications, unreadCount, pendingCount, markAsRead, markAllAsRead, dismissNotification } =
    useNotifications();
  return (
    <div>
      <span data-testid="count">{notifications.length}</span>
      <span data-testid="unread">{unreadCount}</span>
      <span data-testid="pending">{pendingCount}</span>
      <span data-testid="first-title">{notifications[0]?.title ?? ''}</span>
      <button type="button" onClick={() => notifications[0] && markAsRead(notifications[0].id)}>
        read
      </button>
      <button type="button" onClick={markAllAsRead}>
        read all
      </button>
      <button
        type="button"
        onClick={() => notifications[0] && dismissNotification(notifications[0].id)}
      >
        dismiss
      </button>
    </div>
  );
}

const notification = {
  id: '11',
  type: 'upcoming_appointment',
  priority: 'urgent',
  title: 'Starting soon: Jane Doe',
  message: 'Jane Doe has a consultation at 15:40.',
  timestamp: '2026-10-20T15:30:00.000Z',
  createdAt: 1792600000000,
  read: false,
  patientName: 'Jane Doe',
  status: 'confirmed',
};

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the inbox from the API and renders nothing when the API is empty', async () => {
    apiRequest.mockResolvedValue({ notifications: [], total: 0 });

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    expect(screen.getByTestId('unread')).toHaveTextContent('0');
    expect(screen.getByTestId('pending')).toHaveTextContent('0');
    expect(apiRequest).toHaveBeenCalledWith('/notifications');
  });

  it('renders the notifications the API returned', async () => {
    apiRequest.mockResolvedValue({ notifications: [notification], total: 1 });

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(screen.getByTestId('unread')).toHaveTextContent('1');
    expect(screen.getByTestId('first-title')).toHaveTextContent('Starting soon: Jane Doe');
  });

  it('never seeds a fabricated notification in localStorage', async () => {
    apiRequest.mockResolvedValue({ notifications: [], total: 0 });

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));

    expect(localStorage.getItem('health_manager_notifications')).toBeNull();
    expect(localStorage.getItem('health_manager_prescriptions')).toBeNull();
    expect(localStorage.getItem('health_manager_alerted_15min_appts')).toBeNull();
  });

  it('marks one notification read through the API', async () => {
    apiRequest.mockResolvedValue({ notifications: [notification], total: 1 });

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    await act(async () => {
      screen.getByText('read').click();
    });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/notifications/11/read', { method: 'PATCH' })
    );
  });

  it('marks every notification read through the API', async () => {
    apiRequest.mockResolvedValue({ notifications: [notification], total: 1 });

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    await act(async () => {
      screen.getByText('read all').click();
    });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/notifications/read-all', { method: 'PATCH' })
    );
  });

  it('dismisses a notification through the API and drops it from the list', async () => {
    apiRequest.mockResolvedValue({ notifications: [notification], total: 1 });

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));

    await act(async () => {
      screen.getByText('dismiss').click();
    });

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'));
    expect(apiRequest).toHaveBeenCalledWith('/notifications/11', {
      method: 'PATCH',
      body: { status: 'dismissed' },
    });
  });

  it('keeps the inbox when the API fails', async () => {
    apiRequest.mockRejectedValue(new Error('network down'));

    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    );

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
