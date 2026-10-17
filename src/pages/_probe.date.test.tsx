import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { Input } from '@/components/ui/input';

// Probe: does userEvent.type() reliably set a native date input's value in happy-dom?
describe('date input probe', () => {
  it('type() into type="date"', async () => {
    const user = userEvent.setup();
    render(<Input id="probe-date" type="date" aria-label="Date" />);
    const el = screen.getByLabelText('Date') as HTMLInputElement;
    await user.type(el, '2024-01-16');
    // eslint-disable-next-line no-console
    console.log('PROBE type() value =', JSON.stringify(el.value));
    expect(el.value).toBe('2024-01-16');
  });
});
