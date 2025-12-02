import { fireEvent, waitFor } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SuperAdminUsers from '../pages/SuperAdminUsers';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';

// Mock the API
vi.mock('../services/api', () => ({
  api: {
    getAllUsers: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}));

// Mock auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock audit context
vi.mock('../contexts/AuditContext', () => ({
  useAudit: vi.fn(),
}));

// Mock Lucide icons to provide identifiable elements for testing
vi.mock('lucide-react', () => ({
  Search: () => <span data-testid="search-icon">🔍</span>,
  UserCheck: () => <span data-testid="user-check-icon">✓</span>,
  UserX: () => <span data-testid="user-x-icon">✗</span>,
  Lock: () => <span data-testid="lock-icon">🔒</span>,
  Unlock: () => <span data-testid="unlock-icon">🔓</span>,
  AlertCircle: () => <span data-testid="alert-icon">⚠️</span>,
}));

// Mock required UI components
vi.mock('../components/ui/card', () => ({  
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('../components/ui/button', () => ({
  Button: ({ children, onClick, disabled, 'data-testid': testId, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId || 'button'}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('../components/ui/input', () => ({
  Input: (props: any) => <input data-testid="input" {...props} />,
}));

vi.mock('../components/ui/select', () => ({
  Select: ({ children, value, 'data-testid': testId, ...props }: any) => (
    <div data-testid={testId || 'select'} data-value={value} {...props}>
      {children}
    </div>
  ),
  SelectContent: () => {
    return <div data-testid="select-content"></div>;
  },
  SelectItem: ({ value }: { value: string }) => (
    <option value={value} data-testid={`select-item-${value}`}></option>
  ),
  SelectTrigger: ({ children: _children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
    <div data-testid="select-trigger" {...props}>{_children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder: string }) => <span data-testid="select-value">{placeholder}</span>,
}));

vi.mock('../components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table data-testid="table">{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody data-testid="table-body">{children}</tbody>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td data-testid="table-cell">{children}</td>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th data-testid="table-head">{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead data-testid="table-header">{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr data-testid="table-row">{children}</tr>,
}));

vi.mock('../components/ui/badge', () => ({
  Badge: ({ variant, children }: { variant: string; children: React.ReactNode }) => (
    <span data-testid={`badge-${variant}`}>{children}</span>
  ),
}));

vi.mock('../components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className}>Loading...</div>,
}));

vi.mock('../components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? children : <span data-testid="tooltip-trigger">{children}</span>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}));

describe('SuperAdminUsers', () => {
  const mockUsers = [
    {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John Doe',
      status: 'active',
      last_login: '2023-12-01T10:00:00Z',
      created_at: '2023-01-01T00:00:00Z',
      role_name: 'Admin',
      role_description: 'System Administrator',
    },
    {
      id: '2',
      email: 'jane.smith@example.com',
      name: 'Jane Smith',
      status: 'inactive',
      last_login: null,
      created_at: '2023-02-01T00:00:00Z',
      role_name: 'Doctor',
      role_description: 'Healthcare Provider',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock contexts
    (useAuth as any).mockReturnValue({
      hasPermission: vi.fn().mockReturnValue(true),
    });

    (useAudit as any).mockReturnValue({
      logAction: vi.fn(),
    });

    // Mock API responses
    (api.getAllUsers as any).mockResolvedValue({ users: mockUsers });
    (api.updateUserStatus as any).mockResolvedValue({ message: 'Status updated' });
  });

  it('should render the component with loading state initially', () => {
    render(<SuperAdminUsers />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('should load and display users after api call', async () => {
    render(<SuperAdminUsers />);

    await waitFor(() => {
      expect(api.getAllUsers).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('should display user data correctly', async () => {
    render(<SuperAdminUsers />);

    await waitFor(() => {
      expect(api.getAllUsers).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Doctor')).toBeInTheDocument();

      // Check badges
      expect(screen.getByTestId('badge-default')).toBeInTheDocument();
      expect(screen.getByTestId('badge-secondary')).toBeInTheDocument();
    });
  });

  it('should filter users by search term', async () => {
    render(<SuperAdminUsers />);

    await waitFor(() => {
      expect(api.getAllUsers).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    fireEvent.change(searchInput, { target: { value: 'john' } });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('should filter users by status', async () => {
    render(<SuperAdminUsers />);

    await waitFor(() => {
      expect(api.getAllUsers).toHaveBeenCalledTimes(1);
    });

    // Check that filter elements are present
    expect(screen.getAllByTestId('select')).toHaveLength(2);
    expect(screen.getAllByTestId('select-content')).toHaveLength(2);
  });

  it('should call updateUserStatus when status change button is clicked', async () => {
    render(<SuperAdminUsers />);

    await waitFor(() => {
      expect(api.getAllUsers).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Find buttons with user check icons (for activating inactive users)
    const userCheckIcons = screen.getAllByTestId('user-check-icon');
    expect(userCheckIcons.length).toBeGreaterThan(0);

    // Click the activation button for the inactive user
    const activateButton = userCheckIcons[0].closest('button') as HTMLButtonElement;
    fireEvent.click(activateButton);

    await waitFor(() => {
      expect(api.updateUserStatus).toHaveBeenCalledWith('2', 'active');
    });
  });

  it('should handle API errors gracefully', async () => {
    (api.getAllUsers as any).mockRejectedValue(new Error('API Error'));

    render(<SuperAdminUsers />);

    await waitFor(() => {
      expect(api.getAllUsers).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('API Error')).toBeInTheDocument();
  });

  it('should show no users message when filtered results are empty', async () => {
    render(<SuperAdminUsers />);

    await waitFor(() => {
      expect(api.getAllUsers).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistentuser' } });

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('should reload users after status update', async () => {
    (api.getAllUsers as any).mockResolvedValue({ users: mockUsers });

    render(<SuperAdminUsers />);

    await waitFor(() => {
      expect(api.getAllUsers).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Trigger a status update using the icon approach
    const userCheckIcons = screen.getAllByTestId('user-check-icon');
    const activateButton = userCheckIcons[0].closest('button') as HTMLButtonElement;
    fireEvent.click(activateButton);

    await waitFor(() => {
      expect(api.updateUserStatus).toHaveBeenCalledWith('2', 'active');
    });

    // Should reload users
    expect(api.getAllUsers).toHaveBeenCalledTimes(2);
  });
});
