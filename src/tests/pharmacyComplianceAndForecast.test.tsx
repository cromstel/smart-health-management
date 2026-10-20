import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The pharmacy compliance tracker and the inventory forecast both read their
 * data from the API now. These tests drive the components through a stubbed
 * `fetch` and assert on the requests they make and the data they render.
 */

const { toastMock, apiMock } = vi.hoisted(() => {
  const toastMock = {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
  };
  const apiMock = { createPurchaseOrder: vi.fn() };
  return { toastMock, apiMock };
});

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), toastMock),
}));

vi.mock('@/services/api', () => ({
  api: apiMock,
}));

vi.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: vi.fn() }),
}));

vi.mock('@/contexts/AuditContext', () => ({
  useAudit: () => ({ logAction: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    canActOnHospital: () => true,
    user: { hospital_id: '1' },
  }),
}));

import { MedicationComplianceTracker } from '@/components/pharmacy/MedicationComplianceTracker';
import { InventoryForecastingModule } from '@/components/pharmacy/InventoryForecastingModule';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

const jsonResponse = (body: unknown, ok = true) =>
  ({
    ok,
    json: async () => body,
  }) as unknown as Response;

const MEDICINES = [
  {
    id: 'MED-1',
    name: 'Paracetamol 500mg',
    category: 'Analgesics',
    stock: 40,
    minStock: 10,
    price: 1.25,
    expiryDate: '2027-01-01',
    supplier: 'Ghana Pharma Corp',
    status: 'In Stock' as const,
  },
];

const ADMINISTRATION = {
  id: 7,
  patientId: 1,
  patientCode: 'PAT-001',
  patientName: 'John Doe',
  medicineId: 'MED-1',
  medicineName: 'Paracetamol 500mg',
  dosage: '2 Tablets',
  scheduledTime: '2026-10-20 08:00:00',
  status: 'pending' as const,
  assignedStaff: 'Ada Lovelace',
  criticalNotes: 'With breakfast',
  administeredAt: null,
};

const FORECAST_ITEM = {
  id: 'MED-1',
  name: 'Paracetamol 500mg',
  category: 'Analgesics',
  currentStock: 40,
  minStock: 10,
  dailyBurnRate: 5,
  daysOfSupply: 8,
  predictedDepletionDate: '2026-10-28 (In 8 Days)',
  riskLevel: 'HEALTHY' as const,
  suggestedReorderQty: 110,
  unitPrice: 1.25,
  supplier: 'Ghana Pharma Corp',
  supplierId: 7,
  historicalTrend: [{ day: 'Today', usage: 5, projectedStock: 40 }],
  dataStatus: 'ok' as const,
};

let calls: FetchCall[] = [];

const installFetch = (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  calls = [];
  global.fetch = vi.fn(async (input: any, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('token', 'test-token');
});

describe('MedicationComplianceTracker', () => {
  it('renders the administrations returned by the API', async () => {
    installFetch((url) => {
      if (url.includes('/medication-administrations/options')) {
        return jsonResponse({
          patients: [{ patientId: 1, patientCode: 'PAT-001', patientName: 'John Doe' }],
          staff: [{ staffId: 3, staffName: 'Ada Lovelace', role: 'Nurse' }],
        });
      }
      if (url.includes('/medication-administrations')) return jsonResponse([ADMINISTRATION]);
      if (url.includes('/pharmacy/medicines')) return jsonResponse(MEDICINES);
      return jsonResponse([]);
    });

    render(
      <MedicationComplianceTracker medicines={MEDICINES} onDeductStock={vi.fn()} />
    );

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument();
    // The API answers with the lower case status; the table shows Title Case.
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('shows an empty state instead of crashing when there is nothing scheduled', async () => {
    installFetch((url) => {
      if (url.includes('/medication-administrations/options')) return jsonResponse({ patients: [], staff: [] });
      if (url.includes('/medication-administrations')) return jsonResponse([]);
      return jsonResponse([]);
    });

    render(
      <MedicationComplianceTracker medicines={MEDICINES} onDeductStock={vi.fn()} />
    );

    expect(
      await screen.findByText('No medication administrations have been scheduled yet.')
    ).toBeInTheDocument();
  });

  it('reports a failed load without crashing', async () => {
    installFetch((url) => {
      if (url.includes('/medication-administrations')) {
        return jsonResponse({ error: 'Insufficient permissions' }, false);
      }
      return jsonResponse([]);
    });

    render(
      <MedicationComplianceTracker medicines={MEDICINES} onDeductStock={vi.fn()} />
    );

    expect(await screen.findByText('Insufficient permissions')).toBeInTheDocument();
    expect(toastMock.error).toHaveBeenCalled();
  });

  it('signs a dose off through the API and mirrors the stock the server moved', async () => {
    const deductStock = vi.fn();
    installFetch((url, init) => {
      if (url.includes('/sign-off')) {
        return jsonResponse({ ...ADMINISTRATION, status: 'administered', administeredAt: '2026-10-20 08:05:00', quantity: 2, stockAfter: 38 });
      }
      if (url.includes('/medication-administrations/options')) {
        return jsonResponse({ patients: [], staff: [] });
      }
      if (url.includes('/medication-administrations')) return jsonResponse([ADMINISTRATION]);
      if (url.includes('/pharmacy/medicines')) return jsonResponse(MEDICINES);
      void init;
      return jsonResponse([]);
    });

    render(<MedicationComplianceTracker medicines={MEDICINES} onDeductStock={deductStock} />);

    const signOff = await screen.findByRole('button', { name: 'Sign-off' });
    fireEvent.click(signOff);

    await waitFor(() => {
      const call = calls.find((c) => c.url.includes('/sign-off'));
      expect(call).toBeDefined();
      expect(call?.init?.method).toBe('PATCH');
    });

    await waitFor(() => {
      expect(deductStock).toHaveBeenCalledWith('MED-1', 2);
    });
  });
});

describe('InventoryForecastingModule', () => {
  it('renders the forecast computed by the server', async () => {
    installFetch((url) => {
      if (url.includes('/pharmacy/forecast')) {
        return jsonResponse({
          items: [FORECAST_ITEM],
          meta: { surgeMultiplier: 1.2, lookbackDays: 30, targetCoverDays: 30 },
        });
      }
      return jsonResponse([]);
    });

    render(<InventoryForecastingModule />);

    expect((await screen.findAllByText('Paracetamol 500mg')).length).toBeGreaterThan(0);
    expect(screen.getByText('8 Days')).toBeInTheDocument();
    expect(screen.getByText('+110 units')).toBeInTheDocument();
  });

  it('sends the surge multiplier to the server instead of recomputing in the browser', async () => {
    installFetch((url) => {
      if (url.includes('/pharmacy/forecast')) {
        return jsonResponse({ items: [FORECAST_ITEM], meta: {} });
      }
      return jsonResponse([]);
    });

    render(<InventoryForecastingModule />);

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('surgeMultiplier=1.2'))).toBe(true);
    });

    const slider = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '1.6' } });

    await waitFor(
      () => {
        expect(calls.some((c) => c.url.includes('surgeMultiplier=1.6'))).toBe(true);
      },
      { timeout: 4000 }
    );
  });

  it('creates the purchase order against the real supplier id', async () => {
    apiMock.createPurchaseOrder.mockResolvedValue({ id: 1, order_id: 'PO-1' });
    installFetch((url) => {
      if (url.includes('/pharmacy/forecast')) {
        return jsonResponse({ items: [FORECAST_ITEM], meta: {} });
      }
      return jsonResponse([]);
    });

    render(<InventoryForecastingModule />);

    // Wait for the forecast to arrive: the action button stays disabled
    // until there is something to reorder.
    await screen.findByText('+110 units');

    const button = screen.getByRole('button', { name: /Auto-Generate Restock Orders/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(apiMock.createPurchaseOrder).toHaveBeenCalled();
    });

    const payload = apiMock.createPurchaseOrder.mock.calls[0][0];
    expect(payload.supplier_id).toBe(7);
    expect(payload.items).toEqual([
      { medicine_id: 'MED-1', quantity: 110, unit_price: 1.25 },
    ]);
  });

  it('surfaces the failure instead of reporting a false success', async () => {
    apiMock.createPurchaseOrder.mockRejectedValue(new Error('Supplier is not active'));
    installFetch((url) => {
      if (url.includes('/pharmacy/forecast')) {
        return jsonResponse({ items: [FORECAST_ITEM], meta: {} });
      }
      return jsonResponse([]);
    });

    render(<InventoryForecastingModule />);

    await screen.findByText('+110 units');

    const button = screen.getByRole('button', { name: /Auto-Generate Restock Orders/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
