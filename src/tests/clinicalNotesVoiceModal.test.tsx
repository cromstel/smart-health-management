/**
 * ClinicalNotesVoiceModal tests.
 *
 * Clinical notes used to be written to `clinical_notes_<patientId>` in
 * localStorage, which put the note text and the patient's name in
 * plaintext browser storage. These tests pin the replacement: the notes are
 * read from and written to the API, and browser storage is never touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ClinicalNotesVoiceModal } from '@/components/patients/ClinicalNotesVoiceModal';

const apiRequest = vi.fn();

vi.mock('@/services/shmsApiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  API_BASE_URL: '/api',
  ApiRequestError: class ApiRequestError extends Error {},
}));

const note = {
  id: '3',
  patientId: 'PAT-001',
  patientName: 'John Doe',
  doctorName: 'Dr. Smith',
  content: 'Chest clear on auscultation.',
  timestamp: '2026-10-20T15:00:00.000Z',
  createdAt: '2026-10-20T15:00:00.000Z',
  updatedAt: '2026-10-20T15:00:00.000Z',
  tags: ['General Consultation'],
};

describe('ClinicalNotesVoiceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('loads the notes from the API and never from browser storage', async () => {
    apiRequest.mockResolvedValue({ notes: [note], total: 1 });

    render(
      <ClinicalNotesVoiceModal
        open
        onOpenChange={() => {}}
        patientId="PAT-001"
        patientsList={[{ id: 'PAT-001', name: 'John Doe' }]}
      />
    );

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/clinical-notes', {
        query: { patientId: 'PAT-001' },
      })
    );

    await waitFor(() => expect(screen.getByText('Chest clear on auscultation.')).toBeTruthy());

    expect(localStorage.getItem('clinical_notes_PAT-001')).toBeNull();
    expect(Object.keys(localStorage)).toHaveLength(0);
  });

  it('renders an empty list without crashing when the patient has no notes', async () => {
    apiRequest.mockResolvedValue({ notes: [], total: 0 });

    render(
      <ClinicalNotesVoiceModal
        open
        onOpenChange={() => {}}
        patientId="PAT-002"
        patientsList={[{ id: 'PAT-002', name: 'Jane Doe' }]}
      />
    );

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/clinical-notes', {
        query: { patientId: 'PAT-002' },
      })
    );

    expect(screen.queryByText('Recent Clinical Notes (1)')).toBeNull();
  });

  it('survives a failed request without crashing', async () => {
    apiRequest.mockRejectedValue(new Error('network down'));

    render(
      <ClinicalNotesVoiceModal
        open
        onOpenChange={() => {}}
        patientId="PAT-003"
        patientsList={[{ id: 'PAT-003', name: 'Alex Doe' }]}
      />
    );

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    expect(screen.queryByText('Recent Clinical Notes (1)')).toBeNull();
  });

  it('saves a note through the API instead of browser storage', async () => {
    apiRequest.mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method === 'POST') return note;
      return { notes: [] };
    });

    render(
      <ClinicalNotesVoiceModal
        open
        onOpenChange={() => {}}
        patientId="PAT-001"
        patientsList={[{ id: 'PAT-001', name: 'John Doe' }]}
      />
    );

    const textarea = await screen.findByPlaceholderText('Dictate or type clinical findings here...');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      setter?.call(textarea, 'New observation recorded.');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      screen.getByText('Save Clinical Note').click();
    });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith('/clinical-notes', {
        method: 'POST',
        body: {
          patientId: 'PAT-001',
          content: 'New observation recorded.',
          tags: ['General Consultation'],
        },
      })
    );

    expect(localStorage.getItem('clinical_notes_PAT-001')).toBeNull();
  });
});
