import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmergencyModeModule } from '@/components/emergency/EmergencyModeModule';

// `vi.mock` is hoisted above the imports, so the mock object has to be
// created with `vi.hoisted` to be available inside the factory.
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(() => 'toast-1'),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

const boardResponse = () => ({
  patients: [
    {
      id: 'P-1002',
      patientId: 2,
      admissionId: 5,
      name: 'Sarah Connor',
      age: 42,
      gender: 'female',
      triageLevel: 'RED',
      condition: 'Acute Chest Pain / Suspected STEMI',
      bed: 'ER-BAY-01',
      bedLabel: 'Bay 01 (Trauma)',
      systolicBp: 165,
      diastolicBp: 102,
      heartRate: 112,
      spo2: 93,
      admittedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    },
    {
      id: 'P-1005',
      patientId: 3,
      admissionId: 6,
      name: 'Ama Boateng',
      age: 31,
      gender: 'female',
      triageLevel: 'AMBER',
      condition: 'Anaphylactic Reaction',
      bed: null,
      bedLabel: null,
      systolicBp: null,
      diastolicBp: null,
      heartRate: null,
      spo2: null,
      admittedAt: new Date(Date.now() - 22 * 60_000).toISOString(),
    },
  ],
  beds: [
    {
      id: 'ER-BAY-01',
      label: 'Bay 01 (Trauma)',
      status: 'occupied',
      patient: 'P-1002',
      patientName: 'Sarah Connor',
      triage: 'RED',
    },
    {
      id: 'ER-BAY-02',
      label: 'Bay 02 (Resus)',
      status: 'available',
      patient: null,
      patientName: null,
      triage: null,
    },
  ],
  hotline: 'Ext. 911 / 4402',
});

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const originalFetch = globalThis.fetch;

let fetchMock: ReturnType<typeof vi.fn>;

const findCall = (method: string, fragment: string) =>
  fetchMock.mock.calls.find(
    (call: any[]) => call[0].includes(fragment) && String(call[1]?.method || 'GET') === method
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/emergency/triage-board')) {
      return jsonResponse(200, boardResponse());
    }
    return jsonResponse(200, {});
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const renderModule = () =>
  render(<EmergencyModeModule onOpenLogVitals={() => {}} onOpenHandover={() => {}} />);

describe('EmergencyModeModule', () => {
  it('renders the board from the API instead of the hardcoded arrays', async () => {
    renderModule();

    expect(await screen.findByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('Bay 01 (Trauma)')).toBeInTheDocument();
    expect(screen.getByText('Bay 02 (Resus)')).toBeInTheDocument();

    // The invented patients of the old hardcoded board are gone.
    expect(screen.queryByText('Kwame Mensah')).not.toBeInTheDocument();
    expect(screen.queryByText('Amina Yeboah')).not.toBeInTheDocument();

    // Raw values are formatted for display.
    expect(screen.getByText('165/102 mmHg')).toBeInTheDocument();
    expect(screen.getByText('112 bpm')).toBeInTheDocument();
    expect(screen.getByText('93%')).toBeInTheDocument();
    expect(screen.getAllByText(/\d+ mins? ago/).length).toBeGreaterThan(0);
    expect(screen.getByText('(42y, Female)')).toBeInTheDocument();

    // The hotline comes from the API.
    expect(screen.getByText('Ext. 911 / 4402')).toBeInTheDocument();
  });

  it('allocates a bed through the API and refreshes the board', async () => {
    renderModule();
    await screen.findByText('Bay 02 (Resus)');

    const allocateButton = screen.getByRole('button', { name: 'AVAILABLE' });
    fireEvent.click(allocateButton);

    await waitFor(() => {
      const call = findCall('PATCH', '/emergency/beds/ER-BAY-02');
      expect(call).toBeDefined();
      // The bay goes to the patient that is still waiting for one.
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        status: 'occupied',
        patientId: 'P-1005',
        triage: 'AMBER',
      });
    });

    // The board is reloaded after the allocation.
    await waitFor(() => {
      const boardCalls = fetchMock.mock.calls.filter((call: any[]) =>
        String(call[0]).includes('/emergency/triage-board')
      );
      expect(boardCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows the server error and keeps the bed state when an allocation fails', async () => {
    fetchMock = vi.fn(async (url: string, options: any) => {
      if (String(url).includes('/emergency/triage-board')) {
        return jsonResponse(200, boardResponse());
      }
      if (String(url).includes('/emergency/beds/ER-BAY-02') && options?.method === 'PATCH') {
        return jsonResponse(409, { error: 'Bed is already occupied by another patient' });
      }
      return jsonResponse(200, {});
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderModule();
    await screen.findByText('Bay 02 (Resus)');

    fireEvent.click(screen.getByRole('button', { name: 'AVAILABLE' }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('Bed is already occupied by another patient');
    });

    // The local state was not changed behind the API's back.
    expect(screen.getByRole('button', { name: 'AVAILABLE' })).toBeInTheDocument();
  });

  it('records a code blue through the API and reports that nothing was dispatched', async () => {
    fetchMock = vi.fn(async (url: string, options: any) => {
      if (String(url).includes('/emergency/triage-board')) {
        return jsonResponse(200, boardResponse());
      }
      if (String(url).includes('/emergency/code-blue') && options?.method === 'POST') {
        return jsonResponse(201, {
          codeBlue: {
            auditId: 12,
            dispatched: false,
            message:
              'Code blue recorded in the audit trail. No external emergency-service dispatch is configured on this deployment.',
            hotline: 'Ext. 911 / 4402',
            patientId: null,
          },
        });
      }
      return jsonResponse(200, {});
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderModule();
    await screen.findByText('Sarah Connor');

    fireEvent.click(screen.getByRole('button', { name: /Broadcast CODE BLUE/i }));

    await waitFor(() => {
      const call = findCall('POST', '/emergency/code-blue');
      expect(call).toBeDefined();
    });

    // The toast repeats what the API actually did: no dispatch happened.
    await waitFor(() => {
      expect(toastMock.warning).toHaveBeenCalledWith(
        'Code blue recorded in the audit trail. No external emergency-service dispatch is configured on this deployment.',
        expect.anything()
      );
    });
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('puts a bed that is being cleaned back into circulation', async () => {
    const board = boardResponse();
    board.beds = [
      {
        id: 'ER-BAY-03',
        label: 'Bay 03 (Trauma)',
        status: 'cleaning',
        patient: null,
        patientName: null,
        triage: null,
      },
    ];
    fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/emergency/triage-board')) {
        return jsonResponse(200, board);
      }
      return jsonResponse(200, {});
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderModule();
    await screen.findByText('Bay 03 (Trauma)');

    fireEvent.click(screen.getByRole('button', { name: 'CLEANING' }));

    await waitFor(() => {
      const call = findCall('PATCH', '/emergency/beds/ER-BAY-03');
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: 'available' });
    });
  });

  it('renders an empty board without crashing', async () => {
    fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/emergency/triage-board')) {
        return jsonResponse(200, { patients: [], beds: [], hotline: 'Ext. 911 / 4402' });
      }
      return jsonResponse(200, {});
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderModule();

    await waitFor(() => {
      expect(screen.getByText('0 STAT')).toBeInTheDocument();
    });
    expect(screen.getByText('0 Urgent')).toBeInTheDocument();
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
  });

  it('survives a failed board request', async () => {
    fetchMock = vi.fn(async () => jsonResponse(500, { error: 'Emergency request failed' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderModule();

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('Emergency request failed');
    });
    expect(screen.getByText('0 STAT')).toBeInTheDocument();
  });
});
