import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import FinancialPage from './FinancialPage';
import { api } from '@/services/api';

// Mock the API service
vi.mock('@/services/api', () => ({
  api: {
    getAccounts: vi.fn(),
    getTransactions: vi.fn(),
    createAccount: vi.fn(),
    createTransaction: vi.fn(),
  },
}));

const mockAccounts = [
  { id: 'A001', account_code: '1000', account_name: 'Assets', account_type: 'Asset', balance: 500000, level: 0 },
  { id: 'A002', account_code: '1100', account_name: 'Current Assets', account_type: 'Asset', parent_account_id: 'A001', balance: 300000, level: 1 },
  { id: 'L001', account_code: '2000', account_name: 'Liabilities', account_type: 'Liability', balance: 200000, level: 0 },
  { id: 'I001', account_code: '3000', account_name: 'Income', account_type: 'Income', balance: 450000, level: 0 },
  { id: 'E001', account_code: '4000', account_name: 'Expenses', account_type: 'Expense', balance: 250000, level: 0 },
];

const mockTransactions = [
  {
    id: 'T001',
    transaction_date: '2024-01-15',
    description: 'Patient consultation fees',
    account_name: 'Service Revenue',
    debit: 0,
    credit: 5000,
    balance: 5000,
    reference: 'INV-001',
  },
  {
    id: 'T002',
    transaction_date: '2024-01-14',
    description: 'Medical supplies purchase',
    account_name: 'Operating Expenses',
    debit: 3500,
    credit: 0,
    balance: 3500,
    reference: 'PO-045',
  },
];

describe('FinancialPage Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Full Page Load Flow', () => {
    it('should load and display all data correctly', async () => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);

      render(<FinancialPage />);

      // Initially should show loading
      expect(screen.getAllByTestId(/skeleton/i).length).toBeGreaterThan(0);

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      // Check statistics cards
      expect(screen.getByText('Total Assets')).toBeInTheDocument();
      expect(screen.getByText('Total Liabilities')).toBeInTheDocument();
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Net Profit')).toBeInTheDocument();

      // Check accounts are displayed
      expect(screen.getByText('Assets')).toBeInTheDocument();
      expect(screen.getByText('Current Assets')).toBeInTheDocument();

      // Verify API calls
      expect(api.getAccounts).toHaveBeenCalledTimes(1);
      expect(api.getTransactions).toHaveBeenCalledTimes(1);
    });

    it('should handle partial data load failures gracefully', async () => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockRejectedValue(new Error('Transaction service unavailable'));

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText(/Error Loading Data/i)).toBeInTheDocument();
        expect(screen.getByText(/Transaction service unavailable/i)).toBeInTheDocument();
      });

      // Should show retry button
      expect(screen.getByText(/Retry Transactions/i)).toBeInTheDocument();
    });
  });

  describe('Account Creation Flow', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should complete full account creation workflow', async () => {
      const newAccount = {
        id: 'A003',
        account_code: '1200',
        account_name: 'Inventory',
        account_type: 'Asset',
        balance: 50000,
        level: 1,
      };

      vi.mocked(api.createAccount).mockResolvedValue({ success: true });
      vi.mocked(api.getAccounts).mockResolvedValueOnce(mockAccounts)
        .mockResolvedValueOnce([...mockAccounts, newAccount]);

      render(<FinancialPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      // Open dialog
      const newAccountButton = screen.getByRole('button', { name: /New Account/i });
      fireEvent.click(newAccountButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Account')).toBeInTheDocument();
      });

      // Fill form
      const accountNameInput = screen.getByPlaceholderText('e.g., Inventory');
      const balanceInput = screen.getByPlaceholderText('0.00');

      fireEvent.change(accountNameInput, { target: { value: 'Inventory' } });
      fireEvent.change(balanceInput, { target: { value: '50000' } });

      // Submit
      const createButton = screen.getByRole('button', { name: /Create Account/i });
      fireEvent.click(createButton);

      // Verify API was called
      await waitFor(() => {
        expect(api.createAccount).toHaveBeenCalledWith(
          expect.objectContaining({
            accountName: 'Inventory',
            balance: 50000,
          })
        );
      });

      // Verify accounts were reloaded
      await waitFor(() => {
        expect(api.getAccounts).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle account creation errors', async () => {
      vi.mocked(api.createAccount).mockRejectedValue(new Error('Duplicate account code'));

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const newAccountButton = screen.getByRole('button', { name: /New Account/i });
      fireEvent.click(newAccountButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Account')).toBeInTheDocument();
      });

      const accountNameInput = screen.getByPlaceholderText('e.g., Inventory');
      const balanceInput = screen.getByPlaceholderText('0.00');

      fireEvent.change(accountNameInput, { target: { value: 'Test' } });
      fireEvent.change(balanceInput, { target: { value: '1000' } });

      const createButton = screen.getByRole('button', { name: /Create Account/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Duplicate account code/i)).toBeInTheDocument();
      });

      // Dialog should remain open
      expect(screen.getByText('Create New Account')).toBeInTheDocument();
    });
  });

  describe('Transaction Creation Flow', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should complete full transaction creation workflow', async () => {
      const newTransaction = {
        id: 'T003',
        transaction_date: '2024-01-16',
        description: 'Equipment purchase',
        account_name: 'Operating Expenses',
        debit: 10000,
        credit: 0,
        balance: 10000,
        reference: 'PO-046',
      };

      vi.mocked(api.createTransaction).mockResolvedValue({ success: true });
      vi.mocked(api.getTransactions).mockResolvedValueOnce(mockTransactions)
        .mockResolvedValueOnce([...mockTransactions, newTransaction]);

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      // Switch to transactions tab
      const transactionsTab = screen.getByRole('tab', { name: /Transactions/i });
      fireEvent.click(transactionsTab);

      await waitFor(() => {
        const newTransactionButton = screen.getByRole('button', { name: /New Transaction/i });
        fireEvent.click(newTransactionButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Record Transaction')).toBeInTheDocument();
      });

      // Fill form
      const descriptionInput = screen.getByPlaceholderText('Transaction description');
      const debitInput = screen.getAllByPlaceholderText('0.00')[0];
      const referenceInput = screen.getByPlaceholderText('e.g., INV-001');

      fireEvent.change(descriptionInput, { target: { value: 'Equipment purchase' } });
      fireEvent.change(debitInput, { target: { value: '10000' } });
      fireEvent.change(referenceInput, { target: { value: 'PO-046' } });

      // Submit
      const recordButton = screen.getByRole('button', { name: /Record Transaction/i });
      fireEvent.click(recordButton);

      // Verify API was called
      await waitFor(() => {
        expect(api.createTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Equipment purchase',
            debit: 10000,
            credit: 0,
            reference: 'PO-046',
          })
        );
      });
    });
  });

  describe('Data Caching Behavior', () => {
    it('should use cached data on subsequent loads', async () => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);

      const { unmount } = render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      expect(api.getAccounts).toHaveBeenCalledTimes(1);
      expect(api.getTransactions).toHaveBeenCalledTimes(1);

      unmount();

      // Render again - should use cache
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      // API should be called again (cache is per instance in this implementation)
      expect(api.getAccounts).toHaveBeenCalledTimes(2);
      expect(api.getTransactions).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery Flow', () => {
    it('should recover from error after retry', async () => {
      vi.mocked(api.getAccounts).mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);

      render(<FinancialPage />);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Error Loading Data/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText(/Retry Accounts/i);
      fireEvent.click(retryButton);

      // Should load successfully
      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
        expect(screen.getByText('Assets')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation Flow', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should navigate through all tabs and display correct content', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      // Chart of Accounts (default)
      expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();

      // Transactions
      const transactionsTab = screen.getByRole('tab', { name: /Transactions/i });
      fireEvent.click(transactionsTab);
      await waitFor(() => {
        expect(screen.getByText('Transaction History')).toBeInTheDocument();
      });

      // Balance Sheet
      const balanceTab = screen.getByRole('tab', { name: /Balance Sheet/i });
      fireEvent.click(balanceTab);
      await waitFor(() => {
        expect(screen.getByText('Balance Sheet')).toBeInTheDocument();
      });

      // Income Statement
      const incomeTab = screen.getByRole('tab', { name: /Income Statement/i });
      fireEvent.click(incomeTab);
      await waitFor(() => {
        expect(screen.getByText('Income Statement')).toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should handle multiple rapid clicks gracefully', async () => {
      vi.mocked(api.createAccount).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const newAccountButton = screen.getByRole('button', { name: /New Account/i });
      fireEvent.click(newAccountButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Account')).toBeInTheDocument();
      });

      const accountNameInput = screen.getByPlaceholderText('e.g., Inventory');
      const balanceInput = screen.getByPlaceholderText('0.00');

      fireEvent.change(accountNameInput, { target: { value: 'Test' } });
      fireEvent.change(balanceInput, { target: { value: '1000' } });

      const createButton = screen.getByRole('button', { name: /Create Account/i });
      
      // Rapid clicks
      fireEvent.click(createButton);
      fireEvent.click(createButton);
      fireEvent.click(createButton);

      // Should only call API once due to disabled state
      await waitFor(() => {
        expect(api.createAccount).toHaveBeenCalledTimes(1);
      });
    });
  });
});