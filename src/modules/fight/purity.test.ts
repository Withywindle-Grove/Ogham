import { describe, expect, it } from 'vitest';

const own = Object.entries(import.meta.glob<string>('./*.ts', { query: '?raw', import: 'default', eager: true })).filter(([path]) => !path.endsWith('.test.ts'));
const app = Object.entries(import.meta.glob<string>('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })).filter(([path]) => !path.startsWith('../../modules/fight/'));

describe('the fight module stays pure (slice 2a fence)', () => {
  // Nothing in the module rolls a die or imports from the app, the core's storage, or another module.
  it('rolls no die and imports only its own files', () => {
    expect(own.length).toBeGreaterThan(0);
    for (const [file, text] of own) {
      expect(text, `${file} rolls a die`).not.toMatch(/Math\.random|crypto\.getRandomValues/);
      const imports = [...text.matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
      for (const target of imports) expect(target, `${file} imports ${target}`).toMatch(/^\.\/[a-z]+\.ts$/);
    }
  });

  // Nothing in the app imports the module yet: slice 2b wires it in.
  it('is imported by nothing outside its folder', () => {
    expect(app.length).toBeGreaterThan(0);
    const offenders = app.filter(([, text]) => /modules\/fight/.test(text)).map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
