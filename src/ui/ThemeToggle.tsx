import { useState } from 'react';
import { getThemeChoice, setThemeChoice, type ThemeChoice } from './theme.ts';
import './ThemeToggle.css';

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'device', label: 'Device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Device / Light / Dark, shown under "This device" in the ⋯ menu. A tap saves and applies the choice; showing
// the toggle changes nothing (main.tsx applies the saved choice at start, and the gallery sets its own).
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice);
  const choose = (next: ThemeChoice) => {
    setChoice(next);
    setThemeChoice(next);
  };

  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="theme-toggle__option"
          aria-pressed={choice === option.value}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
