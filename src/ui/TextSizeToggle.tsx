import { useState } from 'react';
import { getTextSize, setTextSize, TEXT_SIZES, type TextSize } from './textSize.ts';
import './ThemeToggle.css';

// Standard / Large / Larger, shown under "This device" in the ⋯ menu beside the theme. A tap saves and applies
// it; showing the toggle changes nothing (main.tsx applies the saved size at start).
export function TextSizeToggle() {
  const [size, setSize] = useState<TextSize>(() => getTextSize());
  const choose = (next: TextSize) => {
    setSize(next);
    setTextSize(next);
  };

  return (
    <div className="theme-toggle" role="group" aria-label="Text size">
      {TEXT_SIZES.map((option) => (
        <button key={option.value} type="button" className="theme-toggle__option" aria-pressed={size === option.value} onClick={() => choose(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
