import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import CriticalVitalsAlertWidget from '@/components/dashboard/CriticalVitalsAlertWidget';

vi.mock('@/services/vitalsService', () => ({
  vitalsService: {
    getAllActiveCriticalAlerts: vi.fn().mockResolvedValue([
      {
        id: '1',
        patientId: 'p1',
        patientName: 'John Doe',
        metricLabel: 'Heart Rate',
        metricValue: '130 bpm',
        category: 'heart_rate',
        severity: 'critical',
        title: 'Tachycardia',
        message: 'Elevated HR',
        recordedAt: '2023-10-27T10:00:00Z',
      }
    ]),
  },
}));

describe('CriticalVitalsAlertWidget', () => {
  it('renders loading state initially and then shows alerts', async () => {
    render(
      <BrowserRouter>
        <CriticalVitalsAlertWidget />
      </BrowserRouter>
    );
    expect(screen.getByText('Checking patient vital telemetry...')).toBeInTheDocument();
    
    // Wait for the mock to resolve
    const alertTitle = await screen.findByText('John Doe');
    expect(alertTitle).toBeInTheDocument();
  });
});
