// Text size for this device (docs/05-features.md, personal menu; ruled 2026-10-23): Standard, Large or
// Larger. With nothing chosen it starts from the device's own text size (the browser's default font size).
// Every text token in tokens.css is multiplied by --text-scale; tap targets stay at least 44px whatever the size.

export type TextSize = 'standard' | 'large' | 'larger';

export const TEXT_SIZES: { value: TextSize; label: string; scale: number }[] = [
  { value: 'standard', label: 'Standard', scale: 1 },
  { value: 'large', label: 'Large', scale: 1.12 },
  { value: 'larger', label: 'Larger', scale: 1.25 },
];

const STORAGE_KEY = 'grimoire.textSize';

/** The step closest to the device's own text size (16px is standard). */
export function nearestSize(devicePx: number): TextSize {
  const scale = devicePx / 16;
  return TEXT_SIZES.reduce((best, size) => (Math.abs(size.scale - scale) < Math.abs(best.scale - scale) ? size : best)).value;
}

/** The device's own text size: the browser's default font size, before the app sets anything. */
function devicePx(): number {
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px : 16;
}

export function getTextSize(deviceSize = devicePx()): TextSize {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'standard' || saved === 'large' || saved === 'larger') return saved;
  } catch {
    // Storage can be blocked (private browsing); fall back to the device.
  }
  return nearestSize(deviceSize);
}

export function applyTextSize(size: TextSize): void {
  const scale = TEXT_SIZES.find((s) => s.value === size)?.scale ?? 1;
  document.documentElement.style.setProperty('--text-scale', String(scale));
}

export function setTextSize(size: TextSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Not saved, but still applied for this visit.
  }
  applyTextSize(size);
}
