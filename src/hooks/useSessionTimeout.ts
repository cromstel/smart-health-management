import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
const WARNING_DURATION = 5 * 60 * 1000; // 5 minutes before timeout

export function useSessionTimeout() {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef<number | undefined>(undefined);
  const warningRef = useRef<number | undefined>(undefined);

  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current !== undefined) {
      window.clearTimeout(timeoutRef.current);
    }
    if (warningRef.current !== undefined) {
      window.clearTimeout(warningRef.current);
    }

    if (!isAuthenticated) return;

    // Set warning timer
    warningRef.current = window.setTimeout(() => {
      // Show warning notification
      console.log('Session will expire in 5 minutes');
      // You can show a toast notification here
    }, TIMEOUT_DURATION - WARNING_DURATION);

    // Set logout timer
    timeoutRef.current = window.setTimeout(() => {
      logout();
      navigate('/login', { state: { message: 'Session expired due to inactivity' } });
    }, TIMEOUT_DURATION);
  }, [isAuthenticated, logout, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Events that reset the timer
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    // Reset timer on user activity
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Initial timer setup
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
      }
      if (warningRef.current !== undefined) {
        window.clearTimeout(warningRef.current);
      }
    };
  }, [isAuthenticated, resetTimer]);

  return { resetTimer };
}