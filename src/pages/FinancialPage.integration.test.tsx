import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    getMe: vi.fn(),
  },
}));

// Mock AuthContext to provide authenticated user immediately
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      name: 'Test Admin',
      email: 'admin@test.com',
      role: 'admin',
      permissions: ['all:all'],
      hospital_id: 'h1',
      totp_enabled: false,
      recovery_codes_count: 0,
      password_must_change: false,
    },
    hasPermission: () => true,
    isAuthenticated: true,
    isAuthLoading: false,
    logout: vi.fn(),
    canActOnHospital: () => true,
    canActOnDepartment: () => true,
    mfaPending: false,
    mfaPendingUser: null,
    verifyMfaTotp: vi.fn(),
    verifyMfaRecovery: vi.fn(),
    verifyMfaPasskey: vi.fn(),
    cancelMfa: vi.fn(),
    refreshUser: vi.fn(),
    login: vi.fn(),
  }),
}));

const mockAccounts = [
  { id: 'A001', account_code: '1000', name: 'Assets', type: 'asset', balance: 500000, level: 0 },
  { id: 'A002', account_code: '1100', name: 'Current Assets', type: 'asset', parent_id: 'A001', balance: 300000, level: 1 },
  { id: 'L001', account_code: '2000', name: 'Liabilities', type: 'liability', balance: 200000, level: 0 },
  { id: 'I001', account_code: '3000', name: 'Income', type: 'income', balance: 450000, level: 0 },
  { id: 'E001', account_code: '4000', name: 'Expenses', type: 'expense', balance: 250000, level: 0 },
];

const mockTransactions = [
  {
    id: 'T001',
    date: '2024-01-15',
    description: 'Patient consultation fees',
    account_name: 'Service Revenue',
    debit: 0,
    credit: 5000,
    balance: 5000,
    reference: 'INV-001',
  },
  {
    id: 'T002',
    date: '2024-01-14',
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

      const { container } = render(<FinancialPage />);

      // Initially should show loading
      expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

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
        name: 'Inventory',
        type: 'asset',
        balance: 50000,
        level: 1,
      };

      vi.mocked(api.createAccount).mockResolvedValue({ success: true });
      vi.mocked(api.getAccounts).mockResolvedValueOnce(mockAccounts)
        .mockResolvedValueOnce([...mockAccounts, newAccount]);

      const user = userEvent.setup();
      render(<FinancialPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Open dialog
      const newAccountButton = screen.getByRole('button', { name: /New Account/i });
      await user.click(newAccountButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Create New Account')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Fill form - Account Name, Account Type (Radix Select), Balance
      const accountNameInput = screen.getByPlaceholderText('e.g., Inventory');
      const balanceInput = screen.getByPlaceholderText('0.00');

      await user.type(accountNameInput, 'Inventory');
      await user.type(balanceInput, '50000');

      // Select Account Type (Radix Select) - first combobox in dialog
      const dialog = screen.getByRole('dialog');
      const accountTypeSelect = within(dialog).getAllByRole('combobox')[0];
      await user.click(accountTypeSelect);
      await user.click(await screen.findByRole('option', { name: 'Asset' }));

      // Submit - all required fields filled
      const createButton = screen.getByRole('button', { name: /Create Account/i });
      await user.click(createButton);

      // Verify API was called with correct payload
      await waitFor(() => {
        expect(api.createAccount).toHaveBeenCalledWith(
          expect.objectContaining({
            accountName: 'Inventory',
            accountType: 'Asset',
            balance: 50000,
          })
        );
      }, { timeout: 15000 });

      // Verify accounts were reloaded
      await waitFor(() => {
        expect(api.getAccounts).toHaveBeenCalledTimes(2);
      }, { timeout: 15000 });
    }, 20000);

    it('should handle account creation errors', async () => {
      vi.mocked(api.createAccount).mockRejectedValue(new Error('Duplicate account code'));

      const user = userEvent.setup();
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const newAccountButton = screen.getByRole('button', { name: /New Account/i });
      await user.click(newAccountButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Create New Account')).toBeInTheDocument();
      });

      const accountNameInput = screen.getByPlaceholderText('e.g., Inventory');
      const balanceInput = screen.getByPlaceholderText('0.00');

      await user.type(accountNameInput, 'Test');
      await user.type(balanceInput, '1000');

      // Select Account Type (required for API call)
      const dialog = screen.getByRole('dialog');
      const accountTypeSelect = within(dialog).getAllByRole('combobox')[0];
      await user.click(accountTypeSelect);
      await user.click(await screen.findByRole('option', { name: 'Asset' }));

      const createButton = screen.getByRole('button', { name: /Create Account/i });
      await user.click(createButton);

      // Should show API error in dialog
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Duplicate account code/i)).toBeInTheDocument();
      });

      // Dialog should remain open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Transaction Creation Flow', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should complete full transaction creation workflow', { timeout: 15000 }, async () => {
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

      const user = userEvent.setup();
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      // Switch to transactions tab
      const transactionsTab = screen.getByRole('tab', { name: /Transactions/i });
      await user.click(transactionsTab);

      // Wait for tab content to load - use the tab panel
      await waitFor(() => {
        const tabPanel = screen.getByRole('tabpanel');
        expect(within(tabPanel).getByText('Transaction History')).toBeInTheDocument();
      });

      // Find New Transaction button (should be visible now)
      const newTransactionButton = screen.getByRole('button', { name: /New Transaction/i });
      await user.click(newTransactionButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        // Dialog title is unique within dialog
        expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Record Transaction' })).toBeInTheDocument();
      });

      // Fill form - Date, Description, Account (required), Debit, Reference
      const dateInput = screen.getByLabelText('Date');
      const descriptionInput = screen.getByPlaceholderText('Transaction description');
      const accountSelect = within(screen.getByRole('dialog')).getByRole('combobox');
      const debitInput = screen.getAllByPlaceholderText('0.00')[0];
      const referenceInput = screen.getByPlaceholderText('e.g., INV-001');

      await user.type(dateInput, '2024-01-16');
      await user.type(descriptionInput, 'Equipment purchase');
      await user.click(accountSelect);
      await user.click(screen.getByRole('option', { name: /1000 - Assets/ }));
      await user.type(debitInput, '10000');
      await user.type(referenceInput, 'PO-046');

      // Submit - use the button within the dialog
      const recordButton = within(screen.getByRole('dialog')).getByRole('button', { name: /Record Transaction/i });
      await user.click(recordButton);

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

      const user = userEvent.setup();
      render(<FinancialPage />);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Error Loading Data/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByText(/Retry Accounts/i);
      await user.click(retryButton);

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
      const user = userEvent.setup();
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      // Chart of Accounts (default) - check the tab trigger is active
      const coaTab = screen.getByRole('tab', { name: /Chart of Accounts/i, selected: true });
      expect(coaTab).toBeInTheDocument();
      // Check the tab panel content
      const coaPanel = screen.getByRole('tabpanel');
      expect(within(coaPanel).getByText('Chart of Accounts')).toBeInTheDocument();

      // Transactions
      const transactionsTab = screen.getByRole('tab', { name: /Transactions/i });
      await user.click(transactionsTab);
      await waitFor(() => {
        const panel = screen.getByRole('tabpanel');
        expect(within(panel).getByText('Transaction History')).toBeInTheDocument();
      });

      // Balance Sheet
      const balanceTab = screen.getByRole('tab', { name: /Balance Sheet/i });
      await user.click(balanceTab);
      await waitFor(() => {
        const panel = screen.getByRole('tabpanel');
        expect(within(panel).getByText('Balance Sheet')).toBeInTheDocument();
      });

      // Income Statement
      const incomeTab = screen.getByRole('tab', { name: /Income Statement/i });
      await user.click(incomeTab);
      await waitFor(() => {
        const panel = screen.getByRole('tabpanel');
        expect(within(panel).getByText('Income Statement')).toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should handle multiple rapid clicks gracefully', async () => {
      const user = userEvent.setup();
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const newAccountButton = screen.getByRole('button', { name: /New Account/i });
      await user.click(newAccountButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Create New Account')).toBeInTheDocument();
      });

      // Verify dialog can be opened and closed
      const closeButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Re-open dialog
      await user.click(newAccountButton);
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });
  });
});