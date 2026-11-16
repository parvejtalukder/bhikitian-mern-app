'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  /** `icon` for the header, `segmented` for labelled placements. */
  variant?: 'icon' | 'segmented';
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'segmented') {
    const option = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors';
    return (
      <div
        className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
        role="group"
        aria-label="Reading theme"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          aria-pressed={!isDark}
          className={`${option} ${!isDark ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:text-ink'}`}
        >
          <Sun className="h-3.5 w-3.5" aria-hidden="true" />
          Parchment
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          aria-pressed={isDark}
          className={`${option} ${isDark ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:text-ink'}`}
        >
          <Moon className="h-3.5 w-3.5" aria-hidden="true" />
          Midnight
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="bh-icon-btn"
      aria-label={isDark ? 'Switch to the light reading theme' : 'Switch to the dark reading theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
