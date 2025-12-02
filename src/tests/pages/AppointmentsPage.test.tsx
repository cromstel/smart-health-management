import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppointmentsPage from '@/pages/AppointmentsPage'
import { AuditProvider } from '@/contexts/AuditContext'

vi.mock('@/services/api', () => {
  return {
    api: {
      getAppointments: vi.fn(async () => ([
        {
          id: '1',
          appointment_id: 'A001',
          patient_first_name: 'John',
          patient_last_name: 'Doe',
          doctor_id: 'd1',
          doctor_first_name: 'Alice',
          doctor_last_name: 'Smith',
          department_name: 'Cardiology',
          appointment_time: '09:00',
          appointment_date: '2024-01-20',
          type: 'consultation',
          notes: 'N/A',
          status: 'scheduled'
        }
      ])),
      getPatients: vi.fn(async () => ([])),
      getStaff: vi.fn(async () => ([])),
    }
  }
})

vi.mock('@/contexts/AuthContext', async () => {
  return {
    useAuth: () => ({
      user: { id: 'u1', hospital_id: 'h1', role: 'admin', name: 'User', email: 'u@example.com', permissions: ['appointments:view', 'appointments:add', 'appointments:edit', 'appointments:delete'] },
      hasPermission: (p: string) => ['appointments:view', 'appointments:add', 'appointments:edit', 'appointments:delete'].includes(p),
      canActOnHospital: () => true,
    })
  }
})

describe('AppointmentsPage hospital-aware gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header when authorized', async () => {
    render(<AuditProvider><AppointmentsPage /></AuditProvider>)
    expect(await screen.findByText('Appointments')).toBeInTheDocument()
  })

  // Authorization edge cases are covered in middleware and AuthContext tests
})
