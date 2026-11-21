import { describe, expect, it } from 'vitest';
import pageHtml from '../index.html?raw';
import viteConfig from '../vite.config.ts?raw';
import { BRAND } from './brand.ts';

// Every source file's text (tests left out: they may quote what a screen shows).
const sources = Object.entries(import.meta.glob<string>('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })).filter(
  ([path]) => !/\.test\.tsx?$/.test(path) && path !== './brand.ts',
);
// The app's names, past and present, as they'd appear in text a person reads.
const NAMES = /\b(Grimoire|Nemeton|Tome|TOME|Ogham)\b/;

/** A file's lines with comments taken out (a comment may mention the repo, which keeps its name). */
function codeLines(text: string): string[] {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|[^:'"`])\/\/.*$/, '$1'));
}

describe('the app name lives in one place (src/brand.ts)', () => {
  it('no screen text names the app or its persona directly', () => {
    const found = sources.flatMap(([path, text]) => codeLines(text).filter((line) => NAMES.test(line)).map((line) => `${path}: ${line.trim()}`));
    expect(found).toEqual([]);
  });

  it('the page title and the installed app name come from it too', () => {
    expect(pageHtml).not.toMatch(NAMES);
    expect(viteConfig).not.toMatch(NAMES);
    expect(viteConfig).toContain('BRAND.appName');
    expect(viteConfig).toContain('BRAND.shortName');
  });

  it('holds the name, the persona and the loading-screen entry', () => {
    expect(BRAND).toMatchObject({ appName: 'Tome', shortName: 'Tome', persona: 'Ogham', emailSenderName: 'Ogham' });
    expect(BRAND).not.toHaveProperty('pronunciation');
    expect(BRAND.dictionaryEntry).toBe('tome, noun, from the Greek tomos, one volume of a work: a large and weighty book. What the table remembers.');
    expect(BRAND.dictionaryEntry).toContain(BRAND.dictionaryItalic);
  });

  // The Tome rename (2026-11-07): the tagline is Francis's placeholder, and the grove's line is gone everywhere.
  it('the tagline is the treatise line, and "Under the old oaks" is nowhere in the app', () => {
    expect(BRAND.tagline).toBe('Here beginneth a tale of high adventure.');
    const everything = [...sources.map(([, text]) => text), pageHtml, viteConfig, JSON.stringify(BRAND)];
    expect(everything.filter((text) => /old oaks/i.test(text))).toEqual([]);
  });

  it("holds Ogham's sign-off and sayings: historical ones say where they come from, table ones are the app's own", () => {
    expect(BRAND.sessionSignOff).toBe('Until the returning night.');
    expect(BRAND.sayings.length).toBe(13);
    for (const saying of BRAND.sayings) {
      expect(saying.text.length).toBeLessThanOrEqual(80);
      expect(Boolean(saying.source), saying.text).toBe(saying.kind === 'historical');
    }
    expect(BRAND.sayings.filter((s) => s.text.includes(BRAND.persona))).toHaveLength(2);
  });
});
