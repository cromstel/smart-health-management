import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import PurchaseOrdersPage from './PurchaseOrdersPage';
import { vi } from 'vitest';

// Mock the API
vi.mock('@/services/api', () => {
  const mockApi = {
    getPurchaseOrders: vi.fn(),
    getSuppliers: vi.fn(),
    getMedicines: vi.fn(),
    getAccounts: vi.fn(),
    createPurchaseOrder: vi.fn(),
    updatePurchaseOrder: vi.fn(),
    createTransaction: vi.fn(),
  };
  return { api: mockApi };
});

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => {
  const mockUseAuth = vi.fn(() => ({
    user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin', permissions: ['all:*'] },
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true,
    isAuthLoading: false,
    hasPermission: vi.fn(() => true),
    canActOnHospital: vi.fn(() => true),
    canActOnDepartment: vi.fn(() => true),
    mfaPending: false,
    mfaPendingUser: null,
    verifyMfaTotp: vi.fn(),
    verifyMfaRecovery: vi.fn(),
    verifyMfaPasskey: vi.fn(),
    cancelMfa: vi.fn(),
    refreshUser: vi.fn(),
  }));
  return { useAuth: mockUseAuth };
});

// Mock AuditContext
vi.mock('@/contexts/AuditContext', () => {
  const mockUseAudit = vi.fn(() => ({ logAction: vi.fn() }));
  return { useAudit: mockUseAudit };
});

import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';

// Get the mocked functions for test manipulation
const mockApi = vi.mocked(api);
const mockUseAuth = vi.mocked(useAuth);
const mockUseAudit = vi.mocked(useAudit);

const mockOrders = [
  { id: 1, order_id: 'PO123', supplier_id: 1, order_date: '2025-01-01', expected_delivery_date: '2025-01-10', status: 'Pending', total_amount: 100 },
];
const mockSuppliers = [{ id: 1, name: 'Supplier A' }];
const mockMedicines = [{ id: 1, name: 'Medicine A' }];
const mockAccounts = [{ id: 1, name: 'Inventory' }];

describe('PurchaseOrdersPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin', permissions: ['all:*'] },
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isAuthLoading: false,
      hasPermission: vi.fn(() => true),
      canActOnHospital: vi.fn(() => true),
      canActOnDepartment: vi.fn(() => true),
      mfaPending: false,
      mfaPendingUser: null,
      verifyMfaTotp: vi.fn(),
      verifyMfaRecovery: vi.fn(),
      verifyMfaPasskey: vi.fn(),
      cancelMfa: vi.fn(),
      refreshUser: vi.fn(),
    });
    // The audit context exposes the server trail as well as the write helper,
    // so the mock has to provide the full shape.
    mockUseAudit.mockReturnValue({
      logAction: vi.fn(),
      logs: [],
      isLoading: false,
      refreshLogs: vi.fn().mockResolvedValue(undefined),
      reportSchedule: null,
      saveReportSchedule: vi.fn().mockResolvedValue(undefined),
    });

    mockApi.getPurchaseOrders.mockResolvedValue(mockOrders);
    mockApi.getSuppliers.mockResolvedValue(mockSuppliers);
    mockApi.getMedicines.mockResolvedValue(mockMedicines);
    mockApi.getAccounts.mockResolvedValue(mockAccounts);
    mockApi.createPurchaseOrder.mockResolvedValue({});
    mockApi.updatePurchaseOrder.mockResolvedValue({});
    mockApi.createTransaction.mockResolvedValue({});
  });

  it('renders loading state and then the orders table', async () => {
    render(<PurchaseOrdersPage />);
    expect(screen.getByText('Loading orders...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('PO123')).toBeInTheDocument();
      expect(screen.getByText('Supplier A')).toBeInTheDocument();
    });
  });

  it('opens the create order dialog and creates an order', async () => {
    render(<PurchaseOrdersPage />);
    fireEvent.click(screen.getByText('New Order'));

    await waitFor(() => {
      expect(screen.getByText('Create Purchase Order')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');

    // Select Supplier (first combobox) - native select uses fireEvent.change
    const supplierSelect = within(dialog).getAllByRole('combobox')[0];
    fireEvent.change(supplierSelect, { target: { value: '1' } });

    // Order Date input
    const dateInputs = dialog.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2025-01-05' } });

    fireEvent.click(screen.getByText('Add Item'));

    await waitFor(() => {
      // Select Medicine (second combobox after Add Item)
      const medicineSelect = within(dialog).getAllByRole('combobox')[1];
      fireEvent.change(medicineSelect, { target: { value: '1' } });
    });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockApi.createPurchaseOrder).toHaveBeenCalledWith(expect.objectContaining({
        supplier_id: '1',
        items: expect.arrayContaining([
          expect.objectContaining({ medicine_id: '1' })
        ]),
      }));
    });
  });

  it('updates order status', async () => {
    render(<PurchaseOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('PO123')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Approve')[0]);

    await waitFor(() => {
      // The status is sent as the canonical lowercase value the database
      // stores. 'Completed' was never a value the column accepts, so the
      // previous "Complete" action was rejected by the server.
      expect(mockApi.updatePurchaseOrder).toHaveBeenCalledWith(1, { status: 'ordered' });
    });
  });

  it('offers only the transitions the purchase-order workflow allows', async () => {
    render(<PurchaseOrdersPage />);
    await waitFor(() => {
      expect(screen.getByText('PO123')).toBeInTheDocument();
    });

    // A pending order can be approved or cancelled, but not completed.
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark delivered')).not.toBeInTheDocument();
  });

  it('disables New Order button without permission', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', name: 'Test User', email: 'test@test.com', role: 'admin', permissions: ['all:*'] },
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isAuthLoading: false,
      hasPermission: vi.fn(() => false),
      canActOnHospital: vi.fn(() => true),
      canActOnDepartment: vi.fn(() => true),
      mfaPending: false,
      mfaPendingUser: null,
      verifyMfaTotp: vi.fn(),
      verifyMfaRecovery: vi.fn(),
      verifyMfaPasskey: vi.fn(),
      cancelMfa: vi.fn(),
      refreshUser: vi.fn(),
    });
    render(<PurchaseOrdersPage />);
    expect(screen.getByText('New Order')).toBeDisabled();
  });
});