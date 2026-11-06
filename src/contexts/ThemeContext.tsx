import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPreferences, saveUserPreference } from '@/services/userPreferences.service';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  /**
   * True once the signed-in account's preferences have been read (or the read
   * has failed). Until then the theme is the default and must not be written
   * back: doing so would overwrite the account's stored choice with the
   * default before it was ever loaded.
   */
  const [hydrated, setHydrated] = useState(false);
  /**
   * Set when the next theme value came from the server rather than from the
   * user, so the persist effect does not echo it straight back.
   */
  const themeCameFromServer = useRef(true);
  const { user, isAuthLoading } = useAuth();

  // Apply the theme to the document on every change, including before auth
  // settles, so the first paint is already themed.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
      body.classList.add('dark');
      body.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
      body.classList.remove('dark');
      body.classList.add('light');
    }
  }, [theme]);

  // Read the account's stored theme once authentication has settled. The
  // effect is cancelled if the account changes or the component unmounts, so a
  // slow response cannot theme the next session.
  useEffect(() => {
    if (isAuthLoading) return;

    let cancelled = false;

    if (!user) {
      themeCameFromServer.current = true;
      setHydrated(false);
      return;
    }

    setHydrated(false);
    themeCameFromServer.current = true;

    const load = async () => {
      try {
        const prefs = await getUserPreferences();
        if (cancelled) return;
        const savedTheme = prefs.theme?.theme;
        if (savedTheme === 'light' || savedTheme === 'dark') {
          themeCameFromServer.current = true;
          setThemeState(savedTheme);
        }
      } catch {
        // No server-side preference set yet; the default stays.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  // Persist only a change the user made, for an authenticated account, after
  // hydration. Preferences are stored server-side instead of in localStorage
  // (PHI-at-rest rule).
  useEffect(() => {
    if (!hydrated || !user) return;
    if (themeCameFromServer.current) {
      themeCameFromServer.current = false;
      return;
    }
    saveUserPreference({ category: 'theme', key: 'theme', value: theme }).catch(() => {
      // Best-effort: server unavailable; the theme remains session-scoped.
    });
  }, [theme, hydrated, user]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
      }}
    >
      <div className={theme === 'dark' ? 'dark min-h-screen bg-background text-foreground' : 'light min-h-screen bg-background text-foreground'}>
        {children}
        <Toaster />
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
