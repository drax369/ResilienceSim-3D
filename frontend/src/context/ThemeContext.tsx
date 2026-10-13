import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'resiliencesim_3d_theme';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): { theme: Theme; hasExplicitChoice: boolean } {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return { theme: saved, hasExplicitChoice: true };
    }
  } catch {
    // LocalStorage might be disabled in private mode
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return { theme: prefersDark ? 'dark' : 'light', hasExplicitChoice: false };
  }

  return { theme: 'light', hasExplicitChoice: false };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeState, setThemeState] = useState<{ theme: Theme; hasExplicitChoice: boolean }>(
    getInitialTheme
  );

  const theme = themeState.theme;
  const isDark = theme === 'dark';

  // Apply theme to DOM root
  const applyThemeToDom = useCallback((targetTheme: Theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', targetTheme);
      // Also update style color-scheme for native inputs/scrollbars
      document.documentElement.style.colorScheme = targetTheme;
    }
  }, []);

  // Update theme explicitly (persists to localStorage)
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState({ theme: newTheme, hasExplicitChoice: true });
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore storage errors
    }
    applyThemeToDom(newTheme);
  }, [applyThemeToDom]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [theme, setTheme]);

  // Synchronize on mount and handle system media changes if no explicit choice
  useEffect(() => {
    applyThemeToDom(theme);

    // If user has not set an explicit preference, respond to OS preference changes
    if (!themeState.hasExplicitChoice && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = (e: MediaQueryListEvent) => {
        // Re-check storage in case another tab updated it
        const currentStored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!currentStored) {
          const systemTheme: Theme = e.matches ? 'dark' : 'light';
          setThemeState({ theme: systemTheme, hasExplicitChoice: false });
          applyThemeToDom(systemTheme);
        }
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemChange);
        return () => mediaQuery.removeEventListener('change', handleSystemChange);
      } else if ('addListener' in mediaQuery) {
        // Backward compatibility
        (mediaQuery as any).addListener(handleSystemChange);
        return () => (mediaQuery as any).removeListener(handleSystemChange);
      }
    }
  }, [theme, themeState.hasExplicitChoice, applyThemeToDom]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
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
