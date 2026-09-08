import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, DollarSign, TrendingUp, TrendingDown, FileText, Download, RefreshCw, AlertCircle, Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { exportToCSV } from '@/utils/csv';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Income' | 'Expense';
  parent?: string;
  balance: number;
  level: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  account: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string;
}

const mockAccounts: Account[] = [
  { id: 'A001', code: '1000', name: 'Assets', type: 'Asset', balance: 500000, level: 0 },
  { id: 'A002', code: '1100', name: 'Current Assets', type: 'Asset', parent: 'A001', balance: 300000, level: 1 },
  { id: 'A003', code: '1110', name: 'Cash', type: 'Asset', parent: 'A002', balance: 150000, level: 2 },
  { id: 'A004', code: '1120', name: 'Accounts Receivable', type: 'Asset', parent: 'A002', balance: 150000, level: 2 },
  { id: 'L001', code: '2000', name: 'Liabilities', type: 'Liability', balance: 200000, level: 0 },
  { id: 'L002', code: '2100', name: 'Current Liabilities', type: 'Liability', parent: 'L001', balance: 200000, level: 1 },
  { id: 'I001', code: '3000', name: 'Income', type: 'Income', balance: 450000, level: 0 },
  { id: 'I002', code: '3100', name: 'Service Revenue', type: 'Income', parent: 'I001', balance: 450000, level: 1 },
  { id: 'E001', code: '4000', name: 'Expenses', type: 'Expense', balance: 250000, level: 0 },
  { id: 'E002', code: '4100', name: 'Operating Expenses', type: 'Expense', parent: 'E001', balance: 250000, level: 1 },
];

const mockTransactions: Transaction[] = [
  {
    id: 'T001',
    date: '2024-01-15',
    description: 'Patient consultation fees',
    account: 'Service Revenue',
    debit: 0,
    credit: 5000,
    balance: 5000,
    reference: 'INV-001',
  },
  {
    id: 'T002',
    date: '2024-01-14',
    description: 'Medical supplies purchase',
    account: 'Operating Expenses',
    debit: 3500,
    credit: 0,
    balance: 3500,
    reference: 'PO-045',
  },
  {
    id: 'T003',
    date: '2024-01-13',
    description: 'Staff salaries',
    account: 'Operating Expenses',
    debit: 15000,
    credit: 0,
    balance: 15000,
    reference: 'SAL-JAN',
  },
];

export default function FinancialPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('coa');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    accountName: '',
    accountType: '',
    parentAccountId: '',
    balance: '',
  });
  const [newAccountError, setNewAccountError] = useState<string | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    accountId: '',
    transactionDate: '',
    description: '',
    debit: '',
    credit: '',
    reference: '',
  });
  const [newTransactionError, setNewTransactionError] = useState<string | null>(null);
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadTransactions();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      setAccountsError(null);
      const data = await api.getAccounts() as any[];
      const transformedData = data.map((acc: any) => ({
        id: acc.id,
        code: acc.account_code,
        name: acc.account_name,
        type: acc.account_type as 'Asset' | 'Liability' | 'Income' | 'Expense',
        parent: acc.parent_account_id,
        balance: acc.balance,
        level: acc.level,
      }));
      setAccounts(transformedData);
    } catch (error: any) {
      console.error('Failed to load accounts:', error);
      setAccountsError(error.message);
      setAccounts(mockAccounts);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoadingTransactions(true);
      setTransactionsError(null);
      const data = await api.getTransactions() as any[];
      const transformedData = data.map((txn: any) => ({
        id: txn.id,
        date: txn.transaction_date,
        description: txn.description,
        account: txn.account_name, // Assuming account_name is joined from accounts table
        debit: txn.debit,
        credit: txn.credit,
        balance: txn.balance,
        reference: txn.reference,
      }));
      setTransactions(transformedData);
    } catch (error: any) {
      console.error('Failed to load transactions:', error);
      setTransactionsError(error.message);
      setTransactions(mockTransactions);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleAccountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewAccount(prev => ({ ...prev, [id]: value }));
  };

  const handleAccountSelectChange = (id: string, value: string) => {
    setNewAccount(prev => ({ ...prev, [id]: value }));
  };

  const handleAddAccount = async () => {
    setNewAccountError(null);
    if (!newAccount.accountName || !newAccount.accountType || newAccount.balance === '') {
      setNewAccountError('Please fill in all required account fields.');
      return;
    }
    const balance = parseFloat(newAccount.balance);
    if (isNaN(balance)) {
      setNewAccountError('Balance must be a valid number.');
      return;
    }

    try {
      setIsSubmittingAccount(true);
      await api.createAccount({
        accountName: newAccount.accountName,
        accountType: newAccount.accountType,
        parentAccountId: newAccount.parentAccountId === '' ? undefined : newAccount.parentAccountId,
        balance: balance,
      });
      await loadAccounts();
      setIsAccountDialogOpen(false);
      setNewAccount({
        accountName: '',
        accountType: '',
        parentAccountId: '',
        balance: '',
      });
    } catch (error: any) {
      console.error('Failed to create account:', error);
      setNewAccountError(error.message || 'Failed to create account.');
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleTransactionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewTransaction(prev => ({ ...prev, [id]: value }));
  };

  const handleTransactionSelectChange = (id: string, value: string) => {
    setNewTransaction(prev => ({ ...prev, [id]: value }));
  };

  const handleAddTransaction = async () => {
    setNewTransactionError(null);
    if (!newTransaction.accountId || !newTransaction.transactionDate || !newTransaction.description || (newTransaction.debit === '' && newTransaction.credit === '')) {
      setNewTransactionError('Please fill in all required transaction fields.');
      return;
    }

    const debit = parseFloat(newTransaction.debit);
    const credit = parseFloat(newTransaction.credit);

    if (isNaN(debit) && isNaN(credit)) {
      setNewTransactionError('Debit or Credit must be a valid number.');
      return;
    }
    if (!isNaN(debit) && !isNaN(credit) && debit > 0 && credit > 0) {
      setNewTransactionError('A transaction cannot have both debit and credit values. Please enter either a debit or a credit.');
      return;
    }

    try {
      setIsSubmittingTransaction(true);
      await api.createTransaction({
        accountId: newTransaction.accountId,
        transactionDate: newTransaction.transactionDate,
        description: newTransaction.description,
        debit: isNaN(debit) ? 0 : debit,
        credit: isNaN(credit) ? 0 : credit,
        reference: newTransaction.reference,
      });
      await loadTransactions();
      setIsTransactionDialogOpen(false);
      setNewTransaction({
        accountId: '',
        transactionDate: '',
        description: '',
        debit: '',
        credit: '',
        reference: '',
      });
    } catch (error: any) {
      console.error('Failed to create transaction:', error);
      setNewTransactionError(error.message || 'Failed to create transaction.');
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const totalAssets = accounts.filter(a => a.type === 'Asset' && a.level === 0).reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'Liability' && a.level === 0).reduce((sum, a) => sum + a.balance, 0);
  const totalIncome = accounts.filter(a => a.type === 'Income' && a.level === 0).reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = accounts.filter(a => a.type === 'Expense' && a.level === 0).reduce((sum, a) => sum + a.balance, 0);
  const netProfit = totalIncome - totalExpenses;

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    if (activeTab === 'coa') {
      if (!accounts.length) {
        toast.error('No accounts to export');
        return;
      }
      exportToCSV(`chart_of_accounts_${dateStr}`, accounts.map(a => ({
        Code: a.code,
        'Account Name': a.name,
        Type: a.type,
        'Level': a.level,
        'Balance (GHS)': a.balance,
      })));
      toast.success('Chart of Accounts exported to CSV');
    } else if (activeTab === 'transactions') {
      if (!transactions.length) {
        toast.error('No transactions to export');
        return;
      }
      exportToCSV(`transactions_${dateStr}`, transactions.map(t => ({
        ID: t.id,
        Date: t.date,
        Description: t.description,
        Account: t.account,
        'Debit (GHS)': t.debit,
        'Credit (GHS)': t.credit,
        'Balance (GHS)': t.balance,
        Reference: t.reference,
      })));
      toast.success('Transactions exported to CSV');
    } else if (activeTab === 'balance') {
      const balanceData = [
        ...accounts.filter(a => a.type === 'Asset').map(a => ({ Category: 'Asset', Name: a.name, 'Balance (GHS)': a.balance })),
        { Category: 'Asset Total', Name: 'Total Assets', 'Balance (GHS)': totalAssets },
        ...accounts.filter(a => a.type === 'Liability').map(a => ({ Category: 'Liability', Name: a.name, 'Balance (GHS)': a.balance })),
        { Category: 'Liability Total', Name: 'Total Liabilities', 'Balance (GHS)': totalLiabilities },
      ];
      exportToCSV(`balance_sheet_${dateStr}`, balanceData);
      toast.success('Balance Sheet exported to CSV');
    } else if (activeTab === 'income') {
      const incomeData = [
        ...accounts.filter(a => a.type === 'Income').map(a => ({ Category: 'Income', Name: a.name, 'Amount (GHS)': a.balance })),
        { Category: 'Income Total', Name: 'Total Revenue', 'Amount (GHS)': totalIncome },
        ...accounts.filter(a => a.type === 'Expense').map(a => ({ Category: 'Expense', Name: a.name, 'Amount (GHS)': a.balance })),
        { Category: 'Expense Total', Name: 'Total Expenses', 'Amount (GHS)': totalExpenses },
        { Category: 'Net Result', Name: 'Net Profit', 'Amount (GHS)': netProfit },
      ];
      exportToCSV(`income_statement_${dateStr}`, incomeData);
      toast.success('Income Statement exported to CSV');
    }
  };

  const activeTabName =
    activeTab === 'coa'
      ? 'Chart of Accounts'
      : activeTab === 'transactions'
      ? 'Transaction History'
      : activeTab === 'balance'
      ? 'Balance Sheet'
      : 'Income Statement';

  return (
    <div className="space-y-6">
      {/* Print-only Header */}
      <div className="hidden print:block mb-6 border-b border-gray-400 pb-4">
        <h1 className="text-2xl font-bold text-black">Smart Health Manager — Financial Report</h1>
        <p className="text-sm text-gray-700 font-medium mt-1">{activeTabName}</p>
        <div className="flex justify-between text-xs text-gray-600 mt-2">
          <span>Generated: {new Date().toLocaleString()}</span>
          <span>Net Profit: GHS {netProfit.toLocaleString()}</span>
        </div>
      </div>

      {loadingAccounts || loadingTransactions ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-9 w-64 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : accountsError || transactionsError ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
          {accountsError && <p className="text-red-500 mb-2">Accounts: {accountsError}</p>}
          {transactionsError && <p className="text-red-500 mb-2">Transactions: {transactionsError}</p>}
          <div className="flex gap-2 justify-center mt-4">
            {accountsError && (
              <Button onClick={loadAccounts} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry Accounts
              </Button>
            )}
            {transactionsError && (
              <Button onClick={loadTransactions} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry Transactions
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Financial Management</h1>
              <p className="text-muted-foreground">Chart of Accounts and financial reporting</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={handlePrint} title="Print current financial view">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleExport} title="Export current financial data to CSV">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" disabled={!hasPermission('financial:add')}>
                    <Plus className="h-4 w-4" />
                    New Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Account</DialogTitle>
                    <DialogDescription>
                      Add a new account to the Chart of Accounts
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="accountName">Account Name</Label>
                        <Input id="accountName" placeholder="e.g., Inventory" value={newAccount.accountName} onChange={handleAccountInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountType">Account Type</Label>
                        <Select onValueChange={(value) => handleAccountSelectChange('accountType', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Asset">Asset</SelectItem>
                            <SelectItem value="Liability">Liability</SelectItem>
                            <SelectItem value="Income">Income</SelectItem>
                            <SelectItem value="Expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parentAccountId">Parent Account (Optional)</Label>
                      <Select onValueChange={(value) => handleAccountSelectChange('parentAccountId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None (Main Account)</SelectItem>
                          {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="balance">Opening Balance</Label>
                      <Input id="balance" type="number" step="0.01" placeholder="0.00" value={newAccount.balance} onChange={handleAccountInputChange} />
                    </div>
                    {newAccountError && <p className="text-red-500 text-sm">{newAccountError}</p>}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)} disabled={isSubmittingAccount}>Cancel</Button>
                    <Button onClick={handleAddAccount} disabled={isSubmittingAccount || !hasPermission('financial:add')}>
                      {isSubmittingAccount ? 'Creating...' : 'Create Account'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">GHS {totalAssets.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  +12% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Liabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">GHS {totalLiabilities.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  -5% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">GHS {totalIncome.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  +18% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">GHS {netProfit.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="print:hidden">
              <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
              <TabsTrigger value="income">Income Statement</TabsTrigger>
            </TabsList>

            <TabsContent value="coa">
              <Card>
                <CardHeader>
                  <CardTitle>Chart of Accounts</CardTitle>
                  <CardDescription>Hierarchical view of all accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAccounts ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-12" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : accounts.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No accounts found.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-mono">{account.code}</TableCell>
                            <TableCell>
                              <span className={`pl-[${account.level * 20}px]`}>
                                {account.name}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{account.type}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              GHS {account.balance.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">Edit</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Transaction History</CardTitle>
                      <CardDescription>All financial transactions with audit trail</CardDescription>
                    </div>
                    <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2" disabled={!hasPermission('financial:add')}>
                          <Plus className="h-4 w-4" />
                          New Transaction
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Record Transaction</DialogTitle>
                          <DialogDescription>Add a new financial transaction</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="transactionDate">Date</Label>
                            <Input id="transactionDate" type="date" value={newTransaction.transactionDate} onChange={handleTransactionInputChange} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input id="description" placeholder="Transaction description" value={newTransaction.description} onChange={handleTransactionInputChange} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="accountId">Account</Label>
                            <Select onValueChange={(value) => handleTransactionSelectChange('accountId', value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map(acc => (
                                  <SelectItem key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="debit">Debit</Label>
                              <Input id="debit" type="number" step="0.01" placeholder="0.00" value={newTransaction.debit} onChange={handleTransactionInputChange} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="credit">Credit</Label>
                              <Input id="credit" type="number" step="0.01" placeholder="0.00" value={newTransaction.credit} onChange={handleTransactionInputChange} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="reference">Reference</Label>
                            <Input id="reference" placeholder="e.g., INV-001" value={newTransaction.reference} onChange={handleTransactionInputChange} />
                          </div>
                          {newTransactionError && <p className="text-red-500 text-sm">{newTransactionError}</p>}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsTransactionDialogOpen(false)} disabled={isSubmittingTransaction}>Cancel</Button>
                          <Button onClick={handleAddTransaction} disabled={isSubmittingTransaction || !hasPermission('financial:add')}>
                            {isSubmittingTransaction ? 'Recording...' : 'Record Transaction'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingTransactions ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No transactions found.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((txn) => (
                            <TableRow key={txn.id}>
                              <TableCell>{txn.date}</TableCell>
                              <TableCell>{txn.description}</TableCell>
                              <TableCell>{txn.account}</TableCell>
                              <TableCell className="text-right">
                                {txn.debit > 0 ? `GHS ${txn.debit.toLocaleString()}` : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {txn.credit > 0 ? `GHS ${txn.credit.toLocaleString()}` : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                GHS {txn.balance.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{txn.reference}</Badge>
                              </TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="balance">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-accent" />
                        Balance Sheet
                      </CardTitle>
                      <CardDescription>As of {new Date().toLocaleDateString()}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 print:hidden">
                      <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint} title="Print Balance Sheet">
                        <Printer className="h-4 w-4" />
                        Print
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} title="Export to CSV">
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-foreground">Assets</h3>
                      <Table>
                        <TableBody>
                          {loadingAccounts ? (
                            <>
                              {[1, 2, 3].map((i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                </TableRow>
                              ))}
                            </>
                          ) : (
                            accounts.filter(a => a.type === 'Asset').map(acc => (
                              <TableRow key={acc.id}>
                                <TableCell className={`pl-[${acc.level * 20}px]`}>
                                  {acc.name}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  GHS {acc.balance.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          <TableRow className="border-t-2">
                            <TableCell className="font-bold">Total Assets</TableCell>
                            <TableCell className="text-right font-bold text-accent">
                              GHS {totalAssets.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-foreground">Liabilities</h3>
                      <Table>
                        <TableBody>
                          {loadingAccounts ? (
                            <>
                              {[1, 2, 3].map((i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                </TableRow>
                              ))}
                            </>
                          ) : (
                            accounts.filter(a => a.type === 'Liability').map(acc => (
                              <TableRow key={acc.id}>
                                <TableCell className={`pl-[${acc.level * 20}px]`}>
                                  {acc.name}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  GHS {acc.balance.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          <TableRow className="border-t-2">
                            <TableCell className="font-bold">Total Liabilities</TableCell>
                            <TableCell className="text-right font-bold text-accent">
                              GHS {totalLiabilities.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="income">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-accent" />
                        Income Statement
                      </CardTitle>
                      <CardDescription>For the period ending {new Date().toLocaleDateString()}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 print:hidden">
                      <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint} title="Print Income Statement">
                        <Printer className="h-4 w-4" />
                        Print
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} title="Export to CSV">
                        <Download className="h-4 w-4" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-foreground">Revenue</h3>
                      <Table>
                        <TableBody>
                          {loadingAccounts ? (
                            <>
                              {[1, 2, 3].map((i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                </TableRow>
                              ))}
                            </>
                          ) : (
                            accounts.filter(a => a.type === 'Income').map(acc => (
                              <TableRow key={acc.id}>
                                <TableCell className={`pl-[${acc.level * 20}px]`}>
                                  {acc.name}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  GHS {acc.balance.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          <TableRow className="border-t-2">
                            <TableCell className="font-bold">Total Revenue</TableCell>
                            <TableCell className="text-right font-bold text-accent">
                              GHS {totalIncome.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-foreground">Expenses</h3>
                      <Table>
                        <TableBody>
                          {loadingAccounts ? (
                            <>
                              {[1, 2, 3].map((i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                </TableRow>
                              ))}
                            </>
                          ) : (
                            accounts.filter(a => a.type === 'Expense').map(acc => (
                              <TableRow key={acc.id}>
                                <TableCell className={`pl-[${acc.level * 20}px]`}>
                                  {acc.name}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  GHS {acc.balance.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                          <TableRow className="border-t-2">
                            <TableCell className="font-bold">Total Expenses</TableCell>
                            <TableCell className="text-right font-bold text-destructive">
                              GHS {totalExpenses.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <div className="border-t-2 pt-4">
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-bold text-lg">Net Profit</TableCell>
                            <TableCell className="text-right font-bold text-lg text-accent">
                              GHS {netProfit.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
