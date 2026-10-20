/**
 * AuditContext tests.
 *
 * The audit trail used to be a localStorage array that a user could erase
 * with one DevTools call. These tests pin the behaviour that replaced it:
 * the entry is written through the API, the write is fire and forget, and a
 * failed write never breaks the action it is logging.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuditProvider, useAudit } from '@/contexts/AuditContext';

const apiRequest = vi.fn();

vi.mock('@/services/shmsApiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  API_BASE_URL: '/api',
  ApiRequestError: class ApiRequestError extends Error {},
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    user: { id: '7', name: 'Auditor', email: 'auditor@example.org' },
  }),
}));

function Probe() {
  const { logAction, logs } = useAudit();
  return (
    <div>
      <span data-testid="log-count">{logs.length}</span>
      <span data-testid="log-action">{logs[0]?.action ?? ''}</span>
      <button type="button" onClick={() => logAction('create', 'patient', { recordId: 'PAT-1' })}>
        log
      </button>
    </div>
  );
}

describe('AuditContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('writes the entry through the API instead of localStorage', async () => {
    apiRequest.mockImplementation(async (_path: string, options: { method?: string }) => {
      if (options?.method === 'POST') {
        return {
          id: '99',
          userId: '7',
          userName: 'Auditor',
          action: 'create',
          module: 'patient',
          recordId: 'PAT-1',
          timestamp: '2026-10-20T15:30:00.000Z',
        };
      }
      return { logs: [] };
    });

    render(
      <AuditProvider>
        <Probe />
      </AuditProvider>
    );

    await act(async () => {
      screen.getByText('log').click();
    });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        '/audit-logs',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ action: 'create', module: 'patient', recordId: 'PAT-1' }),
        })
      )
    );

    expect(localStorage.getItem('auditLogs')).toBeNull();
  });

  it('does not break the caller when the audit write fails', async () => {
    apiRequest.mockRejectedValue(new Error('network down'));

    render(
      <AuditProvider>
        <Probe />
      </AuditProvider>
    );

    await act(async () => {
      screen.getByText('log').click();
    });

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    // The optimistic entry is dropped again once the write failed.
    await waitFor(() => expect(screen.getByTestId('log-count')).toHaveTextContent('0'));
  });

  it('exposes the server trail', async () => {
    apiRequest.mockResolvedValue({
      logs: [
        {
          id: '5',
          userId: '7',
          userName: 'Auditor',
          action: 'update',
          module: 'patient',
          recordId: 'PAT-9',
          timestamp: '2026-10-20T15:00:00.000Z',
        },
      ],
      total: 1,
      scope: 'self',
    });

    render(
      <AuditProvider>
        <Probe />
      </AuditProvider>
    );

    await waitFor(() => expect(screen.getByTestId('log-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('log-action')).toHaveTextContent('update');
  });
});
