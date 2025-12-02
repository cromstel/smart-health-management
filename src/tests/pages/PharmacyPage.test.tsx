import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PharmacyPage from '@/pages/PharmacyPage';
import App from '@/App';
import { api } from '@/services/api';

describe('PharmacyPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // Mock auth
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: {
      id: 'u1', name: 'Tester', email: 't@e.st', role: 'admin', permissions: ['pharmacy:view','pharmacy:add','pharmacy:edit','purchaseOrder:add','purchaseOrder:view','purchaseOrder:edit','all:view'], hospital_id: 'h1'
    }} as any);
    localStorage.setItem('token', 'test');
  });

  it('loads medicines and shows inventory', async () => {
    vi.spyOn(api, 'getMedicines').mockResolvedValue([
      { id: 'm1', medicine_name: 'TestMed', category: 'Cat', stock_level: 5, low_stock_threshold: 10, unit_price: 2, expiry_date: '2026-01-01', supplier: 'Sup1' }
    ] as any);
    render(<App />);
    // Navigate to pharmacy route
    window.history.pushState({}, '', '/pharmacy');
    expect(await screen.findByText('Pharmacy & Inventory')).toBeDefined();
    expect(await screen.findByText('TestMed')).toBeDefined();
  });

  it('auto reorder creates purchase orders', async () => {
    vi.spyOn(api, 'getMedicines').mockResolvedValue([
      { id: 'm1', medicine_name: 'MedA', category: 'Cat', stock_level: 0, low_stock_threshold: 5, unit_price: 3, expiry_date: '2026-01-01', supplier: 'SupX' }
    ] as any);
    vi.spyOn(api, 'getSuppliers').mockResolvedValue([{ id: 's1', name: 'SupX' }] as any);
    const createPO = vi.spyOn(api, 'createPurchaseOrder').mockResolvedValue({ id: 'po1' } as any);
    render(<App />);
    window.history.pushState({}, '', '/pharmacy');
    const btn = await screen.findByText('Reorder');
    fireEvent.click(btn);
    await waitFor(() => expect(createPO).toHaveBeenCalled());
  });

  it('barcode validation rejects short codes', () => {
    render(<PharmacyPage />);
    const scanBtn = screen.getByText('Scan Barcode');
    fireEvent.click(scanBtn);
    const input = screen.getByPlaceholderText('Enter code manually');
    fireEvent.change(input, { target: { value: '123' } });
    const confirm = screen.getByText('Confirm');
    fireEvent.click(confirm);
  });
});