// The "Convert with an AI" instructions are built from the pack spec, so they always match the format.
import packSpec from '../../../docs/07-content-packs.md?raw';
import { describe, expect, it } from 'vitest';
import { convertInstructions } from './convertInstructions.ts';

const SPEC = `# Packs
## JSON format (version 1)
Every entry needs an id.
## Rule hooks (format v2)
Hooks are declarative.
## Homebrew
Not part of it.
## Appendix: instructions shown in the app ("Convert with an AI")
Intro, not quoted.
> Convert the attached rules.
> Use lowercase-dash ids.
> [The JSON format section of this document is appended here.]
`;

describe('Convert with an AI instructions', () => {
  it("are the appendix's quoted lines, then the format sections, without the placeholder", () => {
    const text = convertInstructions(SPEC)!;
    expect(text.startsWith('Convert the attached rules.\nUse lowercase-dash ids.\n\n## JSON format (version 1)')).toBe(true);
    expect(text).toContain('Hooks are declarative.');
    expect(text).not.toContain('Not part of it.');
    expect(text).not.toContain('appended here');
  });

  it('are found in the real spec, so the screen never shows nothing', () => {
    const text = convertInstructions(packSpec);
    expect(text).toContain('"format": "tabletop-pack"');
    expect(text).toContain('## JSON format version 2 (additions)');
  });

  it("give nothing for a spec that lacks the sections, rather than half the instructions", () => {
    expect(convertInstructions('# Something else')).toBeNull();
  });
});
