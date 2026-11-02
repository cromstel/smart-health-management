import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        const prefs = await getUserPreferences();
        const savedTheme = prefs.theme?.theme as Theme | undefined;
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeState(savedTheme);
        }
      } catch {
        // Fallback: no server-side preference set yet
      }
    };
    if (user) load();
  }, [user]);

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
    // Persist theme server-side instead of localStorage (PHI-at-rest rule).
    saveUserPreference({ category: 'theme', key: 'theme', value: theme }).catch(() => {
      // Best-effort: server unavailable; theme remains session-scoped.
    });
  }, [theme]);

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
