// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { applyTextSize, getTextSize, nearestSize, setTextSize, TEXT_SIZES } from './textSize.ts';

afterEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty('--text-scale');
});

describe('text size on this device', () => {
  it('has three steps: Standard, Large and Larger', () => {
    expect(TEXT_SIZES.map((s) => [s.label, s.scale])).toEqual([
      ['Standard', 1],
      ['Large', 1.12],
      ['Larger', 1.25],
    ]);
  });

  it("starts from the device's own text size when nothing is saved", () => {
    expect(nearestSize(16)).toBe('standard');
    expect(nearestSize(18)).toBe('large');
    expect(nearestSize(21)).toBe('larger');
    expect(nearestSize(12)).toBe('standard');
    expect(getTextSize(18)).toBe('large');
  });

  it('a choice is saved for this device and scales every text token', () => {
    setTextSize('larger');
    expect(getTextSize(16)).toBe('larger');
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.25');
    applyTextSize('standard');
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1');
  });
});
