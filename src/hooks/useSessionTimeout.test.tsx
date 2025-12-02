import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSessionTimeout } from './useSessionTimeout';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseNavigate = useNavigate as jest.Mock;

describe('useSessionTimeout', () => {
  const logout = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockUseNavigate.mockReturnValue(navigate);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('should not set timers if user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, logout });
    renderHook(() => useSessionTimeout());

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  test('should set timers when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, logout });
    renderHook(() => useSessionTimeout());

    // Should not log out before timeout
    act(() => {
      vi.advanceTimersByTime(29 * 60 * 1000);
    });
    expect(logout).not.toHaveBeenCalled();
  });

  test('should call logout and navigate when session expires', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, logout });
    renderHook(() => useSessionTimeout());

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login', {
      state: { message: 'Session expired due to inactivity' },
    });
  });

  test('should reset timer on user activity', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, logout });
    const { result } = renderHook(() => useSessionTimeout());

    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000);
    });

    // Simulate user activity
    act(() => {
      result.current.resetTimer();
    });

    // Advance time again, should not log out yet
    act(() => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });
    expect(logout).not.toHaveBeenCalled();

    // Advance to full timeout after reset
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(logout).toHaveBeenCalled();
  });

  test('should clear timers on unmount', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, logout });
    const { unmount } = renderHook(() => useSessionTimeout());

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });
});