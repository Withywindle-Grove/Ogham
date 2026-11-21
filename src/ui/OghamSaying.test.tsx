// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BRAND } from '../brand.ts';
import { OghamSaying, pickSaying } from './OghamSaying.tsx';

afterEach(cleanup);

describe("Ogham's sayings", () => {
  it('picks every saying somewhere between 0 and 1', () => {
    const picked = new Set(Array.from({ length: 200 }, (_, i) => pickSaying(i / 200).text));
    expect(picked.size).toBe(BRAND.sayings.length);
    expect(pickSaying(0.9999)).toBe(BRAND.sayings.at(-1));
  });

  it('a historical saying shows its source; a table saying shows none', () => {
    render(<OghamSaying at={0} />);
    expect(screen.getByText(BRAND.sayings[0]!.text)).toBeTruthy();
    expect(screen.getByText(BRAND.sayings[0]!.source!)).toBeTruthy();
    cleanup();
    render(<OghamSaying at={0.99} />);
    expect(screen.getByRole('figure').querySelector('figcaption')).toBeNull();
  });
});
