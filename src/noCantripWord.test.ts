// lv-1 (Francis, 2026-11-14): the app no longer writes "Cantrips" itself. A caster's level-0 spells take the pack's own
// label for that level where the pack gives one, and "Level 0" where it doesn't. Words only.
//   Purpose, in plain words: no text the app writes in src/ (a quoted string or a template, outside tests, the test
//   stand-ins and fixtures) says "cantrip" in any case. Comments and names in the code may keep it (they are never
//   shown); so may the First spells step's group key, the bare 'cantrips', which names a group and is never shown.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/** The app's own source files (.ts and .tsx under src/), less tests, the test stand-ins (src/testing) and fixtures. */
const files = Object.entries(import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}', '!./testing/**', '!./**/fixtures/**'], { query: '?raw', import: 'default', eager: true }));

/**
 * The texts a file writes that say "cantrip", in any case: its strings, the fixed parts of its templates and its JSX
 * text, as the TypeScript parser reads them (so comments and names in the code never count, nor a template's `${…}`).
 * The bare group key 'cantrips' is left out: it names a group and is never shown.
 */
function cantripTexts(source: string, name = 'sample.tsx'): string[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, false, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      const text = node.text;
      if (/cantrip/i.test(text) && !(ts.isStringLiteral(node) && text === 'cantrips')) found.push(text.trim());
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe('lv-1: the app writes no "Cantrip" of its own', () => {
  it('no quoted text in src/ says "cantrip", in any case (tests, stand-ins and fixtures aside)', () => {
    expect(files.length).toBeGreaterThan(100);
    const found = files.flatMap(([path, source]) => cantripTexts(source, path).map((text) => `${path}: ${text}`));
    expect(found).toEqual([]);
  });

  // Purpose: the scan itself finds what it should and leaves what it should (comments, names, the group key).
  it('the scan finds a quoted word and leaves comments, names and the group key', () => {
    const sample = [
      "// Cantrips in a comment",
      '/* and a block: "cantrip" */',
      'const CANTRIPS = 1;',
      "type Group = 'given' | 'cantrips';",
      "const a = 'Cantrip';",
      'const b = `${n} cantrips to go`;',
      'const c = "Level 0";',
      'const d = `${picks.cantrips.length} to go`;',
      'const e = <p>Roll for your cantrip</p>;',
    ].join('\n');
    expect(cantripTexts(sample)).toEqual(['Cantrip', 'cantrips to go', 'Roll for your cantrip']);
  });
});
