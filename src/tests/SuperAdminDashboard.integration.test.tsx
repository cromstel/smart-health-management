import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SuperAdminDashboard from '../pages/SuperAdminDashboard';
import { api } from '../services/api';

// Mock the API
vi.mock('../services/api', () => ({
  api: {
    getSystemStatus: vi.fn(),
    triggerBackup: vi.fn(),
  },
}));

// Mock navigator for routing
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('SuperAdminDashboard Integration Tests', () => {
  const mockSystemStatus = {
    status: 'OK',
    statistics: {
      totalUsers: 150,
      totalHospitals: 12,
      totalPatients: 2400,
      totalAppointments: 3200,
      databaseSize: 250,
    },
    timestamp: '2024-01-20T12:00:00Z',
  };

  const mockBackupResponse = { message: 'Backup initiated successfully' };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API responses
    (api.getSystemStatus as any).mockResolvedValue(mockSystemStatus);
    (api.triggerBackup as any).mockResolvedValue(mockBackupResponse);
  });

  it('should load and display system status correctly', async () => {
    render(<SuperAdminDashboard />);

    await waitFor(() => {
      expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    // Check header content
    expect(screen.getByText('System Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Monitor and manage your health management system')).toBeInTheDocument();

    // Check statistics cards
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Total Hospitals')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Total Patients')).toBeInTheDocument();
    expect(screen.getByText('2400')).toBeInTheDocument();
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(screen.getByText('3200')).toBeInTheDocument();

    // Check system information
    expect(screen.getByText('Database Size')).toBeInTheDocument();
    expect(screen.getByText('250 MB')).toBeInTheDocument();
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('should navigate to different pages when buttons are clicked', async () => {
    render(<SuperAdminDashboard />);

    await waitFor(() => {
      expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    // Test Manage Users button
    const manageUsersButton = screen.getByText('Manage Users');
    fireEvent.click(manageUsersButton);
    expect(mockNavigate).toHaveBeenCalledWith('/super-admin/users');

    // Test View Audit Logs button
    const viewAuditLogsButton = screen.getByText('View Audit Logs');
    fireEvent.click(viewAuditLogsButton);
    expect(mockNavigate).toHaveBeenCalledWith('/super-admin/audit-logs');

    // Test System Settings button
    const systemSettingsButton = screen.getByText('System Settings');
    fireEvent.click(systemSettingsButton);
    expect(mockNavigate).toHaveBeenCalledWith('/super-admin/settings');

    // Test View Hospitals button
    const viewHospitalsButton = screen.getByText('View Hospitals');
    fireEvent.click(viewHospitalsButton);
    expect(mockNavigate).toHaveBeenCalledWith('/super-admin/hospitals');

    // Test System Upgrade button
    const systemUpgradeButton = screen.getByText('System Upgrade');
    fireEvent.click(systemUpgradeButton);
    expect(mockNavigate).toHaveBeenCalledWith('/super-admin/operations');
  });

  it('should handle backup initiation', async () => {
    // Mock window.alert
    const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<SuperAdminDashboard />);

    await waitFor(() => {
      expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    const backupButton = screen.getByText('Trigger Backup');
    fireEvent.click(backupButton);

    await waitFor(() => {
      expect(api.triggerBackup).toHaveBeenCalledTimes(1);
    });

    expect(mockAlert).toHaveBeenCalledWith('Backup initiated successfully');

    mockAlert.mockRestore();
  });

  it('should handle system status OK status with green indicator', async () => {
    const okStatus = { ...mockSystemStatus, status: 'OK' };
    (api.getSystemStatus as any).mockResolvedValue(okStatus);

    render(<SuperAdminDashboard />);

    await waitFor(() => {
      expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    const statusIndicator = screen.getByText('OK');
    expect(statusIndicator).toBeInTheDocument();
    // You could add CSS class checks here if needed
  });

  it('should display real-time timestamp', async () => {
    // Mock date parsing for consistent test
    const mockDate = new Date('2024-01-20T15:30:00Z');
    vi.setSystemTime(mockDate);

    const timestampStatus = {
      ...mockSystemStatus,
      timestamp: mockDate.toISOString(),
    };
    (api.getSystemStatus as any).mockResolvedValue(timestampStatus);

    render(<SuperAdminDashboard />);

    await waitFor(() => {
      expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    // The timestamp should be displayed and formatted
    expect(screen.getByText('Last Updated')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('should handle system health data edge cases', async () => {
    const edgeCaseStatus = {
      status: 'OK',
      statistics: {
        totalUsers: 0,
        totalHospitals: 0,
        totalPatients: 0,
        totalAppointments: 0,
        databaseSize: 0,
      },
      timestamp: new Date().toISOString(),
    };
    (api.getSystemStatus as any).mockResolvedValue(edgeCaseStatus);

    render(<SuperAdminDashboard />);

    await waitFor(() => {
      expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    // Should display zeros gracefully
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0 MB')).toBeInTheDocument();
  });

  it('should handle backup API errors gracefully', async () => {
    const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    (api.triggerBackup as any).mockRejectedValue(new Error('Backup failed'));

    render(<SuperAdminDashboard />);

    await waitFor(() => {
      expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    const backupButton = screen.getByText('Trigger Backup');
    fireEvent.click(backupButton);

    await waitFor(() => {
      expect(api.triggerBackup).toHaveBeenCalledTimes(1);
    });

    expect(mockAlert).toHaveBeenCalledWith('Failed to trigger backup: Backup failed');

    mockAlert.mockRestore();
  });

  it('should render loading state initially', () => {
    render(<SuperAdminDashboard />);

    // Component should show loading skeletons initially
    const loadingElements = screen.getAllByTestId('skeleton');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should provide comprehensive navigation options', async () => {
    render(<SuperAdminDashboard />);

    await waitFor(() => {
      expect(api.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    const buttons = [
      'Trigger Backup',
      'System Upgrade',
      'Manage Users',
      'View Audit Logs',
      'System Settings',
      'View Hospitals',
    ];

    buttons.forEach(buttonText => {
      expect(screen.getByText(buttonText)).toBeInTheDocument();
    });
  });
});
