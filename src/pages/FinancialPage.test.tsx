import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
];

describe('FinancialPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading States', () => {
    it('should display loading skeletons when data is being fetched', () => {
      vi.mocked(api.getAccounts).mockImplementation(() => new Promise(() => {}));
      vi.mocked(api.getTransactions).mockImplementation(() => new Promise(() => {}));

      render(<FinancialPage />);

      // Check for skeleton loaders
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display data after successful load', async () => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
        expect(screen.getByText('Assets')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when accounts fail to load', async () => {
      vi.mocked(api.getAccounts).mockRejectedValue(new Error('Network error'));
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText(/Error Loading Data/i)).toBeInTheDocument();
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('should display retry button on error', async () => {
      vi.mocked(api.getAccounts).mockRejectedValue(new Error('Network error'));
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText(/Retry Accounts/i)).toBeInTheDocument();
      });
    });

    it('should retry loading when retry button is clicked', async () => {
      vi.mocked(api.getAccounts).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(api.getAccounts).mockResolvedValueOnce(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText(/Retry Accounts/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/Retry Accounts/i);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(api.getAccounts).toHaveBeenCalledTimes(2);
      });
    });

    it('should fall back to mock data on error', async () => {
      vi.mocked(api.getAccounts).mockRejectedValue(new Error('Network error'));
      vi.mocked(api.getTransactions).mockRejectedValue(new Error('Network error'));

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText(/Error Loading Data/i)).toBeInTheDocument();
      });
    });
  });

  describe('Account Management', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should open account creation dialog when New Account button is clicked', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const newAccountButton = screen.getByRole('button', { name: /New Account/i });
      fireEvent.click(newAccountButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Account')).toBeInTheDocument();
      });
    });

    it('should validate required fields when creating account', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const newAccountButton = screen.getByRole('button', { name: /New Account/i });
      fireEvent.click(newAccountButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Account')).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /Create Account/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Please fill in all required account fields/i)).toBeInTheDocument();
      });
    });

    it('should validate balance is a number', async () => {
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

      fireEvent.change(accountNameInput, { target: { value: 'Test Account' } });
      fireEvent.change(balanceInput, { target: { value: 'invalid' } });

      const createButton = screen.getByRole('button', { name: /Create Account/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Balance must be a valid number/i)).toBeInTheDocument();
      });
    });

    it('should create account successfully', async () => {
      vi.mocked(api.createAccount).mockResolvedValue({ success: true });

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

      fireEvent.change(accountNameInput, { target: { value: 'Test Account' } });
      fireEvent.change(balanceInput, { target: { value: '1000' } });

      // Select account type
      const typeSelect = screen.getByRole('combobox');
      fireEvent.click(typeSelect);

      const createButton = screen.getByRole('button', { name: /Create Account/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(api.createAccount).toHaveBeenCalled();
      });
    });

    it('should disable buttons during account submission', async () => {
      vi.mocked(api.createAccount).mockImplementation(() => new Promise(() => {}));

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

      fireEvent.change(accountNameInput, { target: { value: 'Test Account' } });
      fireEvent.change(balanceInput, { target: { value: '1000' } });

      const createButton = screen.getByRole('button', { name: /Create Account/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Management', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should open transaction creation dialog', async () => {
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
    });

    it('should validate transaction fields', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const transactionsTab = screen.getByRole('tab', { name: /Transactions/i });
      fireEvent.click(transactionsTab);

      await waitFor(() => {
        const newTransactionButton = screen.getByRole('button', { name: /New Transaction/i });
        fireEvent.click(newTransactionButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Record Transaction')).toBeInTheDocument();
      });

      const recordButton = screen.getByRole('button', { name: /Record Transaction/i });
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(screen.getByText(/Please fill in all required transaction fields/i)).toBeInTheDocument();
      });
    });

    it('should prevent both debit and credit values', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const transactionsTab = screen.getByRole('tab', { name: /Transactions/i });
      fireEvent.click(transactionsTab);

      await waitFor(() => {
        const newTransactionButton = screen.getByRole('button', { name: /New Transaction/i });
        fireEvent.click(newTransactionButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Record Transaction')).toBeInTheDocument();
      });

      const descriptionInput = screen.getByPlaceholderText('Transaction description');
      const debitInput = screen.getAllByPlaceholderText('0.00')[0];
      const creditInput = screen.getAllByPlaceholderText('0.00')[1];

      fireEvent.change(descriptionInput, { target: { value: 'Test Transaction' } });
      fireEvent.change(debitInput, { target: { value: '100' } });
      fireEvent.change(creditInput, { target: { value: '100' } });

      const recordButton = screen.getByRole('button', { name: /Record Transaction/i });
      fireEvent.click(recordButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot have both debit and credit values/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    beforeEach(() => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);
    });

    it('should display financial statistics', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Assets')).toBeInTheDocument();
        expect(screen.getByText('Total Liabilities')).toBeInTheDocument();
        expect(screen.getByText('Total Revenue')).toBeInTheDocument();
        expect(screen.getByText('Net Profit')).toBeInTheDocument();
      });
    });

    it('should display accounts in chart of accounts tab', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
        expect(screen.getByText('Assets')).toBeInTheDocument();
      });
    });

    it('should display transactions in transactions tab', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const transactionsTab = screen.getByRole('tab', { name: /Transactions/i });
      fireEvent.click(transactionsTab);

      await waitFor(() => {
        expect(screen.getByText('Patient consultation fees')).toBeInTheDocument();
        expect(screen.getByText('INV-001')).toBeInTheDocument();
      });
    });

    it('should switch between tabs correctly', async () => {
      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      // Switch to Balance Sheet
      const balanceTab = screen.getByRole('tab', { name: /Balance Sheet/i });
      fireEvent.click(balanceTab);

      await waitFor(() => {
        expect(screen.getByText('Balance Sheet')).toBeInTheDocument();
      });

      // Switch to Income Statement
      const incomeTab = screen.getByRole('tab', { name: /Income Statement/i });
      fireEvent.click(incomeTab);

      await waitFor(() => {
        expect(screen.getByText('Income Statement')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should display empty state when no accounts exist', async () => {
      vi.mocked(api.getAccounts).mockResolvedValue([]);
      vi.mocked(api.getTransactions).mockResolvedValue(mockTransactions);

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('No accounts found.')).toBeInTheDocument();
      });
    });

    it('should display empty state when no transactions exist', async () => {
      vi.mocked(api.getAccounts).mockResolvedValue(mockAccounts);
      vi.mocked(api.getTransactions).mockResolvedValue([]);

      render(<FinancialPage />);

      await waitFor(() => {
        expect(screen.getByText('Financial Management')).toBeInTheDocument();
      });

      const transactionsTab = screen.getByRole('tab', { name: /Transactions/i });
      fireEvent.click(transactionsTab);

      await waitFor(() => {
        expect(screen.getByText('No transactions found.')).toBeInTheDocument();
      });
    });
  });
});