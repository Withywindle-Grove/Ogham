// @vitest-environment jsdom
// Words rule 11 (no middle dot, ruled 2026-11-07; the app-wide sweep, plan m5b-players-screens-standard E): nothing a
// player or GM reads holds "·". Two checks: every text the app's code writes (its strings, templates and JSX text; the
// words modules and the gallery's specimens included), and the whole gallery as drawn, every part in every state.
import { cleanup, render } from '@testing-library/react';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { Gallery } from '../gallery/Gallery.tsx';

const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync: (path: string, encoding: 'utf8') => string };
// Left out: the one file that writes the stored separator (a patch's name, a draft roll's label, a watch choice keep
// " · " as saved; they are shown through it with a comma: the sweep's review, #561).
const sources = Object.keys(import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/testing/**', '!/src/core/storedWords.ts'])).map(
  (path) => [path, fs.readFileSync(`.${path}`, 'utf8')] as const,
);

/** Every middle dot inside text the code writes: string literals, template parts and JSX text (not comments, not regexes). */
function dotsIn(path: string, text: string, mark = '·'): string[] {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const TEXT = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.JsxText,
  ]);
  const visit = (node: ts.Node) => {
    if (TEXT.has(node.kind) && node.getText(file).includes(mark)) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      found.push(`${path}:${line} ${node.getText(file).trim()}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

afterAll(() => cleanup());

describe('no middle dot (words rule 11)', () => {
  it('the check finds a dot in a string, a template and JSX text, and leaves comments and regexes alone', () => {
    const dot = String.fromCharCode(0xb7);
    const sample = `// a ${dot} comment\nconst a = 'x ${dot} y';\nconst b = \`\${a} ${dot} z\`;\nconst c = /a ${dot} b/;\nconst d = <p>Wren ${dot} 3</p>;\n`;
    expect(dotsIn('/sample.tsx', sample).map((f) => f.split(' ')[0])).toEqual(['/sample.tsx:2', '/sample.tsx:3', '/sample.tsx:5']);
  });

  it('no text the app writes holds a middle dot', () => {
    expect(sources.length).toBeGreaterThan(100);
    expect(sources.flatMap(([path, text]) => dotsIn(path, text))).toEqual([]);
  });

  // 06 rule 12 (Design, ⚑ 6 on #561): a warning is marked by the warning sign, never a plain ▲.
  it('no text the app writes holds a plain ▲', () => {
    expect(sources.flatMap(([path, text]) => dotsIn(path, text, '▲'))).toEqual([]);
  });

  it('the gallery, drawn, shows no middle dot and names nothing with one', () => {
    render(<Gallery />);
    expect(document.body.textContent).toBeTruthy();
    const dotted = [...document.body.querySelectorAll('*')].flatMap((el) => {
      const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('');
      const label = el.getAttribute('aria-label') ?? '';
      return [own, label].filter((t) => t.includes('·')).map((t) => `${el.tagName.toLowerCase()}.${String(el.className)}: ${t.trim()}`);
    });
    expect(dotted).toEqual([]);
  });
});
