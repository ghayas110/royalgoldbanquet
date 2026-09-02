'use client';

import { SessionProvider } from 'next-auth/react';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

type Theme = 'dark' | 'light';
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  // The inline script in <head> has already applied the saved theme before
  // paint; adopt whatever it set instead of re-reading and re-flipping.
  useEffect(() => {
    const applied: Theme = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    setTheme(applied);
  }, []);

  // Skip the very first run — the class is already correct from the inline
  // script, and writing on mount would just re-assert it.
  const firstRun = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    if (firstRun.current) { firstRun.current = false; return; }
    localStorage.setItem('skylight-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return (
    <SessionProvider>
      <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
    </SessionProvider>
  );
}
