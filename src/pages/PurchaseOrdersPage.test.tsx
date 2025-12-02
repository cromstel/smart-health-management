import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PurchaseOrdersPage from './PurchaseOrdersPage';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { vi } from 'vitest';

vi.mock('@/services/api');
vi.mock('@/contexts/AuthContext');
vi.mock('@/contexts/AuditContext');

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAuth = useAuth as jest.Mock;
const mockUseAudit = useAudit as jest.Mock;

const mockOrders = [
  { id: 1, order_id: 'PO123', supplier_id: 1, order_date: '2025-01-01', expected_delivery_date: '2025-01-10', status: 'Pending', total_amount: 100 },
];
const mockSuppliers = [{ id: 1, name: 'Supplier A' }];
const mockMedicines = [{ id: 1, name: 'Medicine A' }];
const mockAccounts = [{ id: 1, name: 'Inventory' }];

describe('PurchaseOrdersPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true });
    mockUseAudit.mockReturnValue({ logAction: vi.fn() });

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

    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Order Date'), { target: { value: '2025-01-05' } });

    fireEvent.click(screen.getByText('Add Item'));
    
    await waitFor(() => {
        const medicineSelect = screen.getByDisplayValue('Select medicine');
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
      expect(mockApi.updatePurchaseOrder).toHaveBeenCalledWith(1, { status: 'Ordered' });
    });
  });

  it('disables New Order button without permission', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false });
    render(<PurchaseOrdersPage />);
    expect(screen.getByText('New Order')).toBeDisabled();
  });
});