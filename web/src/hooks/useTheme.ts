import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

// index.html sets data-theme before first paint, from the saved choice or the
// system preference, so read it rather than guessing again here.
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('dj-theme', theme);
    } catch {
      // Storage can be unavailable in private modes; the theme still applies.
    }
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
  };
}
